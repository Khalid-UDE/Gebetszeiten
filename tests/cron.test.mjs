// Jeder Termin wird genau einmal verschickt – auch wenn zwei Cron-Läufe gleichzeitig laufen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleCron } from "../worker/src/cron.js";

// Kleine D1-Attrappe für die Abfragen des Crons
function fakeDB(rows) {
  const tick = () => new Promise(r => setTimeout(r, 1));
  return {
    rows,
    prepare(sql) {
      return {
        bind(...a) {
          return {
            async all() {
              await tick();
              return { results: rows.filter(r => r.next_at != null && r.next_at <= a[0]).map(r => ({ ...r })) };
            },
            async run() {
              await tick();
              if (sql.startsWith("UPDATE subs SET next_at")) {
                const r = rows.find(x => x.endpoint === a[3] && x.next_at === a[4]);
                if (!r) return { meta: { changes: 0 } };
                Object.assign(r, { next_at: a[0], next_key: a[1], sent_for: a[2] });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE subs SET fails")) { rows.find(x => x.endpoint === a[1]).fails = a[0]; return { meta: { changes: 1 } }; }
              if (sql.startsWith("DELETE")) { rows.splice(rows.findIndex(x => x.endpoint === a[0]), 1); return { meta: { changes: 1 } }; }
              return { meta: { changes: 0 } };
            }
          };
        }
      };
    }
  };
}

const FAJR = Date.parse("2026-10-19T04:12:00Z");
const deps = sent => ({
  planNext: async () => ({ at: FAJR + 7 * 36e5, key: "dhuhr" }),
  message: (sub, key) => ({ title: key }),
  logFailure: async () => {},
  pushOptions: () => ({}),
  rowToSub: r => r,
  send: async (s, msg) => { sent.push(msg.title); return { status: 201 }; }
});

test("zwei gleichzeitige Cron-Läufe senden Fajr nur einmal", async () => {
  const env = { DB: fakeDB([{ endpoint: "https://push.example/1", p256dh: "x", auth: "y", next_at: FAJR, next_key: "fajr", fails: 0 }]) };
  const sent = [];
  await Promise.all([handleCron(env, deps(sent), FAJR + 5e3), handleCron(env, deps(sent), FAJR + 6e3)]);
  assert.deepEqual(sent, ["fajr"]);
  assert.equal(env.DB.rows[0].next_key, "dhuhr");
  assert.equal(env.DB.rows[0].sent_for, FAJR);
});

test("verpasste Termine (älter als 10 min) werden nicht nachgeschickt", async () => {
  const env = { DB: fakeDB([{ endpoint: "https://push.example/2", next_at: FAJR, next_key: "fajr", fails: 0 }]) };
  const sent = [];
  await handleCron(env, deps(sent), FAJR + 20 * 60e3);
  assert.deepEqual(sent, []);
  assert.equal(env.DB.rows[0].next_key, "dhuhr");
});
