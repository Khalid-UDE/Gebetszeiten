// Web Push mit WebCrypto: VAPID (RFC 8292) und Verschlüsselung aes128gcm (RFC 8291).
// Läuft in Cloudflare Workers und in Node ≥ 20 (globales crypto.subtle).

const enc = new TextEncoder();

export function b64urlEncode(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

// Neues VAPID-Schlüsselpaar: publicKey (65 Byte, base64url) und privateKey (d, base64url).
export async function generateVapidKeys() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { publicKey: b64urlEncode(raw), privateKey: jwk.d };
}

async function vapidAuthorization(endpoint, publicKey, privateKey, subject) {
  const pub = b64urlDecode(publicKey);
  const jwk = { kty: "EC", crv: "P-256", x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), d: privateKey, ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 3600, // Apple akzeptiert nur kurz gültige Tokens
    sub: subject
  })));
  const unsigned = `${header}.${claims}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned));
  return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${publicKey}`;
}

// Verschlüsselt die Nachricht für ein Abo (p256dh, auth aus subscription.keys).
export async function encryptPayload(payload, p256dh, auth) {
  const uaPublic = b64urlDecode(p256dh);
  const authSecret = b64urlDecode(auth);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const prkKey = await hmac(authSecret, ecdhSecret);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plain));

  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

// Sendet eine Nachricht. Rückgabe: {status, reason} des Push-Dienstes (201 = angenommen, 404/410 = Abo ungültig).
export async function sendPush(subscription, payload, { publicKey, privateKey, subject, ttl = 900 }) {
  const body = await encryptPayload(JSON.stringify(payload), subscription.keys.p256dh, subscription.keys.auth);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, publicKey, privateKey, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: "high"
    },
    body
  });
  const reason = res.ok ? "" : (await res.text()).slice(0, 300);
  return { status: res.status, reason };
}
