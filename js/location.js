// Standort: GPS des Geräts, Ortsname über OpenStreetMap (Nominatim), manuelle Ortssuche.

const NOMINATIM = "https://nominatim.openstreetmap.org";

export const geoSupported = () => "geolocation" in navigator;

export async function geoPermission() {
  try {
    const p = await navigator.permissions.query({ name: "geolocation" });
    return p.state; // "granted" | "denied" | "prompt"
  } catch { return "unknown"; }
}

// Fragt beim ersten Aufruf die System-Erlaubnis ab. Erst GPS, bei Zeitüberschreitung WLAN/Funkzelle.
export async function getPosition() {
  const once = (high, timeout) => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      reject,
      { enableHighAccuracy: high, timeout, maximumAge: 30000 }
    );
  });
  try { return await once(true, 15000); }
  catch (e) { if (e.code === 1) throw e; return once(false, 20000); }
}

// Laufende Aktualisierung, solange die App offen ist.
export function watchPosition(onPos, onErr) {
  const id = navigator.geolocation.watchPosition(
    p => onPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
    e => onErr && onErr(e),
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function distanceKm(a, b) {
  const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

const placeName = a => a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state || "";

export async function reverseGeocode(lat, lng, locale) {
  try { return await nominatimReverse(lat, lng, locale); }
  catch (e) { console.warn("Nominatim", e); return await bigDataCloudReverse(lat, lng, locale); }
}

async function nominatimReverse(lat, lng, locale) {
  const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=12&addressdetails=1&lat=${lat}&lon=${lng}&accept-language=${encodeURIComponent(locale)},en`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("geocode " + r.status);
  const j = await r.json();
  if (!j.address) throw new Error("geocode leer");
  // Englische Adresse zusätzlich für den Abgleich mit Diyanet-Ortsnamen
  let en = j.address;
  if (!locale.startsWith("en")) {
    try {
      const r2 = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=12&addressdetails=1&lat=${lat}&lon=${lng}&accept-language=en`);
      if (r2.ok) en = (await r2.json()).address || en;
    } catch { /* optional */ }
  }
  return { name: placeName(j.address) || j.name || "", address: en };
}

// Ersatz, falls Nominatim ausfällt oder drosselt (frei nutzbar ohne Schlüssel)
async function bigDataCloudReverse(lat, lng, locale) {
  const get = async lang => {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=${lang}`);
    if (!r.ok) throw new Error("geocode2 " + r.status);
    return r.json();
  };
  const j = await get(locale.split("-")[0]);
  let en = j;
  try { en = await get("en"); } catch { /* optional */ }
  const name = j.city || j.locality || j.principalSubdivision || "";
  if (!name) throw new Error("geocode2 leer");
  return { name, address: { city: en.city || en.locality, state: en.principalSubdivision, country_code: (en.countryCode || "").toLowerCase() } };
}

export async function searchPlaces(q, locale) {
  const url = `${NOMINATIM}/search?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(q)}&accept-language=${encodeURIComponent(locale)},en`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("search " + r.status);
  return (await r.json()).map(x => ({
    lat: +x.lat, lng: +x.lon,
    name: placeName(x.address || {}) || x.name,
    label: x.display_name
  }));
}
