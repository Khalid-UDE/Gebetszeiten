// Offizielle Diyanet-Gebetszeiten.
// Quelle: ezanvakti.emushaf.net – frei zugänglicher Spiegel der Diyanet-Tabellen
// (gleiche Orts-IDs wie namazvakitleri.diyanet.gov.tr). Reines Modul ohne DOM.

export const DIYANET_API = "https://ezanvakti.emushaf.net";

const FIELD = { fajr: "Imsak", sunrise: "Gunes", dhuhr: "Ogle", asr: "Ikindi", maghrib: "Aksam", isha: "Yatsi" };

// Eine Zeile der Diyanet-Tabelle in Date-Objekte umwandeln.
// Die Uhrzeiten sind Ortszeit; der UTC-Versatz steht im ISO-Datum der Zeile (z. B. "+02:00").
export function parseRow(row) {
  const [d, m, y] = row.MiladiTarihKisa.split(".").map(Number);
  const iso = row.MiladiTarihUzunIso8601 || "";
  const om = /([+-])(\d{2}):(\d{2})$/.exec(iso);
  const offsetMin = om ? (om[1] === "-" ? -1 : 1) * (+om[2] * 60 + +om[3]) : Math.round((row.GreenwichOrtalamaZamani || 0) * 60);
  const times = {};
  for (const k in FIELD) {
    const [hh, mm] = row[FIELD[k]].split(":").map(Number);
    times[k] = new Date(Date.UTC(y, m - 1, d, hh, mm) - offsetMin * 60e3);
  }
  return { date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, times };
}

// Lädt die nächsten ~30 Tage für einen Diyanet-Ort.
// init: zusätzliche fetch-Optionen (der Server setzt einen User-Agent, der Browser nicht).
export async function fetchSchedule(ilceId, init = undefined) {
  const res = await fetch(`${DIYANET_API}/vakitler/${encodeURIComponent(ilceId)}`, init);
  if (!res.ok) throw new Error(`Diyanet ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error("Diyanet: keine Daten");
  return rows.map(parseRow);
}

// Namen vergleichbar machen: Großbuchstaben, ohne Akzente/Umlaute-Zeichen, nur A–Z.
export function norm(s) {
  return String(s || "")
    .replace(/ß/g, "SS").replace(/İ/g, "I").replace(/ı/g, "I")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/\(.*?\)/g, "").replace(/[^A-Z]/g, "");
}

const COUNTRY_ALIAS = {
  TR: "TURKIYE", BA: "BOSNIAHERZEGOVINA", CZ: "CZECHIA", US: "UNITEDSTATES", GB: "UNITEDKINGDOM",
  MK: "NORTHMACEDONIA", XK: "KOSOVO", CI: "COTEDIVOIRE", CD: "DEMOCRATICREPUBLICOFTHECONGO", KR: "SOUTHKOREA",
  KP: "NORTHKOREA", AE: "UNITEDARABEMIRATES", PS: "PALESTINE", RU: "RUSSIA", IR: "IRAN", SY: "SYRIA",
  VN: "VIETNAM", LA: "LAOS", MD: "MOLDOVA", TZ: "TANZANIA", BO: "BOLIVIA", VE: "VENEZUELA", CV: "CABOVERDE"
};

function countryKey(code) {
  const c = String(code || "").toUpperCase();
  if (COUNTRY_ALIAS[c]) return COUNTRY_ALIAS[c];
  try { return norm(new Intl.DisplayNames(["en"], { type: "region" }).of(c)); } catch { return ""; }
}

function pick(list, keyFns, candidates, fuzzy = true) {
  const cands = candidates.map(norm).filter(Boolean);
  for (const c of cands) for (const it of list) if (keyFns.some(f => norm(f(it)) === c)) return it;
  if (!fuzzy) return null;
  for (const c of cands) for (const it of list) if (c.length >= 4 && keyFns.some(f => { const n = norm(f(it)); return n.startsWith(c) || c.startsWith(n) && n.length >= 4; })) return it;
  return null;
}

const dist = (a, b, c, d) => {
  const r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};

// Nächstgelegener Diyanet-Ort aus einer Koordinatenliste ({id: {n, lat, lng}}).
export function nearestFromList(list, lat, lng) {
  let best = null;
  for (const id in list) {
    const p = list[id];
    if (p.lat == null) continue;
    const km = dist(lat, lng, p.lat, p.lng);
    if (!best || km < best.km) best = { id, name: p.n, km };
  }
  return best;
}

// Ähnlichkeit zweier Namen (Dice-Koeffizient über Buchstabenpaare), 0 … 1.
export function similarity(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const pairs = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const p = s.slice(i, i + 2); m.set(p, (m.get(p) || 0) + 1); } return m; };
  const pa = pairs(a), pb = pairs(b);
  let hit = 0;
  for (const [p, n] of pa) hit += Math.min(n, pb.get(p) || 0);
  return 2 * hit / Math.max(1, a.length - 1 + b.length - 1);
}

// Diyanet-Ort anhand der Adresse (aus der Rückwärtssuche, englisch) über die Namen finden.
export async function matchByAddress(address, fetchJson) {
  const key = countryKey(address.country_code);
  const countries = await fetchJson(`${DIYANET_API}/ulkeler`);
  const country = countries.find(c => norm(c.UlkeAdiEn) === key || norm(c.UlkeAdi) === key) ||
    countries.find(c => similarity(c.UlkeAdiEn, key) > 0.8);
  if (!country) return null;
  const states = await fetchJson(`${DIYANET_API}/sehirler/${country.UlkeID}`);
  const placeNames = [address.city, address.town, address.village, address.municipality, address.suburb, address.city_district, address.county].filter(Boolean);
  const stateNames = [address.state, address.province, address.region, address.county, address.city].filter(Boolean);

  // passendes Bundesland/Provinz: bester Namensvergleich
  let st = states.length === 1 ? states[0] : null, best = 0;
  if (!st) for (const s of states) for (const n of stateNames) {
    const sc = Math.max(similarity(s.SehirAdiEn, n), similarity(s.SehirAdi, n));
    if (sc > best) { best = sc; st = s; }
  }
  if (best && best < 0.6) st = null;

  const exact = (list, names) => pick(list, [x => x.IlceAdiEn, x => x.IlceAdi], names, false);
  if (st) {
    const districts = await fetchJson(`${DIYANET_API}/ilceler/${st.SehirID}`);
    const d = pick(districts, [x => x.IlceAdiEn, x => x.IlceAdi], placeNames, true) ||
      exact(districts, [st.SehirAdiEn, st.SehirAdi]);
    if (d) return { id: d.IlceID, name: d.IlceAdiEn || d.IlceAdi };
  }
  // ohne erkannte Provinz: alle Provinzen, aber nur exakte Treffer
  for (const s of states) {
    if (s === st) continue;
    const d = exact(await fetchJson(`${DIYANET_API}/ilceler/${s.SehirID}`), placeNames);
    if (d) return { id: d.IlceID, name: d.IlceAdiEn || d.IlceAdi };
  }
  return null;
}
