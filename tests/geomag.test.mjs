// World Magnetic Model 2025: Vergleich mit den offiziellen NOAA-Testwerten (WMM2025_TestValues.txt)
import { test } from "node:test";
import assert from "node:assert/strict";
import { declination } from "../js/geomag.js";

// Jahr, Höhe (km), Breite, Länge, Missweisung (°) – Auszug aus den offiziellen Testwerten
const OFFICIAL = [
  [2025.0, 28, 89, -121, -99.77], [2025.0, 48, 80, -96, -29.91], [2025.0, 54, 82, 87, 54.89],
  [2025.0, 65, 43, 93, 0.50], [2025.0, 51, -33, 109, -5.49], [2025.0, 39, -59, -8, -15.75], [2025.0, 3, -50, -103, 27.96]
];

test("Missweisung stimmt mit den offiziellen WMM2025-Testwerten", () => {
  for (const [y, h, lat, lng, d] of OFFICIAL) {
    const got = declination(lat, lng, y, h);
    assert.ok(Math.abs(got - d) <= 0.01, `${lat},${lng}: ${got.toFixed(3)} statt ${d}`);
  }
});

test("Missweisung in Deutschland ist östlich und klein", () => {
  const d = declination(51.4556, 7.0116, 2026.8);
  assert.ok(d > 2.5 && d < 4.5, `Essen: ${d}`);
});
