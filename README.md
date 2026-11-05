# Spells ✦ Zeichne deine Magie

Echtzeit-Duell im Browser: Du **zeichnest Formen** (Maus/Finger), das Spiel erkennt den Zauber und wirkt ihn sofort. 200 Leben, Mana, Abklingzeiten – beide Spieler dürfen jederzeit zeichnen.

## Spielprinzip
- **36 Zauber** in 5 Seltenheiten (Gewöhnlich → Mythisch). Seltenere sind stärker, aber schwerer zu zeichnen (komplexere Form, höhere Mindest-Genauigkeit).
- **Pakete** (Shop) schalten Zauber frei; Duplikate erhöhen die Stufe (1/2/4/8/16/32 Kopien, +7 % Stärke je Stufe). Pech-Schutz für Legendär/Mythisch.
- **Deck** 6 Plätze (7 ab Stufe 5, 8 ab Stufe 10). Trophäen & Ränge, Tagesaufgaben, Tagesgeschenk, Garderobe, Tutorial, Training gegen Bots.
- **Modi:** Online-Duell, **Zauberturm** (10 Etagen mit eigenen Regeln, Bosse auf 5 und 10, Erstbezwingungs-Belohnungen), **Freunde-Raum** (4-stelliger Code oder Link `#room=CODE`, keine Trophäen, optional fairer Kampf mit Starter-Deck), Training.
- Status-Effekte: Fluch, Regeneration, Phönix-Wiedergeburt; Glückswurf-Zauber.
- Spielstand-Code: unter *Mehr* exportier-/importierbar. Installierbar als App (PWA).
- Spielstand liegt lokal im Browser (`localStorage`, Schlüssel `spells_v2`).

## Technik
- `public/` – statisches Frontend (Canvas 2D, ES-Module, keine Build-Schritte).
  - `shapes.js`, `recog.js` – Formen + $1-artige Erkennung (nur gegen das eigene Deck, mit Mehrdeutigkeits-Schutz)
  - `spells.js`, `sim.js`, `bot.js` – Zauberdaten, Echtzeit-Simulation (identisch für Server & Browser), Bots
  - `scene.js`, `fx.js`, `gfx.js`, `pad.js`, `audio.js` – Grafik, Effekte pro Zauber, Zeichenfeld, Sound (Synth; optional Samples aus `public/audio/manifest.json`)
  - `battle.js`, `net.js` – Kampf-Controller, Online-/Offline-Quelle
  - `store.js`, `ui.js` – Spielstand & Menüs
- `src/worker.js` – Cloudflare Worker + Durable Objects (`Lobby` = Matchmaking nach Trophäen, `Match` = Server-Simulation, 20 Ticks/s, WebSocket). Findet sich nach 9 s kein Mensch, kämpft man gegen einen (gekennzeichneten) Bot.

## Entwickeln
```
npm install
npm run dev     # wrangler dev auf :8787
npm test        # Erkennung, Simulation, Store
```
Deploy: Push auf `main` (Cloudflare-Git-Integration) oder `npm run deploy`.
Dev-Abkürzung: `/#train=0..3` startet direkt einen Übungskampf.
