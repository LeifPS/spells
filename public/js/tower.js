import { botDeck, botLevels } from './bot.js';
// Zauberturm: 10 Etagen gegen Bots, jede mit einer eigenen Regel. Reine Daten (auch für Tests).
export const MODS = {
  none:   { name: 'Keine Besonderheit', icon: 'sparkle', desc: 'Ein ganz normaler Kampf.' },
  rush:   { name: 'Manaflut', icon: 'drop', desc: 'Mana regeneriert doppelt so schnell – es wird hektisch!', sim: { regen: 2 } },
  swift:  { name: 'Zeitschleife', icon: 'clock', desc: 'Alle Abklingzeiten sind 40 % kürzer.', sim: { cd: 0.6 } },
  wither: { name: 'Dürre', icon: 'leaf', desc: 'Heilung wirkt nur halb so stark.', sim: { heal: 0.5 } },
  glass:  { name: 'Glaskanone', icon: 'bolt', desc: 'Aller Schaden ist um die Hälfte höher – kurze Kämpfe!', sim: { dmg: [1.5, 1.5] } },
  armor:  { name: 'Rüstung', icon: 'shield', desc: 'Der Gegner startet mit einem Schild (80).', sim: { shieldFoe: 80 } },
  boss:   { name: 'Übermacht', icon: 'skull', desc: 'Der Gegner startet mit Schild (80) und teilt 20 % mehr Schaden aus.', sim: { shieldFoe: 80, dmgFoe: 1.2 } },
};

// bot = Bot-Stufe (1-3), cap = höchste Seltenheit im Bot-Deck (0 gewöhnlich … 4 mythisch)
export const FLOORS = [
  { n: 1,  name: 'Eingangshalle',  guard: 'Torwächter',    bot: 1, cap: 1, mod: 'none',   reward: { coins: 30, xp: 25 },            theme: 'wald' },
  { n: 2,  name: 'Nebelgasse',     guard: 'Nebelhexe',     bot: 1, cap: 1, mod: 'rush',   reward: { coins: 35, xp: 25 },            theme: 'eis' },
  { n: 3,  name: 'Flammenarchiv',  guard: 'Aschenzwerg',   bot: 2, cap: 1, mod: 'wither', reward: { coins: 40, xp: 30 },            theme: 'vulkan' },
  { n: 4,  name: 'Glockenturm',    guard: 'Mondmagier',    bot: 2, cap: 2, mod: 'swift',  reward: { coins: 45, xp: 30 },            theme: 'tempel' },
  { n: 5,  name: 'Pforte des Hüters', guard: 'Hüter der Pforte', bot: 2, cap: 2, mod: 'armor', reward: { coins: 80, xp: 50, pack: true }, theme: 'tempel', boss: true },
  { n: 6,  name: 'Sternwarte',     guard: 'Sternenwirt',   bot: 2, cap: 3, mod: 'glass',  reward: { coins: 55, xp: 35 },            theme: 'wald' },
  { n: 7,  name: 'Spiegelsaal',    guard: 'Spiegelmagier', bot: 3, cap: 3, mod: 'rush',   reward: { coins: 60, xp: 40 },            theme: 'eis' },
  { n: 8,  name: 'Aschenkammer',   guard: 'Funkenfee',     bot: 3, cap: 3, mod: 'wither', reward: { coins: 70, xp: 45 },            theme: 'vulkan' },
  { n: 9,  name: 'Zeitgewölbe',    guard: 'Donnerkater',   bot: 3, cap: 4, mod: 'swift',  reward: { coins: 80, xp: 50 },            theme: 'tempel' },
  { n: 10, name: 'Gipfel',         guard: 'Erzmagier Nox', bot: 3, cap: 4, mod: 'boss',   reward: { coins: 150, xp: 100, pack: true }, theme: 'vulkan', boss: true },
];
export const BOT_ROBES = ['#c0392b', '#16a085', '#8e44ad', '#2c6fd1', '#d35400', '#34495e', '#c2185b', '#00838f', '#6d4c41', '#1b1b3a'];

/** Regeln der Etage in Spieler-Indizes umrechnen (you = Index des Menschen) */
export function simMods(floor, you) {
  const m = (MODS[floor.mod] || MODS.none).sim || {};
  const foe = 1 - you;
  const out = { regen: m.regen || 1, cd: m.cd || 1, heal: m.heal || 1, dmg: [1, 1], shield0: [0, 0] };
  if (m.dmg) out.dmg = m.dmg.slice();
  if (m.dmgFoe) out.dmg[foe] = m.dmgFoe;
  if (m.shieldFoe) out.shield0[foe] = m.shieldFoe;
  return out;
}

/** Optionen für battle.play() einer Etage */
export function towerOpts(floor) {
  return {
    mode: 'tower', level: floor.bot, floor, theme: floor.theme,
    botDeck: botDeck(floor.cap, floor.bot), botName: floor.guard,
    botSkin: { robe: BOT_ROBES[(floor.n - 1) % BOT_ROBES.length], trim: floor.boss ? '#ff6a6a' : '#ffd86b', hat: floor.n % 3 },
  };
}
