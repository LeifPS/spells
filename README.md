# ✦ Spells

Zeichne deine Zauber – Mobil- & Desktop-Browserspiel mit Online-Duellen.

- **Kampf:** 200 Leben, pro Runde 10 s Zeit. Beide zeichnen gleichzeitig, danach werden die Zauber aufgelöst.
- **Erkennung:** Template-Vergleich (wie der $1-Recognizer). Größe, Startpunkt und Zeichenrichtung sind egal – nur die Form zählt.
  Seltenere Zauber haben komplexere Formen **und** eine höhere Mindest-Genauigkeit.
- **Freischalten:** Zauberpakete (60 🪙). Münzen gibt es für Kämpfe. Doppelte Zauber geben Münzen zurück. Speicherstand liegt lokal im Browser.
- **Online:** Cloudflare Worker + Durable Objects (`Lobby` = Warteschlange, `Match` = Kampfraum, WebSocket).
  Findet sich nach 8 s niemand, tritt ein Übungsgegner an (passt zur stärksten Seltenheit des Spielers).

## Struktur
- `public/` – Client (`spells.js` = Zauber & Formen, geteilt mit dem Worker; `recognizer.js`; `pad.js`; `vfx.js`; `app.js`)
- `src/worker.js` – Routing, Lobby, Match · `src/game.js` – reine Spiellogik
- `tests/` – `node tests/recognizer.test.mjs`, `node tests/game.test.mjs`, `node tests/e2e.mjs <url> [bot|duo]`

## Entwickeln & Deploy
```
npm install
npx wrangler dev      # http://127.0.0.1:8787
npx wrangler deploy
```
Neue Zauber: in `public/spells.js` eintragen (Form in `SHAPES`, Eintrag in `SPELLS`). Danach `node tests/recognizer.test.mjs` laufen lassen, um Verwechslungen zu sehen.
