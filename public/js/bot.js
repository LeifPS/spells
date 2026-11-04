// Bot-Gegner (Training & Online-Fallback). Level 0 = Übungspuppe (greift nicht an), 1 = leicht, 2 = mittel, 3 = schwer.
import { SPELLS, SPELL_BY_ID, RARITIES, RARITY_ORDER, isHostile } from './spells.js';
import { CFG } from './sim.js';

const LV = [
  { name: 'Übungspuppe', delay: [99, 99], acc: [0.6, 0.7], failBase: 1, lvl: 1 },
  { name: 'Leicht',  delay: [2.4, 3.8], acc: [0.64, 0.84], failBase: 0.22, lvl: 1 },
  { name: 'Mittel',  delay: [1.5, 2.5], acc: [0.70, 0.90], failBase: 0.14, lvl: 2 },
  { name: 'Schwer',  delay: [1.0, 1.7], acc: [0.78, 0.96], failBase: 0.08, lvl: 3 },
];
export const BOT_LEVELS = LV;

const rr = (rng, a, b) => a + rng() * (b - a);

/** Deck für den Bot: passend zur stärksten Seltenheit, die der Mensch hat (maxRar = Index) */
export function botDeck(maxRar, level, rng = Math.random) {
  const pool = SPELLS.filter((s) => RARITY_ORDER.indexOf(s.rarity) <= maxRar);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const deck = [];
  const want = (fn) => { const c = pool.filter((s) => fn(s) && !deck.includes(s.id)); if (c.length) deck.push(pick(c).id); };
  want((s) => s.fx.heal && !s.fx.dmg);
  want((s) => s.fx.shield || s.fx.reflect);
  want((s) => s.fx.mana);
  while (deck.length < 6) {
    const c = pool.filter((s) => !deck.includes(s.id) && s.fx.dmg);
    if (!c.length) break;
    // seltene Zauber etwas bevorzugen, je schwerer der Bot
    const weights = c.map((s) => 1 + RARITY_ORDER.indexOf(s.rarity) * (0.4 + level * 0.3));
    let x = rng() * weights.reduce((a, b) => a + b, 0), idx = 0;
    for (; idx < c.length - 1; idx++) { x -= weights[idx]; if (x <= 0) break; }
    deck.push(c[idx].id);
  }
  return deck;
}

export function botLevels(deck, level) {
  const l = LV[Math.min(3, Math.max(0, level))].lvl;
  return Object.fromEntries(deck.map((id) => [id, l]));
}

export function makeBot(level, rng = Math.random) {
  const L = LV[Math.min(3, Math.max(0, level))];
  return { level, L, rng, wait: rr(rng, 1.5, 3) };
}

export function botStep(duel, i, bot, dt) {
  if (bot.level === 0 || duel.over) return;
  bot.wait -= dt;
  if (bot.wait > 0) return;
  const me = duel.p[i], op = duel.p[1 - i], rng = bot.rng;
  if (me.stun > 0 || me.gcd > 0.1) { bot.wait = 0.15; return; }

  const incoming = duel.proj.some((p) => p.tgt === i && !p.landed && !p.reflected);
  const cands = [];
  for (const id of me.deck) {
    const sp = SPELL_BY_ID[id];
    if ((me.cds[id] || 0) > 0.05 || me.mana < sp.cost) continue;
    const f = sp.fx;
    let s = 1;
    if (f.dmg) s += (f.dmg * (f.hits || 1)) / 14 + (f.burn || f.poison ? 0.8 : 0);
    if (f.stun) s += op.stun > 0.3 ? -2 : 1.6;
    if (f.chill && op.chill > 1) s -= 0.8;
    if (f.heal) s += me.hp < 90 ? 4 : me.hp < 140 ? 0.8 : -2;
    if (f.mana && !f.dmg) s += me.mana < 35 ? 4 : -3;
    if (f.shield || f.reflect) s += incoming ? 3.5 : me.shield > 0 ? -3 : 0.3;
    if (f.cleanse) s += me.burn || me.poison || me.stun > 0 || me.chill > 0 ? 2.5 : -2;
    if (f.haste) s += 0.5;
    if (me.mana > 70 && sp.cost > 40) s += 1;
    s += (rng() - 0.5) * (3.2 - bot.level * 0.7);
    cands.push([id, s]);
  }
  if (!cands.length) { bot.wait = 0.35; return; }
  cands.sort((a, b) => b[1] - a[1]);
  const id = cands[0][0], sp = SPELL_BY_ID[id], thr = RARITIES[sp.rarity].thr;
  // "Zeichnen" kann misslingen – je seltener der Zauber, desto öfter
  const failP = bot.L.failBase + RARITY_ORDER.indexOf(sp.rarity) * 0.07;
  if (rng() < failP) { bot.wait = rr(rng, 0.5, 1.2); return; }
  const acc = Math.min(0.97, Math.max(thr + 0.015, rr(rng, bot.L.acc[0], bot.L.acc[1])));
  duel.cast(i, id, acc);
  bot.wait = rr(rng, bot.L.delay[0], bot.L.delay[1]);
}
