// Nächste fällige Benachrichtigung für ein Abo bestimmen.
import { PRAYER_KEYS, computeDay, ymdInZone, addDays, ymdKey } from "../../js/praytimes.js";

// sub: {lat, lng, tz, method, bells}; diyanetDays: {"YYYY-MM-DD": {key: Date}} oder null
export function nextEvent(sub, afterMs, diyanetDays = null) {
  const bells = sub.bells || {};
  const start = ymdInZone(new Date(afterMs), sub.tz);
  for (let i = -1; i <= 2; i++) {
    const ymd = addDays(start, i);
    const official = sub.method === "diyanet" && diyanetDays ? diyanetDays[ymdKey(ymd)] : null;
    const times = official || computeDay(ymd, sub.lat, sub.lng, sub.method);
    for (const k of PRAYER_KEYS) {
      if (!bells[k]) continue;
      const t = times[k].getTime();
      if (t > afterMs) return { at: t, key: k };
    }
  }
  return null;
}

export function formatTime(ms, tz, locale) {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
}
