# Gebetszeiten

Installierbare Web-App (PWA) für die täglichen Gebetszeiten. Sie hat folgende Funktionen:

- **Standort per GPS:** Der Standort wird nach einmaliger Erlaubnis ermittelt und automatisch aktualisiert. Wer kein GPS freigeben will, sucht seinen Ort manuell.
- **Zwei Methoden:**
  - **Muslim World League** (Standard): Die App rechnet selbst (Fajr 18°, Isha 17°, Asr Standard).
  - **Diyanet**: Die App lädt die **offiziellen Tabellen** des nächstgelegenen Diyanet-Orts.
- **Benachrichtigungen** zu Fajr, Dhuhr, Asr, Maghrib und Isha, auch bei geschlossener App. Shuruq kann man optional dazuschalten (Glocke je Gebet).
- **Sprachen:**
  - Standard: Fajr, Dhuhr … mit arabischer Schrift
  - Deutsch
  - العربية (von rechts nach links)
  - English
  - Türkçe
  - Shqip
  - Bosanski
- **Qibla-Kompass:** Er zeigt die Richtung zur Kaaba und die Entfernung. Der Kompass dreht sich mit dem Handy und wird grün, wenn die Richtung stimmt.
  - Der Handykompass zeigt zum magnetischen Norden. Die App rechnet die Missweisung mit dem World Magnetic Model 2025 heraus (`js/geomag.js`, offline). Geprüft ist das gegen die 100 offiziellen NOAA-Testwerte.
  - iPhone: Die Erlaubnis für „Bewegung & Ausrichtung“ wird erst nach Tippen auf „Kompass starten“ abgefragt. iOS merkt sie sich nur, bis die App geschlossen wird.
  - Ohne Kompass-Sensor nennt die App die Richtung in Grad.
- **Drei Tabs** unten: Gebetszeiten, Qibla und Einstellungen.
- **Hell-/Dunkelmodus** passt sich automatisch an das System an.
- **Offline:** Die App funktioniert ohne Internet weiter.

App-Adresse nach dem Einrichten: **https://khalid-ude.github.io/Gebetszeiten/**

---

## Einmalige Einrichtung (für den Betreiber)

### 1. App veröffentlichen (GitHub Pages)

1. Im Repository öffnen: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
2. Den Stand auf `main` bringen, z. B. per Pull Request.
3. Der Workflow „App veröffentlichen“ läuft dann automatisch.

Danach ist die App unter der Adresse oben erreichbar. Gebetszeiten und Diyanet funktionieren ab diesem Schritt. Benachrichtigungen kommen ohne Schritt 2 nur, solange die App geöffnet ist.

### 2. Push-Server einrichten (für Benachrichtigungen bei geschlossener App)

Der Push-Server ist ein kostenloser Cloudflare Worker. **Nur du als Betreiber brauchst dafür ein Konto.** Alle anderen Nutzer brauchen kein Konto.

1. Kostenloses Konto anlegen: https://dash.cloudflare.com/sign-up
2. Im Dashboard einmal **Workers & Pages** öffnen. Dabei wird die `workers.dev`-Adresse angelegt; wenn Cloudflare danach fragt, einen Namen wählen.
3. **Account ID** kopieren. Sie steht unter Workers & Pages rechts in der Seitenleiste.
4. Einen **API-Token** anlegen: Profil → *API Tokens* → *Create Token* → Vorlage **„Edit Cloudflare Workers“**.
   - Unter *Permissions* eine Zeile hinzufügen: **Account → D1 → Edit**.
   - Token erstellen und kopieren.
5. Im GitHub-Repository unter **Settings → Secrets and variables → Actions → New repository secret** zwei Secrets anlegen:
   - `CLOUDFLARE_API_TOKEN`: den Token aus Schritt 4
   - `CLOUDFLARE_ACCOUNT_ID`: die Account ID aus Schritt 3
6. **Actions → „Push-Server einrichten / aktualisieren“ → Run workflow**.

Der Workflow erledigt dann alles Weitere automatisch:
- Er legt die Datenbank an und veröffentlicht den Worker.
- Er erzeugt die Schlüssel für die Benachrichtigungen.
- Er trägt die Server-Adresse in die App ein und veröffentlicht die App neu.

Später reicht ein Push auf `main`, dann aktualisiert sich alles selbst.

Alternativ geht die Einrichtung lokal: `cd worker && npm install && npx wrangler login && npm run setup`.

---

## App installieren und an andere weitergeben

Den Link einfach weiterschicken.

**iPhone (iOS 16.4 oder neuer):**
1. Den Link in **Safari** öffnen.
2. **Teilen → Zum Home-Bildschirm**.
3. Die App vom Home-Bildschirm starten.
4. Standort und Benachrichtigungen erlauben.

Benachrichtigungen funktionieren auf dem iPhone nur in der installierten App.

**Android:**
1. Den Link in Chrome öffnen.
2. **Installieren** bzw. *Zum Startbildschirm hinzufügen* wählen.
3. Standort und Benachrichtigungen erlauben.

---

## Datenquellen und Datenschutz

- **Muslim World League:** Berechnung nach dem Algorithmus von praytimes.org.
  - Abgeglichen mit aladhan.com für Essen, Berlin, Hamburg, Kiel, München und Freiburg im Sommer, Winter, Frühling und Herbst.
  - Abweichung höchstens 2 Minuten (Rundung).
- **Diyanet:** offizielle Tabellen über den freien Spiegel `ezanvakti.emushaf.net` (gleiche Orts-IDs wie namazvakitleri.diyanet.gov.tr).
  - Für Deutschland wählt die App den nächstgelegenen der 1 234 Diyanet-Orte über Koordinaten aus `data/diyanet-de.json`.
  - In anderen Ländern ordnet die App den Ort über den Ortsnamen zu.
  - Ohne Daten zeigt die App eine Näherung.
- **Ortsnamen und Ortssuche:** OpenStreetMap Nominatim.
- **Push-Server:** speichert pro Gerät nur das anonyme Push-Abo, den zuletzt bekannten Standort (auf 4 Nachkommastellen gerundet), die Zeitzone, die Methode, die Sprache und die gewählten Glocken. Es gibt keine Namen und keine Konten.
  - Den Standort kann eine Web-App nur bei geöffneter App lesen. Der Server nutzt deshalb den Standort vom letzten Öffnen.

---

## Entwicklung

```bash
npm test     # Tests: Gebetszeiten, Diyanet-Daten, Zeitplanung, Push-Verschlüsselung
npm start    # lokaler Server auf http://localhost:8080
```

Aufbau:

| Pfad | Inhalt |
|---|---|
| `index.html`, `styles.css`, `js/app.js` | Oberfläche |
| `js/praytimes.js` | Berechnung (auch vom Server genutzt) |
| `js/i18n.js` | Sprachen und Texte der Benachrichtigungen |
| `js/diyanet.js` | Offizielle Diyanet-Zeiten und Ortszuordnung |
| `js/location.js`, `js/push.js` | Standort, Benachrichtigungen |
| `js/qibla.js` | Qibla-Richtung, Entfernung, Kompass-Sensor |
| `js/geomag.js` | Missweisung (World Magnetic Model 2025) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installation und Offline-Betrieb |
| `worker/` | Push-Server (Cloudflare Worker, D1, Cron jede Minute) |
| `data/diyanet-de.json` | Koordinaten der Diyanet-Orte in Deutschland |
