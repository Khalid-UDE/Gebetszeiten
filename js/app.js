import { PRAYER_KEYS, computeDay, ymdInZone, addDays, ymdKey } from "./praytimes.js";
import { LANGS, LANG_ORDER, METHOD_LABELS, ARABIC_NAMES, getLang, fmt, detectLang, notificationText } from "./i18n.js";
import { fetchSchedule, nearestFromList, matchByAddress } from "./diyanet.js";
import { geoSupported, geoPermission, getPosition, watchPosition, distanceKm, reverseGeocode, searchPlaces } from "./location.js";
import { pushSupported, isIOS, isStandalone, permission, serverConfigured, currentSubscription, enablePush, syncSubscription, sendTest, prefetchKey } from "./push.js";

const $ = id => document.getElementById(id);
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const STORE = "gz-state-v2";

// ---------- Zustand ----------
const state = {
  lang: detectLang(navigator.languages || [navigator.language]),
  method: "mwl",
  place: null,          // {lat, lng, name, manual, address}
  diy: null,            // {id, name, lat, lng} – gewählter Diyanet-Ort
  bells: { fajr: true, sunrise: false, dhuhr: true, asr: true, maghrib: true, isha: true },
  onboarded: false,
  theme: "system",      // "system" | "light" | "dark"
  geo: "unknown"        // Erlaubnisstatus Standort
};
try { Object.assign(state, JSON.parse(localStorage.getItem(STORE) || "{}")); } catch { /* frischer Start */ }
if (!LANGS[state.lang]) state.lang = "std";
if (!METHOD_LABELS[state.method]) state.method = "mwl";
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* privat */ } };

const L = () => getLang(state.lang);
const T = (k, v) => fmt(L().ui[k] ?? LANGS.std.ui[k] ?? k, v);

// ---------- Diyanet: Ort und offizielle Tabelle ----------
let schedule = null; // {id, byDate: {"YYYY-MM-DD": {k: Date}}}

const cacheGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const cacheSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* voll */ } };

async function fetchJsonCached(url) {
  const key = "gz-c-" + url;
  const hit = cacheGet(key);
  if (hit && Date.now() - hit.t < 30 * 864e5) return hit.v;
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  const v = await r.json();
  cacheSet(key, { t: Date.now(), v });
  return v;
}

let deList = null;
async function resolveDiyanet() {
  const p = state.place;
  if (!p) return;
  if (state.diy && distanceKm(state.diy, p) < 3) return;
  let found = null;
  try {
    if ((p.address?.country_code || "").toLowerCase() === "de") {
      deList = deList || await (await fetch("data/diyanet-de.json")).json();
      const n = nearestFromList(deList, p.lat, p.lng);
      if (n && n.km <= 60) found = { id: n.id, name: n.name };
    }
    if (!found && p.address) found = await matchByAddress(p.address, fetchJsonCached);
  } catch (e) { console.warn("Diyanet-Ort", e); }
  state.diy = found ? { ...found, lat: p.lat, lng: p.lng } : null;
  save();
}

async function loadSchedule() {
  if (state.method !== "diyanet" || !state.diy) { schedule = null; return; }
  const id = state.diy.id, key = "gz-diy-" + id;
  const tomorrow = ymdKey(addDays(ymdInZone(new Date(), TZ), 1));
  let c = cacheGet(key);
  const fresh = c && Date.now() - c.t < 12 * 36e5 && c.rows.some(r => r.date === tomorrow);
  if (!fresh) {
    try {
      const rows = await fetchSchedule(id);
      c = { t: Date.now(), rows: rows.map(r => ({ date: r.date, times: Object.fromEntries(Object.entries(r.times).map(([k, d]) => [k, d.toISOString()])) })) };
      cacheSet(key, c);
    } catch (e) { console.warn("Diyanet-Zeiten", e); }
  }
  if (!c) { schedule = null; return; }
  const byDate = {};
  for (const r of c.rows) byDate[r.date] = Object.fromEntries(Object.entries(r.times).map(([k, s]) => [k, new Date(s)]));
  schedule = { id, byDate };
}

function dayTimes(ymd) {
  const p = state.place;
  if (state.method === "diyanet" && schedule?.byDate[ymdKey(ymd)]) return { times: schedule.byDate[ymdKey(ymd)], src: "official" };
  return { times: computeDay(ymd, p.lat, p.lng, state.method), src: state.method === "diyanet" ? "approx" : "calc" };
}

// ---------- Standort ----------
async function setPlace(pos, manual, knownName) {
  const prev = state.place;
  const moved = !prev || distanceKm(prev, pos) > 1 || prev.manual !== manual;
  if (!moved && prev.name) return;
  let name = knownName || prev?.name || "", address = prev?.address;
  if (moved || !name) {
    try { const g = await reverseGeocode(pos.lat, pos.lng, L().locale); name = knownName || g.name; address = g.address; }
    catch (e) { console.warn("Ortsname", e); }
  }
  state.place = { lat: +pos.lat.toFixed(4), lng: +pos.lng.toFixed(4), name, manual, address };
  save();
  await afterPlaceOrMethodChange();
}

async function afterPlaceOrMethodChange() {
  if (state.method === "diyanet") { await resolveDiyanet(); await loadSchedule(); }
  render();
  syncServer();
}

let stopWatch = null;
function startWatching() {
  if (stopWatch || !geoSupported() || state.place?.manual) return;
  stopWatch = watchPosition(
    pos => { state.geo = "granted"; setPlace(pos, false); },
    err => { if (err.code === 1) { state.geo = "denied"; stopWatch?.(); stopWatch = null; save(); render(); } }
  );
}

async function requestLocation() {
  try {
    const pos = await getPosition();
    state.geo = "granted";
    await setPlace(pos, false);
    startWatching();
    return true;
  } catch (e) {
    state.geo = e.code === 1 ? "denied" : state.geo;
    save(); render();
    return false;
  }
}

// ---------- Push ----------
let syncTimer = null;
function syncServer() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    scheduleLocal();
    if (!state.place || permission() !== "granted") return;
    try {
      // Erlaubnis liegt schon vor (z. B. bevor der Server eingerichtet war) → Abo nachholen
      const sub = (await currentSubscription()) || (serverConfigured() ? await enablePush() : null);
      await syncSubscription(sub, serverPayload());
    } catch (e) { console.warn("Push-Sync", e); }
  }, 800);
}

const serverPayload = () => ({
  lat: state.place.lat, lng: state.place.lng, tz: TZ, method: state.method,
  diyanetId: state.method === "diyanet" ? state.diy?.id || null : null,
  lang: state.lang, bells: state.bells
});

async function turnOnNotifications() {
  if (!pushSupported()) { render(); return; }
  try {
    const sub = await enablePush();
    if (sub && sub !== "local" && state.place) await syncSubscription(sub, serverPayload());
  } catch (e) {
    console.warn("Push", e);
    showTestResult(T("testFailed", { msg: e.message || String(e) }), false);
  }
  render();
  syncServer();
}

// Ohne Push-Server: Erinnerungen, solange die App geöffnet ist.
let localTimers = [];
function scheduleLocal() {
  localTimers.forEach(clearTimeout); localTimers = [];
  if (serverConfigured() || permission() !== "granted" || !state.place) return;
  const now = Date.now(), ymd = ymdInZone(new Date(), TZ);
  for (const d of [ymd, addDays(ymd, 1)]) {
    const { times } = dayTimes(d);
    for (const k of PRAYER_KEYS) {
      const ms = times[k] - now;
      if (!state.bells[k] || ms <= 0 || ms > 864e5) continue;
      localTimers.push(setTimeout(async () => {
        const { title, body } = notificationText(state.lang, k, fmtTime(times[k]));
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(title, { body, icon: "icons/icon-192.png", badge: "icons/badge-72.png", tag: "gz-" + k, lang: L().locale });
      }, ms));
    }
  }
}

// ---------- Darstellung ----------
const fmtTime = d => new Intl.DateTimeFormat(L().locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
function durText(ms) {
  const m = Math.max(0, Math.ceil(ms / 60e3)), h = Math.floor(m / 60), r = m % 60;
  return h ? T("hours", { h, m: r }) : T("minutes", { m: r });
}
// "BARMEN(Wuppertal)" → "Barmen (Wuppertal)"
const pretty = s => String(s || "").toLocaleLowerCase("de").replace(/\(/g, " (").replace(/\s+/g, " ")
  .replace(/(^|[\s(\-/])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase("de"));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const BELL_ON = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>';
const BELL_OFF = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.7 3.6A6 6 0 0 1 18 8c0 2.6.4 4.5 1 5.9"/><path d="M17 17H3s3-2 3-9c0-.6.1-1.2.3-1.8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/><path d="M2 2l20 20"/></svg>';

function applyTheme() {
  const t = state.theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const forced = t === "dark" ? "#121615" : t === "light" ? "#F2F4F1" : null;
  $("tcLight").content = forced || "#F2F4F1";
  $("tcDark").content = forced || "#121615";
  document.querySelectorAll("[data-theme-choice]").forEach(b => b.setAttribute("aria-pressed", b.dataset.themeChoice === (t || "system")));
}

function showTestResult(text, ok) {
  const el = $("testResult");
  el.textContent = text;
  el.className = "small " + (ok ? "ok" : "muted");
  el.hidden = !text;
}

function applyLanguage() {
  const lang = L();
  document.documentElement.lang = lang.locale.slice(0, 2);
  document.documentElement.dir = lang.dir;
  document.querySelectorAll("[data-t]").forEach(el => { el.textContent = T(el.dataset.t); });
  $("searchInput").placeholder = T("searchPlaceholder");
  document.title = T("appTitle");
}

function renderChips() {
  $("methodChips").innerHTML = Object.entries(METHOD_LABELS).map(([k, v]) =>
    `<button type="button" class="chip" data-method="${k}" aria-pressed="${k === state.method}">${v}</button>`).join("");
  $("langChips").innerHTML = LANG_ORDER.map(k =>
    `<button type="button" class="chip" data-lang="${k}" lang="${LANGS[k].locale.slice(0, 2)}" aria-pressed="${k === state.lang}">${LANGS[k].label}</button>`).join("");
}

function renderNotifState() {
  const perm = permission();
  const needsInstall = isIOS() && !isStandalone();
  document.querySelectorAll("[data-ios-hint]").forEach(el => { el.hidden = !needsInstall; });
  let txt, showBtn = false;
  if (!pushSupported()) txt = needsInstall ? "" : T("notifUnsupported");
  else if (perm === "denied") txt = T("notifBlocked");
  else if (perm === "granted") txt = serverConfigured() ? T("notifOn") : T("notifNoServer");
  else { txt = T("notifOff"); showBtn = true; }
  $("notifState").textContent = txt;
  $("notifState").hidden = !txt;
  $("btnNotif").hidden = !showBtn;
  $("btnTest").hidden = !(perm === "granted" && serverConfigured());
  $("obNotif").hidden = perm === "granted" || !pushSupported();
  $("obNotifState").hidden = perm !== "granted";
  $("obNotifState").textContent = perm === "granted" ? "✓ " + T("notifOn") : "";
}

function render() {
  const lang = L(), now = new Date();
  applyLanguage();
  applyTheme();
  renderChips();
  renderNotifState();

  $("onboarding").hidden = state.onboarded;
  $("main").hidden = !state.onboarded;
  $("obLocationState").hidden = !state.place;
  $("obLocation").hidden = $("obManual").hidden = Boolean(state.place);
  $("obLocationState").textContent = state.place ? `✓ ${state.place.name || ""}` : "";
  $("obDone").textContent = state.place ? T("done") : T("later");

  $("today").textContent = new Intl.DateTimeFormat(lang.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  try {
    $("hijri").textContent = new Intl.DateTimeFormat(lang.locale + "-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(now);
  } catch { $("hijri").textContent = ""; }

  // Standort-Block
  const p = state.place;
  $("locName").textContent = p ? (p.name || `${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`) : T("locationNone");
  $("locState").textContent = !p ? (state.geo === "denied" ? T("locationDenied") : "") : p.manual ? T("locationManual") : T("locationAuto");
  $("locLive").hidden = !p || p.manual;
  $("btnGps").hidden = Boolean(p && !p.manual) || !geoSupported();

  if (!p) {
    $("nextLbl").textContent = T("nextPrayer");
    $("nextName").textContent = "–"; $("nextTime").textContent = ""; $("nextCd").textContent = T("locationNone");
    $("times").innerHTML = ""; $("locSummary").textContent = ""; $("foot").textContent = "";
    return;
  }

  const ymd = ymdInZone(now, TZ);
  const today = dayTimes(ymd), tomorrow = dayTimes(addDays(ymd, 1));
  const prayers = PRAYER_KEYS.filter(k => k !== "sunrise");
  let nextKey = prayers.find(k => today.times[k] > now);
  const isTomorrow = !nextKey;
  const nextDate = isTomorrow ? tomorrow.times.fajr : today.times[nextKey];
  if (isTomorrow) nextKey = "fajr";
  let current = null;
  for (const k of PRAYER_KEYS) if (today.times[k] <= now) current = k;
  if (current === "sunrise") current = null;

  $("nextLbl").textContent = isTomorrow ? T("nextPrayerTomorrow") : T("nextPrayer");
  $("nextName").textContent = lang.names[nextKey];
  $("nextTime").textContent = fmtTime(nextDate);
  $("nextCd").textContent = `${T("inDuration", { d: durText(nextDate - now) })} · ${p.name || ""}`.replace(/ · $/, "");

  $("times").innerHTML = PRAYER_KEYS.map(k => {
    const past = today.times[k] <= now && k !== current;
    const cls = ["row", k === "sunrise" ? "sun" : "", k === current ? "now" : "", past ? "past" : ""].join(" ");
    const name = esc(lang.names[k]);
    const on = Boolean(state.bells[k]);
    return `<li class="${cls}">
      <span class="pname">${name}${lang.arabic ? `<span class="ar" lang="ar">${ARABIC_NAMES[k]}</span>` : ""}</span>
      <span class="ptime">${fmtTime(today.times[k])}</span>
      <button type="button" class="bell" data-bell="${k}" aria-pressed="${on}" aria-label="${esc(T(on ? "bellOn" : "bellOff", { name: lang.names[k] }))}">${on ? BELL_ON : BELL_OFF}</button>
    </li>`;
  }).join("");

  $("locSummary").textContent = `${p.name || ""}${p.manual ? "" : " · GPS"}`;
  $("foot").textContent = today.src === "official" ? T("sourceOfficial", { place: pretty(state.diy?.name) })
    : today.src === "approx" ? T("sourceApprox") : T("sourceCalc");
}

// ---------- Ereignisse ----------
document.addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.themeChoice) { state.theme = b.dataset.themeChoice; save(); applyTheme(); return; }
  if (b.dataset.method) { state.method = b.dataset.method; save(); await afterPlaceOrMethodChange(); return; }
  if (b.dataset.lang) {
    state.lang = b.dataset.lang; save(); render(); syncServer();
    if (state.place && !state.place.manual) { state.place.name = ""; setPlace(state.place, false); }
    return;
  }
  if (b.dataset.bell) {
    const k = b.dataset.bell;
    state.bells[k] = !state.bells[k]; save(); render();
    if (state.bells[k] && permission() === "default") await turnOnNotifications();
    syncServer();
    return;
  }
  switch (b.id) {
    case "obLocation": b.disabled = true; await requestLocation(); b.disabled = false; break;
    case "obManual": state.onboarded = true; save(); render(); openSearch(); break;
    case "obNotif": case "btnNotif": await turnOnNotifications(); break;
    case "obDone": state.onboarded = true; save(); render(); break;
    case "btnGps": if (state.place) state.place.manual = false; await requestLocation(); break;
    case "btnSearch": openSearch(); break;
    case "btnTest": {
      // Tippen = Nutzeraktion: fehlendes Abo hier nachholen (iOS verlangt das)
      b.disabled = true;
      try {
        const sub = (await currentSubscription()) || await enablePush();
        if (!sub || sub === "local") throw new Error(permission() === "granted" ? "kein Push-Abo" : T("notifBlocked"));
        if (!state.place) throw new Error(T("locationNone"));
        await syncSubscription(sub, serverPayload());
        const r = await sendTest(sub, serverPayload());
        showTestResult(r.ok ? T("testSent") : T("testFailed", { msg: `${r.status || ""} ${r.reason || ""}`.trim() }), r.ok);
      } catch (err) {
        showTestResult(T("testFailed", { msg: err.message || String(err) }), false);
      }
      b.disabled = false;
      break;
    }
  }
});

function openSearch() {
  $("searchForm").hidden = false;
  $("searchInput").focus();
}

$("searchForm").addEventListener("submit", async e => {
  e.preventDefault();
  const q = $("searchInput").value.trim();
  if (!q) return;
  const ul = $("searchResults");
  ul.hidden = false;
  try {
    const res = await searchPlaces(q, L().locale);
    ul.innerHTML = res.length ? res.map((r, i) => `<li><button type="button" data-res="${i}">${esc(r.label)}</button></li>`).join("")
      : `<li class="empty">${esc(T("noResults"))}</li>`;
    ul.onclick = async ev => {
      const btn = ev.target.closest("[data-res]");
      if (!btn) return;
      const r = res[+btn.dataset.res];
      ul.hidden = true; $("searchForm").hidden = true; $("searchInput").value = "";
      stopWatch?.(); stopWatch = null;
      state.diy = null;
      await setPlace(r, true, r.name);
    };
  } catch { ul.innerHTML = `<li class="empty">${esc(T("noResults"))}</li>`; }
});

// ---------- Start ----------
async function init() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(e => console.warn("SW", e));
  prefetchKey();
  // Neue App-Version übernommen → einmal neu laden, damit alle Dateien zusammenpassen
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
  }
  render();
  if (geoSupported() && !state.place?.manual) {
    const perm = await geoPermission();
    if (perm === "granted" || (perm === "unknown" && state.geo === "granted")) { state.geo = "granted"; requestLocation(); }
    else if (perm === "denied") state.geo = "denied";
  }
  if (state.method === "diyanet") { await resolveDiyanet(); await loadSchedule(); }
  render();
  syncServer();
  // jede Viertelminute neu zeichnen, jede Stunde Diyanet-Daten prüfen
  setInterval(render, 15e3);
  setInterval(async () => { await loadSchedule(); render(); syncServer(); }, 36e5);
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) return;
    if (state.geo === "granted" && !state.place?.manual) requestLocation();
    await loadSchedule(); render();
  });
}
init();
