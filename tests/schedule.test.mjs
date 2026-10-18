import { test } from "node:test";
import assert from "node:assert/strict";
import { nextEvent, formatTime } from "../worker/src/schedule.js";
import { notificationText } from "../js/i18n.js";

const essen = { lat: 51.4556, lng: 7.0116, tz: "Europe/Berlin", method: "mwl",
  bells: { fajr: true, sunrise: false, dhuhr: true, asr: true, maghrib: true, isha: true } };
const at = s => new Date(s).getTime();

test("nächstes Gebet am Nachmittag ist Asr", () => {
  const n = nextEvent(essen, at("2026-10-18T13:30:00Z")); // 15:30 Ortszeit
  assert.equal(n.key, "asr");
  assert.equal(formatTime(n.at, essen.tz, "de-DE"), "15:59");
});

test("nach Isha folgt Fajr am nächsten Tag, Shuruq wird übersprungen", () => {
  const n = nextEvent(essen, at("2026-10-18T19:00:00Z")); // 21:00 Ortszeit
  assert.equal(n.key, "fajr");
  assert.equal(new Date(n.at).toISOString().slice(0, 10), "2026-10-19");
  const m = nextEvent(essen, n.at + 60e3);
  assert.equal(m.key, "dhuhr");
});

test("ohne aktive Glocken gibt es keine Benachrichtigung", () => {
  assert.equal(nextEvent({ ...essen, bells: {} }, Date.now()), null);
});

test("offizielle Diyanet-Daten haben Vorrang", () => {
  const day = { fajr: new Date("2026-10-18T04:09:00Z"), sunrise: new Date("2026-10-18T05:53:00Z"), dhuhr: new Date("2026-10-18T11:22:00Z"),
    asr: new Date("2026-10-18T14:04:00Z"), maghrib: new Date("2026-10-18T16:41:00Z"), isha: new Date("2026-10-18T18:12:00Z") };
  const n = nextEvent({ ...essen, method: "diyanet" }, at("2026-10-18T13:30:00Z"), { "2026-10-18": day });
  assert.equal(formatTime(n.at, essen.tz, "de-DE"), "16:04");
});

test("Benachrichtigungstexte je Sprache", () => {
  assert.deepEqual(notificationText("std", "asr", "15:59"), { title: "Asr · العصر · 15:59", body: "Es ist Zeit für Asr" });
  assert.equal(notificationText("de", "asr", "15:59").title, "Nachmittagsgebet · 15:59");
  assert.equal(notificationText("tr", "isha", "20:12").body, "Yatsı namazı vakti girdi");
});
