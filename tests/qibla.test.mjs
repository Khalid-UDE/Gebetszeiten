import { test } from "node:test";
import assert from "node:assert/strict";
import { qiblaBearing, kaabaDistanceKm, angleDiff } from "../js/qibla.js";

// Referenzwerte: Großkreis-Peilung zur Kaaba (21.4225 N, 39.8262 E)
test("Qibla-Richtung", () => {
  const near = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a.toFixed(2)} statt ${b}`);
  near(qiblaBearing(51.4556, 7.0116), 127.3);   // Essen
  near(qiblaBearing(52.52, 13.405), 136.7);     // Berlin
  near(qiblaBearing(41.0082, 28.9784), 151.6);  // Istanbul
  near(qiblaBearing(40.7128, -74.006), 58.5);   // New York
});

test("Entfernung zur Kaaba", () => {
  assert.ok(Math.abs(kaabaDistanceKm(51.4556, 7.0116) - 4377) < 5);
});

test("kleinster Drehwinkel", () => {
  assert.equal(angleDiff(100, 127), 27);
  assert.equal(angleDiff(350, 10), 20);
  assert.equal(angleDiff(10, 350), -20);
});
