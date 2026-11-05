import assert from 'node:assert/strict';
import { Duel, CFG } from '../public/js/sim.js';
import { makeBot, botStep, botDeck, botLevels } from '../public/js/bot.js';
import { SPELLS, RARITY_ORDER } from '../public/js/spells.js';

const mk = (d0, d1, lv = [{}, {}]) => new Duel({ decks: [d0, d1], levels: lv });
const run = (d, sec) => { for (let i = 0; i < sec * 20; i++) d.step(0.05); };
const evs = (d, k) => d.ev.filter((e) => e.k === k);
const ALL = SPELLS.map((s) => s.id);

// --- Wirken & Prüfungen
let d = mk(['feuerball', 'heilfunke'], ['blitz']);
assert.equal(d.cast(0, 'blitz', 0.9).ok, false, 'nicht im Deck');
assert.equal(d.cast(0, 'feuerball', 0.5).ok, false, 'zu ungenau');
assert.equal(d.cast(0, 'feuerball', 0.9).ok, true);
assert.equal(d.cast(0, 'heilfunke', 0.9).why, 'gcd', 'globale Abklingzeit');
run(d, 1.0);
assert.ok(d.p[0].mana < 100 && d.p[1].hp < 200, 'Feuerball hat getroffen: ' + d.p[1].hp);
assert.ok(d.p[1].burn, 'brennt');
d.drain();

// --- Mana
d = mk(['feuerball'], ['feuerball']);
d.p[0].mana = 5;
assert.equal(d.cast(0, 'feuerball', 0.9).why, 'mana');

// --- Cooldown + Latenztoleranz
d = mk(['klingenhieb'], ['klingenhieb']);
d.cast(0, 'klingenhieb', 0.9); run(d, 1.2);          // gcd .9 vorbei, cd 1.4 -> noch 0.2 <= Toleranz
assert.equal(d.cast(0, 'klingenhieb', 0.9).ok, true, 'Toleranz greift');

// --- Schild saugt Schaden, Gift nicht
d = mk(['blitz', 'schlangenbiss'], ['schutzwall']);
d.cast(1, 'schutzwall', 0.9);
assert.ok(d.p[1].shield >= 40);
d.cast(0, 'blitz', 0.9); run(d, 1.0);
assert.equal(d.p[1].hp, 200, 'Schild absorbiert Blitz');
d.cast(0, 'schlangenbiss', 0.9); run(d, 3);
assert.ok(d.p[1].hp < 200, 'Gift geht durch Schild');

// --- Spiegel reflektiert, Ausweichen nicht möglich bei pierce
d = mk(['pentagramm'], ['spiegel']);
d.p[0].mana = 100;
d.cast(1, 'spiegel', 0.95); d.cast(0, 'pentagramm', 0.9); run(d, 3);
assert.ok(d.p[0].hp < 200 && d.p[1].hp === 200, 'reflektiert: ' + d.p[0].hp + '/' + d.p[1].hp);

// --- Betäubung blockt Zauber
d = mk(['zeitsand'], ['feuerball']);
d.cast(0, 'zeitsand', 0.9); run(d, 0.7);
assert.ok(d.p[1].stun > 0);
assert.equal(d.cast(1, 'feuerball', 0.9).why, 'stun');

// --- Reinigung, Lebensraub, Salve
d = mk(['seelenraub'], ['donnerschlag']);
d.p[0].hp = 100; d.cast(0, 'seelenraub', 0.9); run(d, 1.2);
assert.ok(d.p[0].hp > 130, 'Lebensraub ' + d.p[0].hp);
d = mk(['donnerschlag'], ['feuerball']);
d.cast(0, 'donnerschlag', 0.9); run(d, 1.5);
assert.equal(d.p[1].hp, 200 - Math.round(14 * (0.8 + 0.35 * (0.9 - 0.74) / (0.95 - 0.74))) * 5, '5 Treffer');

// --- Ende
d = mk(['feuerball'], ['feuerball']); d.p[1].hp = 3; d.cast(0, 'feuerball', 0.9); run(d, 1);
assert.equal(d.over, true); assert.equal(d.winner, 0);

// --- Sudden Death beendet jedes Spiel
d = mk(['heilfunke'], ['heilfunke']); run(d, 160);
assert.equal(d.over, true, 'Zeitlimit');

// --- Bot-gegen-Bot: Dauer & Fairness
function sim(l0, l1, rarMax) {
  const rng = Math.random;
  const dk = [botDeck(rarMax, l0, rng), botDeck(rarMax, l1, rng)];
  const du = new Duel({ decks: dk, levels: [botLevels(dk[0], l0), botLevels(dk[1], l1)] });
  const bots = [makeBot(l0, rng), makeBot(l1, rng)];
  while (!du.over) { botStep(du, 0, bots[0], 0.05); botStep(du, 1, bots[1], 0.05); du.step(0.05); du.drain(); }
  return { w: du.winner, t: du.t, reason: du.reason };
}
for (const [a, b, r] of [[2, 2, 1], [2, 2, 4], [3, 3, 4], [3, 1, 2]]) {
  const res = Array.from({ length: 60 }, () => sim(a, b, r));
  const avg = res.reduce((s, x) => s + x.t, 0) / res.length;
  const w0 = res.filter((x) => x.w === 0).length, w1 = res.filter((x) => x.w === 1).length, dr = res.filter((x) => x.w === -1).length;
  const sudden = res.filter((x) => x.reason === 'time').length;
  console.log(`Bot ${a} vs Bot ${b} (Seltenheit<=${RARITY_ORDER[r]}): Ø ${avg.toFixed(0)} s, Siege ${w0}:${w1}, remis ${dr}, Zeitende ${sudden}`);
}

// --- Neue Mechaniken (v3)
// Fluch: +30 % Schaden
d = mk(['schwaechefluch', 'klingenhieb'], ['klingenhieb']);
d.cast(0, 'schwaechefluch', 0.95); run(d, 1.0);
assert.ok(d.p[1].curse > 5, 'verflucht');
const hp0 = d.p[1].hp; d.drain();
d.p[0].gcd = 0; d.p[0].cds = {};
d.cast(0, 'klingenhieb', 0.9); run(d, 0.6);
const dealt = hp0 - d.p[1].hp;
assert.ok(dealt >= Math.round(13 * 0.8 * 1.3) - 1, 'Fluch erhöht Schaden: ' + dealt);

// Regeneration heilt über Zeit
d = mk(['heilquelle'], ['klingenhieb']); d.p[0].hp = 100;
d.cast(0, 'heilquelle', 0.95); run(d, 7);
assert.ok(d.p[0].hp >= 100 + 8 * 6 * 0.8 - 6, 'Heilquelle: ' + d.p[0].hp);
assert.equal(d.p[0].regen, null, 'Regeneration endet');

// Schattenschritt weicht dem nächsten Angriff aus
d = mk(['schattenschritt'], ['blitz']);
d.cast(0, 'schattenschritt', 0.9); d.cast(1, 'blitz', 0.9); run(d, 1.0);
assert.equal(d.p[0].hp, 200, 'ausgewichen');

// Phönix: Wiederauferstehung statt Tod (nur einmal)
d = mk(['phoenixnest'], ['blitz', 'donnerschlag']);
d.cast(0, 'phoenixnest', 0.95); d.drain(); d.p[0].hp = 10;
d.cast(1, 'blitz', 0.95); run(d, 1.0);
assert.ok(!d.over, 'Phönix hält das Duell am Leben');
assert.ok(d.p[0].hp >= 70, 'wiederbelebt: ' + d.p[0].hp);
assert.equal(d.ev.filter((e) => e.k === 'rebirth').length, 1, 'Rebirth-Event');
d.p[1].gcd = 0; d.p[1].mana = 100; d.p[0].hp = 10; d.p[1].cds = {};
d.cast(1, 'blitz', 0.95); run(d, 1.0);
assert.ok(d.over && d.winner === 1, 'beim zweiten Mal kein Phönix mehr');

// Glückswurf: deterministisch mit festem Zufall, jeder Ausgang funktioniert
for (let r = 0; r < 6; r++) {
  d = new Duel({ decks: [['glueckswurf'], ['klingenhieb']], levels: [{}, {}], rng: () => (r + 0.5) / 6 });
  d.p[0].hp = 100; d.p[0].mana = 60;
  const res = d.cast(0, 'glueckswurf', 0.95); assert.ok(res.ok);
  const ce = d.ev.find((e) => e.k === 'cast'); assert.equal(ce.roll, r);
  run(d, 2.0);
  const out = [d.p[1].hp < 200, d.p[0].hp > 100, d.p[0].shield > 0, d.p[0].mana > 60 - 26 + 6, d.p[1].stun > 0 || d.p[1].hp < 200, d.p[1].burn || d.p[1].hp < 200][r];
  assert.ok(out, 'Glückswurf Ausgang ' + r);
}

// Pfeilsalve: drei Treffer
d = mk(['pfeilsalve'], ['klingenhieb']); d.cast(0, 'pfeilsalve', 0.9); run(d, 1.5);
assert.equal(d.ev.filter((e) => e.k === 'hit').length, 3, 'drei Pfeile');

// Bots spielen mit allen neuen Zaubern ohne Fehler
for (const id of ['steinwall', 'pfeilsalve', 'schwaechefluch', 'schattenschritt', 'heilquelle', 'glueckswurf', 'meteor', 'phoenixnest']) {
  d = mk([id, 'klingenhieb', 'heilfunke'], ['feuerball', 'blitz', 'schutzwall']);
  const b0 = makeBot(3), b1 = makeBot(3);
  for (let i = 0; i < 20 * 150 && !d.over; i++) { botStep(d, 0, b0, 0.05); botStep(d, 1, b1, 0.05); d.step(0.05); }
}


// --- Zauberturm: Regel-Änderungen
import { FLOORS, MODS, simMods, towerOpts } from '../public/js/tower.js';
d = new Duel({ decks: [['feuerball'], ['heilfunke']], levels: [{}, {}], mods: simMods({ mod: 'rush' }, 0) });
d.p[0].mana = 0; run(d, 2); assert.ok(d.p[0].mana > 2 * CFG.regen * 1.9, 'Manaflut: doppelte Regeneration ' + d.p[0].mana);
d = new Duel({ decks: [['feuerball'], ['blitz']], levels: [{}, {}], mods: simMods({ mod: 'swift' }, 0) });
d.cast(0, 'feuerball', 0.9); assert.ok(Math.abs(d.p[0].cds.feuerball - 2.0 * 0.6) < 1e-6, 'Zeitschleife verkürzt Abklingzeit');
d = new Duel({ decks: [['feuerball'], ['heilfunke']], levels: [{}, {}], mods: simMods({ mod: 'wither' }, 0) });
d.p[1].hp = 100; d.cast(1, 'heilfunke', 0.9); assert.ok(d.p[1].hp < 100 + 26, 'Dürre halbiert Heilung: ' + d.p[1].hp);
d = new Duel({ decks: [['klingenhieb'], ['klingenhieb']], levels: [{}, {}], mods: simMods({ mod: 'glass' }, 0) });
d.cast(0, 'klingenhieb', 0.95); run(d, 1); assert.ok(d.p[1].hp <= 200 - Math.round(13 * 0.8 * 1.5), 'Glaskanone erhöht Schaden: ' + d.p[1].hp);
// Boss: Gegner hat Start-Schild und teilt 20 % mehr aus (Mensch ist Spieler 1 -> Gegner = 0)
const bm = simMods({ mod: 'boss' }, 1); assert.equal(bm.shield0[0], 80); assert.equal(bm.shield0[1], 0); assert.equal(bm.dmg[0], 1.2);
d = new Duel({ decks: [['klingenhieb'], ['klingenhieb']], levels: [{}, {}], mods: bm }); assert.equal(d.p[0].shield, 80);
// Jede Etage ist spielbar: Bot (Stufe der Etage) gegen sich selbst läuft bis zum Ende
for (const f of FLOORS) {
  const o = towerOpts(f); assert.ok(o.botDeck.length >= 3, 'Bot-Deck Etage ' + f.n); assert.ok(MODS[f.mod]);
  d = new Duel({ decks: [o.botDeck, o.botDeck], levels: [botLevels(o.botDeck, f.bot), botLevels(o.botDeck, f.bot)], mods: simMods(f, 1) });
  const ba = makeBot(f.bot), bb = makeBot(f.bot);
  for (let i = 0; i < 20 * 160 && !d.over; i++) { botStep(d, 0, ba, 0.05); botStep(d, 1, bb, 0.05); d.step(0.05); }
  assert.ok(d.over, 'Etage ' + f.n + ' endet');
}

console.log('Simulation: alle Tests bestanden');
