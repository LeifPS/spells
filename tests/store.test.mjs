import { Store, PACKS, rankOf, levelInfo, deckSlots, SKINS } from '../public/js/store.js';
import { SPELLS, RARITY_ORDER } from '../public/js/spells.js';
import assert from 'node:assert/strict';

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, m }; };
let seed = 12345; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// Start
let st = new Store(mem(), rng);
assert.equal(st.d.deck.length, 6); assert.equal(st.d.coins, 300); assert.equal(st.slots, 6);
assert.equal(st.d.quests.list.length, 3);

// Speichern/Laden
const storage = mem(); st = new Store(storage, rng); st.addCoins(50); st.save();
assert.equal(new Store(storage, rng).d.coins, 350);

// Ränge, Stufen
assert.equal(rankOf(0).name, 'Lehrling'); assert.equal(rankOf(750).name, 'Magier'); assert.equal(rankOf(5000).name, 'Großmeister');
assert.equal(levelInfo(0).lvl, 1); assert.equal(levelInfo(100).lvl, 2); assert.equal(levelInfo(250).lvl, 3);
assert.equal(deckSlots(4), 6); assert.equal(deckSlots(5), 7); assert.equal(deckSlots(10), 8);

// Paket-Statistik
for (const type of ['basic', 'grand']) {
  const cnt = [0, 0, 0, 0, 0]; let packs = 40000, minLastOk = true;
  const s = new Store(mem(), rng); s.d.coins = 1e9;
  for (let i = 0; i < packs; i++) {
    const cards = s.openPack(type);
    cards.forEach((c) => cnt[RARITY_ORDER.indexOf(c.rarity)]++);
    if (RARITY_ORDER.indexOf(cards[cards.length - 1].rarity) < PACKS[type].minLast) minLastOk = false;
  }
  const tot = cnt.reduce((a, b) => a + b, 0);
  console.log(type, cnt.map((c, i) => `${RARITY_ORDER[i]} ${(100 * c / tot).toFixed(2)}%`).join(' · '), '| Pakete bis Legendär ≈', (packs / (cnt[3] + cnt[4])).toFixed(1), '| bis Mythisch ≈', (packs / cnt[4]).toFixed(0));
  assert.ok(minLastOk);
}

// Bezahlen, Duplikate -> Stufen, Max-Rückerstattung
st = new Store(mem(), rng);
assert.equal(st.openPack('grand'), null); // 300 < 550
const c0 = st.d.coins; assert.ok(st.openPack('basic')); assert.equal(st.d.coins, c0 - 150);
st.d.copies.feuerball = 32; const before = st.d.coins; st.rng = () => 0.0; // erzwingt Gewöhnlich + 1. Zauber (feuerball)
const cards = st.openPack('basic', false); st.rng = rng;
assert.ok(cards.some((c) => c.refund) || cards.every((c) => c.id !== 'feuerball'));

// Pech-Schutz: legendär spätestens nach 35 Paketen
{ const s = new Store(mem(), () => 0.3); s.d.coins = 1e9; let n = 0, got = false; while (!got && n < 60) { n++; got = s.openPack('basic').some((c) => RARITY_ORDER.indexOf(c.rarity) >= 3); } assert.ok(n <= 35, 'Pity ' + n); console.log('Pity greift nach', n, 'Paketen'); }

// Deck
st = new Store(mem(), rng); st.d.copies.blitz = 1;
assert.ok(!st.addToDeck('blitz')); assert.ok(st.addToDeck('blitz', 'heilfunke')); assert.ok(st.inDeck('blitz') && !st.inDeck('heilfunke'));
assert.ok(!st.addToDeck('weltenfeuer')); // nicht besessen

// Ergebnis
st = new Store(mem(), rng);
const win = { won: true, mode: 'online', stats: { dmg: 220, heal: 0, casts: 20, acc: 80 }, opponent: { trophies: 0 }, casts: [{ id: 'feuerball', acc: 0.9 }] };
const o = st.applyResult(win);
assert.ok(o.trophies >= 12 && st.d.trophies === o.trophies && o.coins >= 30 && st.d.stats.wins === 1);
const lose = st.applyResult({ lost: true, mode: 'online', stats: { dmg: 10, heal: 0, casts: 3 }, opponent: { trophies: 0 }, casts: [] });
assert.ok(lose.trophies <= 0 && st.d.trophies >= 0);
const tr = new Store(mem(), rng).applyResult({ won: true, mode: 'train', stats: { dmg: 100, casts: 5 }, casts: [] });
assert.equal(tr.trophies, 0);
// Level-Up-Belohnung + Slot
st = new Store(mem(), rng); const ups = st.addXp(100 + 150 + 200 + 250); assert.equal(st.level, 5); assert.ok(ups.some((u) => u.slot) && ups.some((u) => u.pack)); assert.equal(st.slots, 7);
// Tagesgeschenk
st = new Store(mem(), rng); assert.ok(st.claimDaily()); assert.equal(st.claimDaily(), null);
// Skins
st = new Store(mem(), rng); st.d.coins = 1000; assert.ok(st.buySkin('rubin')); assert.ok(st.wear('rubin')); assert.ok(!st.wear('gold')); assert.ok(!st.buySkin('schatten'));
console.log('Store: alle Tests bestanden');

// Zauberturm: erste Bezwingung zahlt, Wiederholung kaum; Boss-Etage gibt ein Paket
{
  const s = new Store(mem(), rng);
  let r = s.applyResult({ won: true, mode: 'tower', floor: 1, stats: { dmg: 100, casts: 5 }, casts: [] });
  assert.equal(r.coins, 30); assert.equal(s.d.tower.best, 1); assert.ok(r.firstClear); assert.equal(r.trophies, 0);
  r = s.applyResult({ won: true, mode: 'tower', floor: 1, stats: { dmg: 100, casts: 5 }, casts: [] });
  assert.equal(r.coins, 8); assert.ok(!r.firstClear);
  r = s.applyResult({ lost: true, mode: 'tower', floor: 2, stats: { dmg: 10, casts: 2 }, casts: [] });
  assert.equal(s.d.tower.best, 1); assert.equal(r.coins, 0);
  const fp = s.d.freePacks; s.applyResult({ won: true, mode: 'tower', floor: 5, stats: { dmg: 1, casts: 1 }, casts: [] });
  assert.equal(s.d.freePacks, fp + 1, 'Boss-Etage gibt ein Gratis-Paket');
  const f = s.applyResult({ won: true, mode: 'friend', stats: { dmg: 50, casts: 3 }, casts: [] }); assert.ok(f.practice && f.coins === 0);
  // Fortschritts-Code
  const code = s.exportCode(); const s2 = new Store(mem(), rng);
  assert.ok(s2.importCode(code)); assert.equal(s2.d.tower.best, 5); assert.equal(s2.d.coins, s.d.coins);
  assert.ok(!s2.importCode('murks')); assert.ok(!s2.importCode('SP2-@@@'));
}
console.log('Store (Turm, Code): ok');
