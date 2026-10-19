-- Abos: ein Eintrag pro Gerät (Push-Endpunkt), anonym.
CREATE TABLE IF NOT EXISTS subs (
  endpoint    TEXT PRIMARY KEY,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  tz          TEXT NOT NULL,
  method      TEXT NOT NULL,
  diyanet_id  TEXT,
  lang        TEXT NOT NULL,
  bells       TEXT NOT NULL,
  next_at     INTEGER,
  next_key    TEXT,
  updated_at  INTEGER,
  fails       INTEGER DEFAULT 0,
  sent_for    INTEGER             -- Zeitpunkt des zuletzt verschickten Gebets
);
CREATE INDEX IF NOT EXISTS subs_next_at ON subs(next_at);

-- Zwischenspeicher der offiziellen Diyanet-Tabellen je Ort.
CREATE TABLE IF NOT EXISTS diyanet (
  id          TEXT PRIMARY KEY,
  fetched_at  INTEGER NOT NULL,
  data        TEXT NOT NULL
);

-- Letzte Fehler der Push-Dienste (ohne persönliche Daten), zur Fehlersuche.
CREATE TABLE IF NOT EXISTS log (
  t       INTEGER NOT NULL,
  host    TEXT,
  status  INTEGER,
  reason  TEXT
);
