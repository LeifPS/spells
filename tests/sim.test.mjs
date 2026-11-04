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
console.log('Simulation: alle Tests bestanden');
