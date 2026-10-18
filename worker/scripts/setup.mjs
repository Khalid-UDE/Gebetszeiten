// Richtet den Push-Server ein bzw. aktualisiert ihn – kann beliebig oft laufen.
// 1. D1-Datenbank anlegen (falls nötig) und Tabellen erstellen
// 2. Worker veröffentlichen
// 3. VAPID-Schlüssel einmalig erzeugen und als Secret hinterlegen
// 4. Worker-Adresse in ../js/config.js eintragen
// Benötigt: Node ≥ 20 und eine Cloudflare-Anmeldung (wrangler login oder CLOUDFLARE_API_TOKEN).
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { generateVapidKeys } from "../src/webpush.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const DB = "gebetszeiten";
const run = (cmd, opts = {}) => execSync(`npx wrangler ${cmd}`, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"], ...opts });
const step = msg => console.log(`\n▶ ${msg}`);

step("D1-Datenbank");
const findDb = () => JSON.parse(run("d1 list --json")).find(d => d.name === DB);
let db = findDb();
if (!db) { run(`d1 create ${DB}`); db = findDb(); }
if (!db) throw new Error("D1-Datenbank konnte nicht angelegt werden");
const tomlPath = join(root, "wrangler.toml");
const toml = readFileSync(tomlPath, "utf8").replace(/database_id = "[^"]*"/, `database_id = "${db.uuid}"`);
writeFileSync(tomlPath, toml);
run(`d1 execute ${DB} --remote --file=schema.sql -y`);
console.log("  ok:", db.uuid);

step("Worker veröffentlichen");
const out = run("deploy");
const url = (out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/) || [])[0];
if (!url) throw new Error("Worker-Adresse nicht gefunden – ist eine workers.dev-Subdomain im Cloudflare-Konto eingerichtet?\n" + out);
console.log("  ok:", url);

step("VAPID-Schlüssel");
let names = [];
try { names = JSON.parse(run("secret list --format json")).map(s => s.name); } catch { /* noch keine */ }
if (!names.includes("VAPID_PRIVATE_KEY") || !names.includes("VAPID_PUBLIC_KEY")) {
  const keys = await generateVapidKeys();
  const file = join(tmpdir(), `vapid-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey }));
  try { run(`secret bulk ${file}`); } finally { unlinkSync(file); }
  console.log("  neu erzeugt und hinterlegt");
} else {
  console.log("  vorhanden");
}

step("App-Konfiguration");
const cfgPath = join(root, "..", "js", "config.js");
const cfg = readFileSync(cfgPath, "utf8");
const updated = cfg.replace(/export const WORKER_URL = "[^"]*";/, `export const WORKER_URL = "${url}";`);
if (updated !== cfg) { writeFileSync(cfgPath, updated); console.log("  js/config.js aktualisiert"); }
else console.log("  js/config.js ist aktuell");

console.log(`\n✓ Push-Server läuft: ${url}`);
