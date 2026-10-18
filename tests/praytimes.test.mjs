// Muslim World League: Referenzwerte von aladhan.com (method=3, school=0, Winkelmethode für hohe Breiten),
// abgerufen am 18.10.2026. Erlaubt sind ±2 min (Rundung der Quellen).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDay } from "../js/praytimes.js";

const fmt = d => d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const mins = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

const REF = [
  ["Essen", 51.4556, 7.0116, "2026-10-18", ["06:10", "08:01", "13:17", "16:01", "18:32", "20:17"]],
  ["Essen", 51.4556, 7.0116, "2027-06-21", ["03:02", "05:15", "13:34", "17:56", "21:53", "23:58"]],
  ["Berlin", 52.52, 13.405, "2026-12-21", ["06:07", "08:15", "12:04", "13:39", "15:54", "17:55"]],
  ["Kiel", 54.3233, 10.1228, "2027-06-21", ["02:43", "04:45", "13:21", "17:50", "21:58", "23:53"]],
  ["München", 48.1351, 11.582, "2027-03-20", ["04:32", "06:17", "12:21", "15:41", "18:26", "20:05"]],
  ["Freiburg", 47.999, 7.842, "2026-10-18", ["06:09", "07:52", "13:14", "16:05", "18:35", "20:12"]]
];
const KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

for (const [city, lat, lng, date, ref] of REF) {
  test(`MWL ${city} ${date}`, () => {
    const [y, m, d] = date.split("-").map(Number);
    const t = computeDay({ y, m, d }, lat, lng, "mwl");
    KEYS.forEach((k, i) => {
      const diff = Math.abs(mins(fmt(t[k])) - mins(ref[i]));
      assert.ok(diff <= 2, `${k}: ${fmt(t[k])} statt ${ref[i]}`);
    });
  });
}
