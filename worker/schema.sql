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
  fails       INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS subs_next_at ON subs(next_at);

-- Zwischenspeicher der offiziellen Diyanet-Tabellen je Ort.
CREATE TABLE IF NOT EXISTS diyanet (
  id          TEXT PRIMARY KEY,
  fetched_at  INTEGER NOT NULL,
  data        TEXT NOT NULL
);
