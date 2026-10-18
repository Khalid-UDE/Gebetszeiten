// Missweisung (Deklination) nach dem World Magnetic Model 2025 (NOAA/NCEI und BGS, gültig 2025–2030).
// Koeffizienten aus der offiziellen Datei WMM2025.COF (Stand 13.11.2024).
// Der Kompass im Handy zeigt zum magnetischen Norden; wahrer Kurs = magnetischer Kurs + Missweisung.

const EPOCH = 2025.0;
const N = 12;
// je (n, m) für n = 1…12, m = 0…n: g, h, Änderung g pro Jahr, Änderung h pro Jahr (nT, nT/Jahr)
const COEF = [
  -29351.8,0.0,12.0,0.0,-1410.8,4545.4,9.7,-21.5,
  -2556.6,0.0,-11.6,0.0,2951.1,-3133.6,-5.2,-27.7,1649.3,-815.1,-8.0,-12.1,
  1361.0,0.0,-1.3,0.0,-2404.1,-56.6,-4.2,4.0,1243.8,237.5,0.4,-0.3,453.6,-549.5,-15.6,-4.1,
  895.0,0.0,-1.6,0.0,799.5,278.6,-2.4,-1.1,55.7,-133.9,-6.0,4.1,-281.1,212.0,5.6,1.6,12.1,-375.6,-7.0,-4.4,
  -233.2,0.0,0.6,0.0,368.9,45.4,1.4,-0.5,187.2,220.2,0.0,2.2,-138.7,-122.9,0.6,0.4,-142.0,43.0,2.2,1.7,20.9,106.1,0.9,1.9,
  64.4,0.0,-0.2,0.0,63.8,-18.4,-0.4,0.3,76.9,16.8,0.9,-1.6,-115.7,48.8,1.2,-0.4,-40.9,-59.8,-0.9,0.9,14.9,10.9,0.3,0.7,-60.7,72.7,0.9,0.9,
  79.5,0.0,-0.0,0.0,-77.0,-48.9,-0.1,0.6,-8.8,-14.4,-0.1,0.5,59.3,-1.0,0.5,-0.8,15.8,23.4,-0.1,0.0,2.5,-7.4,-0.8,-1.0,-11.1,-25.1,-0.8,0.6,14.2,-2.3,0.8,-0.2,
  23.2,0.0,-0.1,0.0,10.8,7.1,0.2,-0.2,-17.5,-12.6,0.0,0.5,2.0,11.4,0.5,-0.4,-21.7,-9.7,-0.1,0.4,16.9,12.7,0.3,-0.5,15.0,0.7,0.2,-0.6,-16.8,-5.2,-0.0,0.3,0.9,3.9,0.2,0.2,
  4.6,0.0,-0.0,0.0,7.8,-24.8,-0.1,-0.3,3.0,12.2,0.1,0.3,-0.2,8.3,0.3,-0.3,-2.5,-3.3,-0.3,0.3,-13.1,-5.2,0.0,0.2,2.4,7.2,0.3,-0.1,8.6,-0.6,-0.1,-0.2,-8.7,0.8,0.1,0.4,-12.9,10.0,-0.1,0.1,
  -1.3,0.0,0.1,0.0,-6.4,3.3,0.0,0.0,0.2,0.0,0.1,-0.0,2.0,2.4,0.1,-0.2,-1.0,5.3,-0.0,0.1,-0.6,-9.1,-0.3,-0.1,-0.9,0.4,0.0,0.1,1.5,-4.2,-0.1,0.0,0.9,-3.8,-0.1,-0.1,-2.7,0.9,-0.0,0.2,-3.9,-9.1,-0.0,-0.0,
  2.9,0.0,0.0,0.0,-1.5,0.0,-0.0,-0.0,-2.5,2.9,0.0,0.1,2.4,-0.6,0.0,-0.0,-0.6,0.2,0.0,0.1,-0.1,0.5,-0.1,-0.0,-0.6,-0.3,0.0,-0.0,-0.1,-1.2,-0.0,0.1,1.1,-1.7,-0.1,-0.0,-1.0,-2.9,-0.1,0.0,-0.2,-1.8,-0.1,0.0,2.6,-2.3,-0.1,0.0,
  -2.0,0.0,0.0,0.0,-0.2,-1.3,0.0,-0.0,0.3,0.7,-0.0,0.0,1.2,1.0,-0.0,-0.1,-1.3,-1.4,-0.0,0.1,0.6,-0.0,-0.0,-0.0,0.6,0.6,0.1,-0.0,0.5,-0.1,-0.0,-0.0,-0.1,0.8,0.0,0.0,-0.4,0.1,0.0,-0.0,-0.2,-1.0,-0.1,-0.0,-1.3,0.1,-0.0,0.0,-0.7,0.2,-0.1,-0.1,
];

const A = 6371.2;                         // Referenzradius des Modells (km)
const WGS_A = 6378.137, WGS_F = 1 / 298.257223563, WGS_E2 = WGS_F * (2 - WGS_F);
const rad = Math.PI / 180;

// Normierungsfaktoren nach Schmidt: sqrt(2 (n−m)! / (n+m)!) für m > 0, 1 für m = 0
const SCHMIDT = [];
for (let n = 0; n <= N; n++) {
  SCHMIDT[n] = [];
  for (let m = 0; m <= n; m++) {
    let ratio = 1;
    for (let k = n - m + 1; k <= n + m; k++) ratio /= k;
    SCHMIDT[n][m] = m === 0 ? 1 : Math.sqrt(2 * ratio);
  }
}

// Missweisung in Grad (positiv = Osten) für geodätische Breite/Länge, Höhe (km) und Dezimaljahr
export function declination(lat, lng, year = decimalYear(new Date()), altKm = 0) {
  const dt = year - EPOCH;
  // geodätisch → geozentrisch
  const sl = Math.sin(lat * rad), cl = Math.cos(lat * rad);
  const rc = WGS_A / Math.sqrt(1 - WGS_E2 * sl * sl);
  const p = (rc + altKm) * cl, z = (rc * (1 - WGS_E2) + altKm) * sl;
  const r = Math.hypot(p, z);
  const latC = Math.asin(z / r);
  const x = Math.sin(latC), s = Math.cos(latC); // cos θ, sin θ (θ = Kolatitude)

  // Legendre-Funktionen (ohne Normierung) P[n][m] und Ableitung nach θ
  const P = [], dP = [];
  for (let n = 0; n <= N; n++) { P[n] = []; dP[n] = []; }
  P[0][0] = 1;
  for (let m = 0; m <= N; m++) {
    if (m > 0) P[m][m] = (2 * m - 1) * s * P[m - 1][m - 1];
    if (m < N) P[m + 1][m] = (2 * m + 1) * x * P[m][m];
    for (let n = m + 2; n <= N; n++) P[n][m] = ((2 * n - 1) * x * P[n - 1][m] - (n + m - 1) * P[n - 2][m]) / (n - m);
  }
  for (let n = 1; n <= N; n++)
    for (let m = 0; m <= n; m++)
      dP[n][m] = (n * x * P[n][m] - (n + m) * (m <= n - 1 ? P[n - 1][m] : 0)) / s;

  let X = 0, Y = 0, Z = 0, i = 0;
  const lon = lng * rad;
  for (let n = 1; n <= N; n++) {
    const f = Math.pow(A / r, n + 2);
    for (let m = 0; m <= n; m++, i += 4) {
      const g = COEF[i] + dt * COEF[i + 2], h = COEF[i + 1] + dt * COEF[i + 3];
      const cm = Math.cos(m * lon), sm = Math.sin(m * lon);
      const Pn = SCHMIDT[n][m] * P[n][m], dPn = SCHMIDT[n][m] * dP[n][m];
      // dP/dφ' = −dP/dθ
      X += f * (g * cm + h * sm) * dPn;
      Y += f * m * (g * sm - h * cm) * Pn;
      Z -= (n + 1) * f * (g * cm + h * sm) * Pn;
    }
  }
  Y /= s;
  // zurück ins geodätische System drehen
  const psi = latC - lat * rad;
  const Xg = X * Math.cos(psi) - Z * Math.sin(psi);
  return Math.atan2(Y, Xg) / rad;
}

export function decimalYear(date) {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1), end = Date.UTC(y + 1, 0, 1);
  return y + (date.getTime() - start) / (end - start);
}
