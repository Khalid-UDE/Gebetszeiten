// Service Worker: Offline-Betrieb und Push-Benachrichtigungen.
const VERSION = "gz-v10";
const SHELL = [
  "./", "index.html", "styles.css", "manifest.webmanifest",
  "js/app.js", "js/qibla.js", "js/geomag.js", "js/praytimes.js", "js/i18n.js", "js/diyanet.js", "js/location.js", "js/push.js", "js/config.js",
  "data/diyanet-de.json",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png", "icons/badge-72.png"
];

self.addEventListener("install", e => {
  // cache: "reload" → nie veraltete Dateien aus dem HTTP-Cache übernehmen
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !fonts) return; // APIs (Diyanet, Karten) immer live
  // Erst Netz, dann Cache – so kommen Updates sofort an und offline geht es trotzdem.
  e.respondWith(
    // eigene Dateien immer beim Server nachprüfen, damit alle zur selben Version gehören
    fetch(sameOrigin ? e.request.url : e.request, sameOrigin ? { cache: "no-cache", credentials: "same-origin" } : undefined).then(res => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: sameOrigin }))
  );
});

self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: e.data && e.data.text() }; }
  const title = data.title || "Gebetszeiten";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "icons/icon-192.png",
    badge: "icons/badge-72.png",
    tag: data.tag || "gz",
    lang: data.lang,
    data: { url: "./" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
