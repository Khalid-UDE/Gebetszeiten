// Push-Server der Gebetszeiten-App (Cloudflare Worker + D1 + Cron jede Minute).
import { PRAYER_KEYS } from "../../js/praytimes.js";
import { LANGS, notificationText } from "../../js/i18n.js";
import { fetchSchedule } from "../../js/diyanet.js";
import { sendPush } from "./webpush.js";
import { nextEvent, formatTime } from "./schedule.js";
import { handleCron } from "./cron.js";

function cors(env, req) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });

function validTz(tz) {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}

// Eingaben der App prüfen und auf das Nötige reduzieren.
function parseSub(body) {
  const s = body?.subscription;
  if (!s || typeof s.endpoint !== "string" || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000) throw new Error("subscription");
  if (typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") throw new Error("keys");
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw new Error("position");
  const tz = String(body.tz || "UTC");
  if (!validTz(tz)) throw new Error("tz");
  const method = body.method === "diyanet" ? "diyanet" : "mwl";
  const diyanetId = method === "diyanet" && /^\d{1,7}$/.test(String(body.diyanetId || "")) ? String(body.diyanetId) : null;
  const lang = LANGS[body.lang] ? body.lang : "std";
  const bells = {};
  for (const k of PRAYER_KEYS) bells[k] = Boolean(body.bells?.[k]);
  const previousEndpoint = typeof body.previousEndpoint === "string" && /^https:\/\//.test(body.previousEndpoint) ? body.previousEndpoint.slice(0, 1000) : null;
  return { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, lat, lng, tz, method, diyanetId, lang, bells, previousEndpoint };
}

// Offizielle Diyanet-Tabelle, in D1 zwischengespeichert (max. 12 h alt).
async function diyanetDays(env, id) {
  if (!id) return null;
  const row = await env.DB.prepare("SELECT fetched_at, data FROM diyanet WHERE id = ?").bind(id).first();
  let rows = row ? JSON.parse(row.data) : null;
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  if (!rows || Date.now() - row.fetched_at > 12 * 36e5 || !rows.some(r => r.date >= tomorrow)) {
    try {
      const fresh = await fetchSchedule(id, { headers: { "User-Agent": "Gebetszeiten-Push/1.0 (+https://github.com/Khalid-UDE/Gebetszeiten)", Accept: "application/json" } });
      rows = fresh.map(r => ({ date: r.date, times: Object.fromEntries(Object.entries(r.times).map(([k, d]) => [k, d.getTime()])) }));
      await env.DB.prepare("INSERT OR REPLACE INTO diyanet (id, fetched_at, data) VALUES (?, ?, ?)").bind(id, Date.now(), JSON.stringify(rows)).run();
    } catch (e) {
      console.log("diyanet fetch failed", id, String(e));
      if (!rows) return null;
    }
  }
  const out = {};
  for (const r of rows) out[r.date] = Object.fromEntries(Object.entries(r.times).map(([k, ms]) => [k, new Date(ms)]));
  return out;
}

async function planNext(env, sub, afterMs) {
  const days = sub.method === "diyanet" ? await diyanetDays(env, sub.diyanetId) : null;
  return nextEvent(sub, afterMs, days);
}

// Fehler des Push-Dienstes festhalten (nur Dienst-Host, Status, Begründung), letzte 50
async function logFailure(env, endpoint, status, reason) {
  try {
    await env.DB.prepare("INSERT INTO log (t, host, status, reason) VALUES (?, ?, ?, ?)")
      .bind(Date.now(), new URL(endpoint).host, status, String(reason || "").slice(0, 300)).run();
    await env.DB.prepare("DELETE FROM log WHERE t NOT IN (SELECT t FROM log ORDER BY t DESC LIMIT 50)").run();
  } catch (e) { console.log("log failed", String(e)); }
}

const rowToSub = r => ({
  endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth, lat: r.lat, lng: r.lng, tz: r.tz, method: r.method,
  diyanetId: r.diyanet_id, lang: r.lang, bells: JSON.parse(r.bells || "{}")
});

function pushOptions(env) {
  return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || "https://github.com/Khalid-UDE/Gebetszeiten" };
}

function message(sub, key, atMs) {
  const L = LANGS[sub.lang] || LANGS.std;
  const { title, body } = notificationText(sub.lang, key, formatTime(atMs, sub.tz, L.locale));
  return { title, body, tag: `gz-${key}`, lang: L.locale };
}

async function upsert(env, sub) {
  // Ein schon verschickter Termin wird nicht erneut geplant – z. B. wenn die App
  // durch Tippen auf genau diese Benachrichtigung geöffnet wird, kurz bevor es so weit ist.
  const prev = await env.DB.prepare("SELECT sent_for FROM subs WHERE endpoint = ?").bind(sub.endpoint).first();
  const after = Math.max(Date.now(), (prev?.sent_for || 0) + 30e3);
  const next = await planNext(env, sub, after);
  if (sub.previousEndpoint && sub.previousEndpoint !== sub.endpoint) {
    await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(sub.previousEndpoint).run();
  }
  await env.DB.prepare(`INSERT INTO subs (endpoint, p256dh, auth, lat, lng, tz, method, diyanet_id, lang, bells, next_at, next_key, updated_at, fails)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 0)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh=?2, auth=?3, lat=?4, lng=?5, tz=?6, method=?7, diyanet_id=?8, lang=?9, bells=?10, next_at=?11, next_key=?12, updated_at=?13, fails=0`)
    .bind(sub.endpoint, sub.p256dh, sub.auth, sub.lat, sub.lng, sub.tz, sub.method, sub.diyanetId, sub.lang, JSON.stringify(sub.bells),
      next ? next.at : null, next ? next.key : null, Date.now())
    .run();
  return next;
}

export default {
  async fetch(req, env) {
    const headers = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const { pathname } = new URL(req.url);
    try {
      if (req.method === "GET" && pathname === "/vapid") return json({ publicKey: env.VAPID_PUBLIC_KEY || "" }, 200, headers);
      if (req.method === "GET" && pathname === "/") return json({ ok: true, service: "gebetszeiten-push" }, 200, headers);
      if (req.method !== "POST") return json({ error: "not found" }, 404, headers);
      const text = await req.text();
      if (text.length > 8000) return json({ error: "too large" }, 413, headers);
      const body = JSON.parse(text || "{}");

      if (pathname === "/subscribe") {
        const next = await upsert(env, parseSub(body));
        return json({ ok: true, next: next ? { at: next.at, key: next.key } : null }, 200, headers);
      }
      if (pathname === "/unsubscribe") {
        if (typeof body.endpoint === "string") await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(body.endpoint).run();
        return json({ ok: true }, 200, headers);
      }
      if (pathname === "/test") {
        const sub = parseSub(body);
        const next = await upsert(env, sub);
        const key = next?.key || "dhuhr";
        try {
          const { status, reason } = await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            { ...message(sub, key, next?.at || Date.now()), tag: "gz-test" }, pushOptions(env));
          if (status >= 300) await logFailure(env, sub.endpoint, status, reason);
          return json({ ok: status >= 200 && status < 300, status, reason }, 200, headers);
        } catch (e) {
          await logFailure(env, sub.endpoint, 0, String(e.message || e));
          return json({ ok: false, status: 0, reason: String(e.message || e) }, 200, headers);
        }
      }
      return json({ error: "not found" }, 404, headers);
    } catch (e) {
      return json({ error: String(e.message || e) }, 400, headers);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env, { planNext, message, logFailure, pushOptions, send: sendPush, rowToSub }));
  }
};
