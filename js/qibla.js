// Qibla: Richtung und Entfernung zur Kaaba, Kompass-Sensor des Geräts.

export const KAABA = { lat: 21.4225, lng: 39.8262 };
const r = Math.PI / 180;

// Anfangsrichtung des Großkreises zur Kaaba, 0–360° (0 = Norden, im Uhrzeigersinn)
export function qiblaBearing(lat, lng) {
  const dLng = (KAABA.lng - lng) * r;
  const y = Math.sin(dLng) * Math.cos(KAABA.lat * r);
  const x = Math.cos(lat * r) * Math.sin(KAABA.lat * r) - Math.sin(lat * r) * Math.cos(KAABA.lat * r) * Math.cos(dLng);
  return (Math.atan2(y, x) / r + 360) % 360;
}

export function kaabaDistanceKm(lat, lng) {
  const c = Math.sin(lat * r) * Math.sin(KAABA.lat * r) + Math.cos(lat * r) * Math.cos(KAABA.lat * r) * Math.cos((KAABA.lng - lng) * r);
  return 6371 * Math.acos(Math.min(1, Math.max(-1, c)));
}

// Kleinster Winkel von a nach b, −180 … 180 (positiv = im Uhrzeigersinn)
export const angleDiff = (a, b) => ((b - a + 540) % 360) - 180;

// iPhone verlangt eine Erlaubnis, die nur aus einem Tippen heraus abgefragt werden darf.
export const needsPermission = () =>
  typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";

export async function requestPermission() {
  if (!needsPermission()) return true;
  try { return (await DeviceOrientationEvent.requestPermission()) === "granted"; } catch { return false; }
}

// Liefert die Kompassrichtung (Grad, geglättet) an onHeading. Rückgabe: Funktion zum Beenden.
export function watchHeading(onHeading) {
  let smooth = null;
  const push = h => {
    if (h == null || isNaN(h)) return;
    // Glättung über den Kreis (kein Sprung bei 359° → 0°)
    smooth = smooth == null ? h : (smooth + angleDiff(smooth, h) * 0.25 + 360) % 360;
    onHeading(smooth);
  };
  const ios = e => push(e.webkitCompassHeading);
  const abs = e => { if (e.absolute !== false && e.alpha != null) push((360 - e.alpha) % 360); };
  const screenFix = () => (screen.orientation?.angle || 0);
  const absWithScreen = e => { if (e.alpha != null) push((360 - e.alpha + screenFix()) % 360); };
  if ("ondeviceorientationabsolute" in window) {
    window.addEventListener("deviceorientationabsolute", absWithScreen);
    return () => window.removeEventListener("deviceorientationabsolute", absWithScreen);
  }
  const handler = e => (e.webkitCompassHeading != null ? ios(e) : abs(e));
  window.addEventListener("deviceorientation", handler);
  return () => window.removeEventListener("deviceorientation", handler);
}
