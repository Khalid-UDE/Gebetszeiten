// Push-Benachrichtigungen: Erlaubnis, Abo beim Browser, Abgleich mit dem Push-Server.
import { WORKER_URL } from "./config.js";

export const serverConfigured = () => Boolean(WORKER_URL);

let vapidKey = null;
async function serverKey() {
  if (vapidKey) return vapidKey;
  const r = await fetch(`${WORKER_URL}/vapid`);
  vapidKey = (await r.json()).publicKey;
  if (!vapidKey) throw new Error("VAPID-Schlüssel fehlt");
  return vapidKey;
}

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export const permission = () => ("Notification" in window ? Notification.permission : "unsupported");

function b64ToBytes(b64) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

// Muss direkt aus einem Tippen heraus aufgerufen werden (iOS verlangt eine Nutzeraktion).
export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;
  if (!serverConfigured()) return "local";
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(await serverKey()) });
  }
  return sub;
}

// Einstellungen und Standort an den Server melden (anonym, nur das Abo als Schlüssel).
export async function syncSubscription(sub, data) {
  if (!serverConfigured() || !sub) return false;
  const r = await fetch(`${WORKER_URL}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), ...data })
  });
  return r.ok;
}

// Rückgabe: {ok, status, reason} vom Server
export async function sendTest(sub, data) {
  if (!serverConfigured() || !sub) return { ok: false, reason: "no subscription" };
  const r = await fetch(`${WORKER_URL}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), ...data })
  });
  try { return await r.json(); } catch { return { ok: false, status: r.status, reason: "HTTP " + r.status }; }
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  if (serverConfigured()) {
    try {
      await fetch(`${WORKER_URL}/unsubscribe`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
    } catch { /* offline */ }
  }
  await sub.unsubscribe();
}
