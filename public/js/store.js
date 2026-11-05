// Spielstand (localStorage) + komplette Meta-Logik: Pakete, Stufen, Ränge, Aufgaben, Skins.
import { SPELLS, SPELL_BY_ID, RARITIES, RARITY_ORDER, LEVEL_COPIES, MAX_LEVEL, levelFor } from './spells.js';

export const SAVE_KEY = 'spells_v2';
export const STARTER = ['feuerball', 'eissplitter', 'windstoss', 'klingenhieb', 'heilfunke', 'erdbrocken'];

// ------------------------------------------------------------ Ränge
export const RANKS = [
  { name: 'Lehrling', min: 0, icon: '🪄', color: '#b9c3d6' },
  { name: 'Adept', min: 300, icon: '📜', color: '#6fd08a' },
  { name: 'Magier', min: 700, icon: '🔮', color: '#4da8ff' },
  { name: 'Erzmagier', min: 1200, icon: '⚡', color: '#b565ff' },
  { name: 'Großmeister', min: 2000, icon: '👑', color: '#ffb52e' },
];
export function rankOf(t) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (t >= RANKS[k].min) i = k;
  const r = RANKS[i], nx = RANKS[i + 1] || null;
  return { ...r, idx: i, next: nx, prog: nx ? (t - r.min) / (nx.min - r.min) : 1 };
}

// ------------------------------------------------------------ Stufen
export const xpNeed = (lvl) => 100 + 50 * (lvl - 1);
export function levelInfo(xp) {
  let lvl = 1, rest = xp;
  while (rest >= xpNeed(lvl)) { rest -= xpNeed(lvl); lvl++; }
  return { lvl, into: rest, need: xpNeed(lvl) };
}
export const deckSlots = (lvl) => (lvl >= 10 ? 8 : lvl >= 5 ? 7 : 6);
export const levelReward = (lvl) => ({ coins: 40 + 10 * lvl, pack: lvl % 3 === 0 });

// ------------------------------------------------------------ Pakete
export const PACKS = {
  basic: { id: 'basic', name: 'Zauberpaket', cards: 3, price: 150, odds: [70, 24, 5, 0.9, 0.1], lastOdds: [0, 80, 17, 2.7, 0.3], minLast: 1, color: '#4da8ff' },
  grand: { id: 'grand', name: 'Großes Paket', cards: 5, price: 550, odds: [58, 28, 10, 3.2, 0.8], lastOdds: [0, 0, 86, 12.5, 1.5], minLast: 2, color: '#ffb52e' },
};
const PITY = { legendary: 35, mythic: 120 };

function pickIdx(weights, rng, min = 0) {
  const w = weights.map((v, i) => (i < min ? 0 : v));
  let x = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
  return w.length - 1;
}

// ------------------------------------------------------------ Skins
export const SKINS = [
  { id: 'azur', name: 'Azur', robe: '#2c6fd1', trim: '#ffd86b', hat: 0, how: 'free' },
  { id: 'purpur', name: 'Purpur', robe: '#8e44ad', trim: '#ffd86b', hat: 1, how: 'free' },
  { id: 'rubin', name: 'Rubin', robe: '#c0392b', trim: '#ffe3a0', hat: 2, how: 'coins', price: 250 },
  { id: 'smaragd', name: 'Smaragd', robe: '#16a085', trim: '#f1f5a8', hat: 0, how: 'coins', price: 250 },
  { id: 'nacht', name: 'Nachtmagier', robe: '#1b1f3b', trim: '#9fb4ff', hat: 1, how: 'coins', price: 450 },
  { id: 'rosen', name: 'Rosenzauber', robe: '#d6507f', trim: '#fff0f5', hat: 2, how: 'coins', price: 450 },
  { id: 'gold', name: 'Goldweiser', robe: '#b8862a', trim: '#fff2b8', hat: 0, how: 'level', level: 8 },
  { id: 'eis', name: 'Frostwächter', robe: '#6fb8d8', trim: '#ffffff', hat: 2, how: 'level', level: 12 },
  { id: 'glut', name: 'Glutmeister', robe: '#e0501a', trim: '#2a0d08', hat: 1, how: 'trophies', trophies: 500 },
  { id: 'licht', name: 'Lichtgesandter', robe: '#f2f4ff', trim: '#ffcf5a', hat: 0, how: 'trophies', trophies: 1200 },
  { id: 'schatten', name: 'Schattenfürst', robe: '#2a1038', trim: '#e04dff', hat: 2, how: 'trophies', trophies: 2000 },
];
export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));

// ------------------------------------------------------------ Aufgaben
const QUEST_POOL = [
  { id: 'win2', text: 'Gewinne 2 Kämpfe', goal: 2, reward: 70, ev: 'win' },
  { id: 'play3', text: 'Bestreite 3 Kämpfe', goal: 3, reward: 50, ev: 'match' },
  { id: 'cast30', text: 'Wirke 30 Zauber', goal: 30, reward: 50, ev: 'cast' },
  { id: 'dmg500', text: 'Verursache 500 Schaden', goal: 500, reward: 60, ev: 'dmg' },
  { id: 'heal150', text: 'Heile insgesamt 150 Leben', goal: 150, reward: 50, ev: 'heal' },
  { id: 'rare8', text: 'Wirke 8 seltene (oder bessere) Zauber', goal: 8, reward: 80, ev: 'rarecast' },
  { id: 'win1', text: 'Gewinne einen Kampf', goal: 1, reward: 40, ev: 'win' },
  { id: 'acc', text: 'Wirke 10 Zauber mit über 85 % Genauigkeit', goal: 10, reward: 70, ev: 'precise' },
];
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ------------------------------------------------------------ Store
function fresh() {
  const copies = {};
  for (const id of STARTER) copies[id] = 1;
  return {
    v: 2, pid: 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36), name: 'Zauberer', coins: 300, xp: 0, trophies: 0, bestTrophies: 0,
    copies, deck: STARTER.slice(), skin: 'azur', skins: ['azur', 'purpur'], freePacks: 0,
    pity: { legendary: 0, mythic: 0 },
    stats: { wins: 0, losses: 0, draws: 0, packs: 0, casts: 0, dmg: 0, streak: 0, bestStreak: 0 },
    quests: { day: '', list: [] }, daily: { last: '', streak: 0 },
    settings: { sound: true, music: true, volume: 0.7, vibe: true, fxLow: false }, tutorial: false, seen: {},
  };
}

export class Store {
  constructor(storage = (typeof localStorage !== 'undefined' ? localStorage : null), rng = Math.random) {
    this.storage = storage; this.rng = rng; this.listeners = [];
    this.d = this.load();
    this.ensureQuests();
  }
  load() {
    try {
      const raw = this.storage && this.storage.getItem(SAVE_KEY);
      if (raw) { const d = JSON.parse(raw); if (d && d.v === 2) return { ...fresh(), ...d, stats: { ...fresh().stats, ...d.stats }, settings: { ...fresh().settings, ...d.settings }, pity: { ...fresh().pity, ...d.pity } }; }
    } catch { /* kaputter Spielstand -> neu */ }
    return fresh();
  }
  save() { try { this.storage && this.storage.setItem(SAVE_KEY, JSON.stringify(this.d)); } catch { /* voll/gesperrt */ } this.listeners.forEach((f) => f(this.d)); }
  onChange(f) { this.listeners.push(f); }
  reset() { this.d = fresh(); this.ensureQuests(); this.save(); }
  // Fortschritts-Code: Spielstand als Text zum Sichern oder Umziehen auf ein anderes Gerät
  exportCode() { const json = JSON.stringify(this.d); const b = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json).toString('base64'); return 'SP2-' + b; }
  importCode(code) {
    try {
      const t = String(code).trim().replace(/\s+/g, ''); if (!t.startsWith('SP2-')) return false;
      const b = t.slice(4); const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(b))) : Buffer.from(b, 'base64').toString();
      const d = JSON.parse(json); if (!d || d.v !== 2 || typeof d.copies !== 'object' || !Array.isArray(d.deck)) return false;
      this.d = { ...fresh(), ...d, stats: { ...fresh().stats, ...d.stats }, settings: { ...fresh().settings, ...d.settings }, pity: { ...fresh().pity, ...d.pity } };
      this.d.deck = this.d.deck.filter((id) => this.d.copies[id] > 0); if (this.d.deck.length < 3) this.d.deck = STARTER.slice();
      this.ensureQuests(); this.save(); return true;
    } catch { return false; }
  }

  // ---- Abgeleitetes
  get level() { return levelInfo(this.d.xp).lvl; }
  get slots() { return deckSlots(this.level); }
  get rank() { return rankOf(this.d.trophies); }
  copies(id) { return this.d.copies[id] || 0; }
  spellLevel(id) { return levelFor(this.copies(id)); }
  owned(id) { return this.copies(id) > 0; }
  nextCopies(id) { const c = this.copies(id), l = levelFor(c); return l >= MAX_LEVEL ? null : LEVEL_COPIES[l]; }
  skin() { return SKIN_BY_ID[this.d.skin] || SKINS[0]; }
  skinData() { const s = this.skin(); return { robe: s.robe, trim: s.trim, hat: s.hat }; }
  deckLevels() { return Object.fromEntries(this.d.deck.map((id) => [id, Math.max(1, this.spellLevel(id))])); }
  battleProfile() { const d = this.d; return { pid: d.pid, name: d.name, trophies: d.trophies, deck: d.deck.slice(), levels: this.deckLevels(), skin: this.skinData() }; }
  ownedCount() { return SPELLS.filter((s) => this.owned(s.id)).length; }

  // ---- Deck
  setName(n) { this.d.name = String(n).replace(/[<>\n\r]/g, '').trim().slice(0, 14) || 'Zauberer'; this.save(); }
  inDeck(id) { return this.d.deck.includes(id); }
  addToDeck(id, replaceId) {
    if (!this.owned(id) || this.inDeck(id)) return false;
    if (this.d.deck.length < this.slots) this.d.deck.push(id);
    else if (replaceId && this.inDeck(replaceId)) this.d.deck[this.d.deck.indexOf(replaceId)] = id;
    else return false;
    this.save(); return true;
  }
  removeFromDeck(id) { if (this.d.deck.length <= 3 || !this.inDeck(id)) return false; this.d.deck = this.d.deck.filter((x) => x !== id); this.save(); return true; }
  deckOk() { return this.d.deck.length >= 3; }

  // ---- Münzen / Pakete
  addCoins(n) { this.d.coins = Math.max(0, this.d.coins + Math.round(n)); }
  /** Würfelt ein Paket. `free`: Gratis-Paket aus freePacks. Gibt null zurück, wenn nicht bezahlbar. */
  openPack(type = 'basic', free = false) {
    const P = PACKS[type], d = this.d;
    if (free) { if (d.freePacks < 1 || type !== 'basic') return null; d.freePacks--; }
    else { if (d.coins < P.price) return null; d.coins -= P.price; }
    d.stats.packs++;
    const cards = [];
    let gotLeg = false, gotMyth = false;
    for (let k = 0; k < P.cards; k++) {
      const last = k === P.cards - 1;
      let r = pickIdx(last ? P.lastOdds : P.odds, this.rng);
      // Pech-Schutz: der zählt pro Paket, nicht pro Karte
      if (last && !gotMyth && d.pity.mythic + 1 >= PITY.mythic) r = 4;
      else if (last && !gotLeg && r < 3 && d.pity.legendary + 1 >= PITY.legendary) r = 3;
      if (r >= 3) gotLeg = true; if (r === 4) gotMyth = true;
      cards.push(this.rollCard(RARITY_ORDER[r]));
    }
    d.pity.legendary = gotLeg ? 0 : d.pity.legendary + 1;
    d.pity.mythic = gotMyth ? 0 : d.pity.mythic + 1;
    // anwenden
    for (const c of cards) {
      const before = this.copies(c.id), lvBefore = levelFor(before);
      c.isNew = before === 0;
      if (before >= LEVEL_COPIES[MAX_LEVEL - 1]) { c.refund = RARITIES[c.rarity].refund; d.coins += c.refund; }
      else d.copies[c.id] = before + 1;
      c.copies = this.copies(c.id); c.levelUp = levelFor(c.copies) > lvBefore && !c.isNew; c.level = levelFor(c.copies);
    }
    this.save();
    return cards;
  }
  rollCard(rarity) {
    const pool = SPELLS.filter((s) => s.rarity === rarity);
    const w = pool.map((s) => (this.owned(s.id) ? 1 : 2)); // Neues leicht bevorzugt
    let x = this.rng() * w.reduce((a, b) => a + b, 0), i = 0;
    for (; i < pool.length - 1; i++) { x -= w[i]; if (x <= 0) break; }
    return { id: pool[i].id, rarity };
  }

  // ---- XP / Stufen
  addXp(n) {
    const before = this.level;
    this.d.xp += Math.round(n);
    const after = this.level, ups = [];
    for (let l = before + 1; l <= after; l++) {
      const r = levelReward(l); this.d.coins += r.coins; if (r.pack) this.d.freePacks++;
      ups.push({ lvl: l, coins: r.coins, pack: r.pack, slot: deckSlots(l) > deckSlots(l - 1) });
    }
    return ups;
  }

  // ---- Skins
  skinUnlocked(s) { return this.d.skins.includes(s.id); }
  skinAvailable(s) {
    if (s.how === 'free' || this.skinUnlocked(s)) return true;
    if (s.how === 'level') return this.level >= s.level;
    if (s.how === 'trophies') return this.d.bestTrophies >= s.trophies;
    return false;
  }
  buySkin(id) {
    const s = SKIN_BY_ID[id]; if (!s) return false;
    if (this.skinUnlocked(s)) return true;
    if (s.how === 'coins') { if (this.d.coins < s.price) return false; this.d.coins -= s.price; }
    else if (!this.skinAvailable(s)) return false;
    this.d.skins.push(id); this.save(); return true;
  }
  wear(id) { const s = SKIN_BY_ID[id]; if (!s || !(this.skinUnlocked(s) || this.skinAvailable(s))) return false; if (!this.skinUnlocked(s)) this.d.skins.push(id); this.d.skin = id; this.save(); return true; }

  // ---- Tagesgeschenk / Aufgaben
  dailyReady() { return this.d.daily.last !== dayKey(); }
  claimDaily() {
    if (!this.dailyReady()) return null;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const streak = this.d.daily.last === dayKey(y) ? Math.min(7, this.d.daily.streak + 1) : 1;
    const coins = 40 + 15 * streak;
    this.d.daily = { last: dayKey(), streak }; this.d.coins += coins;
    if (streak === 7) this.d.freePacks++;
    this.save(); return { coins, streak, pack: streak === 7 };
  }
  ensureQuests() {
    const today = dayKey();
    if (this.d.quests.day === today && this.d.quests.list.length) return;
    const pool = QUEST_POOL.slice(), list = [];
    while (list.length < 3 && pool.length) {
      const q = pool.splice(Math.floor(this.rng() * pool.length), 1)[0];
      if (list.some((x) => x.ev === q.ev && x.ev !== 'cast')) continue; // keine doppelten Arten
      list.push({ ...q, prog: 0, claimed: false });
    }
    this.d.quests = { day: today, list };
    this.save();
  }
  questDone(q) { return q.prog >= q.goal; }
  claimQuest(i) {
    const q = this.d.quests.list[i];
    if (!q || q.claimed || !this.questDone(q)) return null;
    q.claimed = true; this.d.coins += q.reward; this.save(); return q.reward;
  }
  bump(ev, n = 1) { for (const q of this.d.quests.list) if (q.ev === ev && !q.claimed) q.prog = Math.min(q.goal, q.prog + n); }

  // ---- Kampfergebnis anwenden
  /** res: {won, draw, lost, mode, stats:{dmg,heal,casts,acc}, opponent:{trophies}, casts:[{id,acc}]}  */
  applyResult(res) {
    this.ensureQuests();
    if (res.mode === 'practice') return { coins: 0, xp: 0, trophies: 0, ups: [], rankUp: false, rankDown: false, questsDone: [], practice: true, rank: this.rank };
    const d = this.d, online = res.mode === 'online' || res.mode === 'offline';
    const out = { coins: 0, xp: 0, trophies: 0, ups: [], rankUp: false, rankDown: false, questsDone: [], tutorial: res.mode === 'tutorial' };
    const rankBefore = this.rank.idx;
    const s = res.stats || { dmg: 0, heal: 0, casts: 0 };
    if (res.mode === 'tutorial') { out.xp = 40; out.pack = true; if (!d.tutorial) { d.tutorial = true; d.freePacks++; } }
    else if (online) {
      const opp = res.opponent ? res.opponent.trophies : d.trophies, diff = opp - d.trophies;
      if (res.won) { out.trophies = Math.round(Math.max(12, Math.min(38, 24 + diff / 25))); out.coins = 30; out.xp = 45; d.stats.wins++; d.stats.streak++; d.stats.bestStreak = Math.max(d.stats.bestStreak, d.stats.streak); if (d.stats.streak >= 3) out.coins += 10; }
      else if (res.draw) { out.coins = 12; out.xp = 22; d.stats.draws++; }
      else { out.trophies = -Math.round(Math.max(8, Math.min(24, 16 - diff / 40))); if (d.trophies + out.trophies < 0) out.trophies = -d.trophies; out.coins = 10; out.xp = 20; d.stats.losses++; d.stats.streak = 0; }
    } else { // Training: nur etwas Erfahrung
      out.xp = res.won ? 12 : 6;
    }
    d.trophies = Math.max(0, d.trophies + out.trophies); d.bestTrophies = Math.max(d.bestTrophies, d.trophies);
    d.stats.casts += s.casts || 0; d.stats.dmg += s.dmg || 0;
    this.addCoins(out.coins);
    out.ups = this.addXp(out.xp);
    for (const u of out.ups) { out.coins += u.coins; }
    const after = this.rank.idx; out.rankUp = after > rankBefore; out.rankDown = after < rankBefore; out.rank = this.rank;
    // Aufgaben
    const before = this.d.quests.list.map((q) => this.questDone(q));
    if (res.mode !== 'tutorial') {
      this.bump('match', 1); if (res.won) this.bump('win', 1);
      this.bump('cast', s.casts || 0); this.bump('dmg', s.dmg || 0); this.bump('heal', s.heal || 0);
      for (const c of res.casts || []) { if (SPELL_BY_ID[c.id] && SPELL_BY_ID[c.id].rarity !== 'common') this.bump('rarecast', 1); if (c.acc >= 0.85) this.bump('precise', 1); }
    }
    this.d.quests.list.forEach((q, i) => { if (!before[i] && this.questDone(q)) out.questsDone.push(q.text); });
    this.save();
    return out;
  }
}

export { dayKey };
