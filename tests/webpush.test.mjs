// Prüft die Push-Verschlüsselung (RFC 8291) durch Entschlüsseln aus Sicht des Browsers
// und die VAPID-Signatur (RFC 8292).
import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptPayload, generateVapidKeys, b64urlEncode, b64urlDecode, sendPush } from "../worker/src/webpush.js";

const enc = new TextEncoder();
const concat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

async function browserKeys() {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { kp, p256dh: b64urlEncode(pub), auth: b64urlEncode(auth), pub, authBytes: auth };
}

async function decrypt(body, ua) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
  const idlen = body[20];
  const asPub = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  assert.equal(rs, 4096);
  const asKey = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.kp.privateKey, 256));
  const prkKey = await hmac(ua.authBytes, secret);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), ua.pub, asPub, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, cipher));
  assert.equal(plain[plain.length - 1], 2, "Trennzeichen des letzten Datensatzes");
  return new TextDecoder().decode(plain.slice(0, -1));
}

test("Nachricht lässt sich vom Browser entschlüsseln", async () => {
  const ua = await browserKeys();
  const msg = JSON.stringify({ title: "Asr · العصر · 15:59", body: "Es ist Zeit für Asr" });
  const body = await encryptPayload(msg, ua.p256dh, ua.auth);
  assert.equal(await decrypt(body, ua), msg);
});

test("VAPID-Anfrage ist korrekt signiert", async () => {
  const ua = await browserKeys();
  const vapid = await generateVapidKeys();
  assert.equal(b64urlDecode(vapid.publicKey).length, 65);
  let captured;
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => { captured = { url, init }; return new Response(null, { status: 201 }); };
  try {
    const status = await sendPush({ endpoint: "https://push.example.com/abc", keys: { p256dh: ua.p256dh, auth: ua.auth } },
      { title: "t" }, { ...vapid, subject: "https://example.com" });
    assert.equal(status, 201);
  } finally { globalThis.fetch = orig; }
  const auth = captured.init.headers.Authorization;
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(auth);
  assert.ok(m, auth);
  assert.equal(m[4], vapid.publicKey);
  const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(m[2])));
  assert.equal(claims.aud, "https://push.example.com");
  const pub = await crypto.subtle.importKey("raw", b64urlDecode(vapid.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64urlDecode(m[3]), enc.encode(`${m[1]}.${m[2]}`));
  assert.ok(ok, "Signatur gültig");
  assert.equal(captured.init.headers["Content-Encoding"], "aes128gcm");
});
