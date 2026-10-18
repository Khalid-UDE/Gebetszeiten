// Gebetszeiten-Berechnung (Algorithmus nach praytimes.org).
// Reines ES-Modul ohne DOM – wird von der App und vom Push-Worker genutzt.

export const PRAYER_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

// Diyanet wird bevorzugt über die offiziellen Tabellen geladen (siehe diyanet.js).
// Diese Werte sind nur die Näherung, falls keine offiziellen Daten verfügbar sind.
export const METHODS = {
  mwl: { fajr: 18, isha: 17, adj: {} },
  diyanet: { fajr: 18, isha: 17, adj: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 } }
};

const d2r = d => d * Math.PI / 180, r2d = r => r * 180 / Math.PI;
const sin = d => Math.sin(d2r(d)), cos = d => Math.cos(d2r(d)), tan = d => Math.tan(d2r(d));
const asin = x => r2d(Math.asin(x)), acos = x => r2d(Math.acos(x)), atan2 = (y, x) => r2d(Math.atan2(y, x));
const acot = x => r2d(Math.atan(1 / x));
const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
const fixAngle = a => fix(a, 360), fixHour = a => fix(a, 24);

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPos(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
  return { eqt: q / 15 - fixHour(RA), decl: asin(sin(e) * sin(L)) };
}

// Zeiten in Stunden UTC für das Kalenderdatum y-m-d am Ort lat/lng (Asr: Standard, Schattenfaktor 1).
export function computeHours(y, m, d, lat, lng, methodKey = "mwl") {
  const M = METHODS[methodKey] || METHODS.mwl;
  const jd = julian(y, m, d) - lng / (15 * 24);
  const midDay = t => fixHour(12 - sunPos(jd + t).eqt);
  const angleTime = (angle, t, ccw) => {
    const decl = sunPos(jd + t).decl, noon = midDay(t);
    const T = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return noon + (ccw ? -T : T);
  };
  const asrTime = t => { const decl = sunPos(jd + t).decl; return angleTime(-acot(1 + tan(Math.abs(lat - decl))), t); };

  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  const p = k => t[k] / 24;
  t = {
    fajr: angleTime(M.fajr, p("fajr"), true),
    sunrise: angleTime(0.833, p("sunrise"), true),
    dhuhr: midDay(p("dhuhr")),
    asr: asrTime(p("asr")),
    sunset: angleTime(0.833, p("sunset")),
    isha: angleTime(M.isha, p("isha"))
  };
  for (const k in t) t[k] += -lng / 15;
  // hohe Breiten: Winkelmethode
  const night = fixHour(t.sunrise - t.sunset);
  const adj = (time, base, angle, ccw) => {
    const portion = angle / 60 * night;
    const diff = ccw ? fixHour(base - time) : fixHour(time - base);
    return (isNaN(time) || diff > portion) ? base + (ccw ? -portion : portion) : time;
  };
  t.fajr = adj(t.fajr, t.sunrise, M.fajr, true);
  t.isha = adj(t.isha, t.sunset, M.isha, false);
  t.maghrib = t.sunset;
  delete t.sunset;
  for (const k in M.adj) t[k] += M.adj[k] / 60;
  return t;
}

// Kalenderdatum (y, m, d) in einer IANA-Zeitzone zu einem Zeitpunkt.
export function ymdInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const g = t => +parts.find(p => p.type === t).value;
  return { y: g("year"), m: g("month"), d: g("day") };
}

export function addDays(ymd, n) {
  const dt = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + n, 12));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export const ymdKey = ymd => `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;

// Gebetszeiten eines Tages als Date-Objekte (auf die Minute gerundet).
export function computeDay(ymd, lat, lng, methodKey = "mwl") {
  const h = computeHours(ymd.y, ymd.m, ymd.d, lat, lng, methodKey);
  const out = {};
  for (const k of PRAYER_KEYS) out[k] = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d) + Math.round(h[k] * 60) * 60e3);
  return out;
}
