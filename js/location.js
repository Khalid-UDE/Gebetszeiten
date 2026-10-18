// Standort: GPS des Geräts, Ortsname über OpenStreetMap (Nominatim), manuelle Ortssuche.

const NOMINATIM = "https://nominatim.openstreetmap.org";

export const geoSupported = () => "geolocation" in navigator;

export async function geoPermission() {
  try {
    const p = await navigator.permissions.query({ name: "geolocation" });
    return p.state; // "granted" | "denied" | "prompt"
  } catch { return "unknown"; }
}

// Fragt beim ersten Aufruf die System-Erlaubnis ab.
export function getPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
    );
  });
}

// Laufende Aktualisierung, solange die App offen ist.
export function watchPosition(onPos, onErr) {
  const id = navigator.geolocation.watchPosition(
    p => onPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
    e => onErr && onErr(e),
    { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function distanceKm(a, b) {
  const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

const placeName = a => a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state || "";

export async function reverseGeocode(lat, lng, locale) {
  const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=12&addressdetails=1&lat=${lat}&lon=${lng}&accept-language=${encodeURIComponent(locale)},en`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("geocode " + r.status);
  const j = await r.json();
  // Englische Adresse zusätzlich für den Abgleich mit Diyanet-Ortsnamen
  let en = j.address || {};
  if (!locale.startsWith("en")) {
    try {
      const r2 = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=12&addressdetails=1&lat=${lat}&lon=${lng}&accept-language=en`);
      if (r2.ok) en = (await r2.json()).address || en;
    } catch { /* optional */ }
  }
  return { name: placeName(j.address || {}) || j.name || "", address: en };
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
