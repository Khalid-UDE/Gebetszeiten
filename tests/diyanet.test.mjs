import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRow, norm, nearestFromList } from "../js/diyanet.js";

// Zeile aus der offiziellen Tabelle für Essen (ID 11009)
const ROW = {
  MiladiTarihKisa: "14.10.2026", MiladiTarihUzunIso8601: "2026-10-14T00:00:00.0000000+02:00", GreenwichOrtalamaZamani: 3.0,
  Imsak: "06:03", Gunes: "07:47", Ogle: "13:23", Ikindi: "16:11", Aksam: "18:50", Yatsi: "20:20"
};

test("Diyanet-Zeile wird mit dem Versatz aus dem ISO-Datum gelesen", () => {
  const r = parseRow(ROW);
  assert.equal(r.date, "2026-10-14");
  assert.equal(r.times.fajr.toISOString(), "2026-10-14T04:03:00.000Z");
  assert.equal(r.times.isha.toISOString(), "2026-10-14T18:20:00.000Z");
  assert.equal(r.times.maghrib.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }), "18:50");
});

test("Namen werden vergleichbar gemacht", () => {
  assert.equal(norm("Düsseldorf"), "DUSSELDORF");
  assert.equal(norm("BARMEN(Wuppertal)"), "BARMEN");
  assert.equal(norm("İstanbul"), "ISTANBUL");
  assert.equal(norm("Bad Honnef am Rhein"), "BADHONNEFAMRHEIN");
});

test("nächstgelegener Ort", () => {
  const list = { 1: { n: "ESSEN", lat: 51.4556, lng: 7.0116 }, 2: { n: "OBERHAUSEN", lat: 51.4963, lng: 6.8638 }, 3: { n: "X", lat: null, lng: null } };
  assert.equal(nearestFromList(list, 51.47, 7.0).id, "1");
  assert.equal(nearestFromList(list, 51.5, 6.87).id, "2");
});
