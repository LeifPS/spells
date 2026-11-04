// Seltenheiten, Zauber, Stufen. Wird von Browser UND Worker benutzt.
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];

// thr = Mindest-Genauigkeit zum Wirken. Seltene Zauber sind schwerer zu zeichnen UND stärker.
export const RARITIES = {
  common:    { name: 'Gewöhnlich', color: '#b9c3d6', glow: '#7f8aa3', thr: 0.60, refund: 10 },
  rare:      { name: 'Selten',     color: '#4da8ff', glow: '#2377d8', thr: 0.66, refund: 25 },
  epic:      { name: 'Episch',     color: '#b565ff', glow: '#8130d8', thr: 0.70, refund: 60 },
  legendary: { name: 'Legendär',   color: '#ffb52e', glow: '#d97a00', thr: 0.74, refund: 150 },
  mythic:    { name: 'Mythisch',   color: '#ff4a7d', glow: '#d3123f', thr: 0.76, refund: 400 },
};

// Kopien nötig für Stufe 1..6 (Stufe n braucht LEVEL_COPIES[n-1] Kopien insgesamt)
export const LEVEL_COPIES = [1, 2, 4, 8, 16, 32];
export const MAX_LEVEL = LEVEL_COPIES.length;
export const levelFor = (copies) => {
  let l = 0;
  for (let i = 0; i < LEVEL_COPIES.length; i++) if (copies >= LEVEL_COPIES[i]) l = i + 1;
  return l;
};
export const levelMul = (lvl) => 1 + 0.07 * (Math.max(1, lvl) - 1);

// Spielwerte (siehe sim.js). cost = Mana, cd = Abklingzeit (s), travel = Flugzeit (s, null = Selbstzauber)
// fx: dmg, hits, hitGap, burn[dps,s], poison[dps,s], chill s, stun s, gcdHit s, shieldBreak,
//     heal, shield[menge,s], mana, drain (Anteil), cleanse, reflect s, phase s, haste s, pierce
export const SPELLS = [
  // ---------------- Gewöhnlich (einfache Formen)
  { id: 'feuerball',   name: 'Feuerball',    rarity: 'common', shape: 'circle',    color: '#ff7a2f', cost: 14, cd: 2.0, travel: 0.75, fx: { dmg: 16, burn: [3, 3] }, lore: 'Der Klassiker. Brennt noch nach.' },
  { id: 'eissplitter', name: 'Eissplitter',  rarity: 'common', shape: 'vline',     color: '#8fe3ff', cost: 12, cd: 1.8, travel: 0.45, fx: { dmg: 12, chill: 3 },     lore: 'Schnell und eiskalt – bremst den Gegner.' },
  { id: 'windstoss',   name: 'Windstoß',     rarity: 'common', shape: 'caret',     color: '#c8f2ff', cost: 10, cd: 1.5, travel: 0.5,  fx: { dmg: 14, gcdHit: 0.6 },  lore: 'Wirft den Gegner aus dem Takt.' },
  { id: 'klingenhieb', name: 'Klingenhieb',  rarity: 'common', shape: 'vee',       color: '#dbe6ff', cost: 12, cd: 1.4, travel: 0.35, fx: { dmg: 13 },               lore: 'Ein schneller Schnitt aus Licht.' },
  { id: 'heilfunke',   name: 'Heilfunke',    rarity: 'common', shape: 'arrow',     color: '#5cf08a', cost: 16, cd: 3.5, travel: null, fx: { heal: 26 },              lore: 'Ein kleiner Funke Lebenskraft.' },
  { id: 'erdbrocken',  name: 'Erdbrocken',   rarity: 'common', shape: 'slash',     color: '#c9a06e', cost: 16, cd: 2.4, travel: 0.95, fx: { dmg: 22 },               lore: 'Langsam, aber er schlägt hart zu.' },
  { id: 'manaquelle',  name: 'Manaquelle',   rarity: 'common', shape: 'hline',     color: '#62a8ff', cost: 0,  cd: 8.0, travel: null, fx: { mana: 32 },              lore: 'Ein Zug aus der Quelle füllt dein Mana.' },
  { id: 'funkenschuss',name: 'Funkenschuss', rarity: 'common', shape: 'backslash', color: '#ffe07a', cost: 7,  cd: 1.0, travel: 0.32, fx: { dmg: 8 },                lore: 'Billig und flink – zum Nerven.' },
  // ---------------- Selten
  { id: 'blitz',        name: 'Blitzschlag',  rarity: 'rare', shape: 'zigzag',    color: '#ffe14d', cost: 24, cd: 3.5, travel: 0.22, fx: { dmg: 30 },                     lore: 'Schneller als jede Antwort.' },
  { id: 'schlangenbiss',name: 'Schlangenbiss',rarity: 'rare', shape: 'sshape',    color: '#7dff6b', cost: 20, cd: 3.5, travel: 0.6,  fx: { dmg: 10, poison: [5, 5] },     lore: 'Gift umgeht jeden Schild.' },
  { id: 'giftwolke',    name: 'Giftwolke',    rarity: 'rare', shape: 'triangle',  color: '#a6ff4d', cost: 22, cd: 4.0, travel: 0.85, fx: { dmg: 5, poison: [7, 6] },      lore: 'Eine giftgrüne Wolke, die lange wirkt.' },
  { id: 'schutzwall',   name: 'Schutzwall',   rarity: 'rare', shape: 'gate',      color: '#6aa8ff', cost: 22, cd: 6.0, travel: null, fx: { shield: [40, 7] },             lore: 'Ein Tor aus Licht fängt Schaden ab.' },
  { id: 'lichtkreuz',   name: 'Lichtkreuz',   rarity: 'rare', shape: 'dagger',    color: '#fff2a8', cost: 24, cd: 4.0, travel: 0.5,  fx: { dmg: 20, heal: 16 },           lore: 'Verletzt den Gegner, heilt dich.' },
  { id: 'eisstoss',     name: 'Eisstoß',      rarity: 'rare', shape: 'nshape',    color: '#7fd8ff', cost: 24, cd: 4.0, travel: 0.55, fx: { dmg: 18, chill: 5 },           lore: 'Lange Kälte, lähmt Zauber.' },
  { id: 'zeitsand',     name: 'Zeitsand',     rarity: 'rare', shape: 'hourglass', color: '#ffcf6b', cost: 26, cd: 7.0, travel: 0.5,  fx: { dmg: 8, stun: 1.6 },           lore: 'Die Zeit bleibt kurz stehen.' },
  { id: 'spiegel',      name: 'Spiegelschild',rarity: 'rare', shape: 'bshape',    color: '#dcdcff', cost: 26, cd: 9.0, travel: null, fx: { reflect: 5 },                  lore: 'Der nächste Angriff fliegt zurück.' },
  // ---------------- Episch
  { id: 'herzkraft',   name: 'Herzkraft',    rarity: 'epic', shape: 'heart',    color: '#ff6fa5', cost: 34, cd: 8.0,  travel: null, fx: { heal: 50, shield: [20, 6] },                lore: 'Pure Lebensenergie.' },
  { id: 'pentagramm',  name: 'Pentagramm',   rarity: 'epic', shape: 'star',     color: '#c05cff', cost: 38, cd: 6.0,  travel: 0.9,  fx: { dmg: 52 },                                  lore: 'Ein Siegel, das alles trifft.' },
  { id: 'himmelstor',  name: 'Himmelstor',   rarity: 'epic', shape: 'omega',    color: '#9fe6ff', cost: 34, cd: 9.0,  travel: null, fx: { shield: [50, 7], cleanse: true, mana: 10 }, lore: 'Reinigt dich und schützt dich.' },
  { id: 'fackel',      name: 'Fackel',       rarity: 'epic', shape: 'lollipop', color: '#ff9a3f', cost: 30, cd: 5.0,  travel: 0.8,  fx: { dmg: 22, burn: [6, 5] },                    lore: 'Brennt hell. Und lange.' },
  { id: 'zeitriss',    name: 'Zeitriss',     rarity: 'epic', shape: 'eight',    color: '#8c9bff', cost: 36, cd: 10.0, travel: 0.5,  fx: { dmg: 18, stun: 2.2, chill: 4 },             lore: 'Reißt ein Loch in die Zeit.' },
  // ---------------- Legendär
  { id: 'seelenraub',   name: 'Seelenraub',   rarity: 'legendary', shape: 'infinity', color: '#e04dff', cost: 50, cd: 10, travel: 0.85, fx: { dmg: 40, drain: 1, mana: 10 },          lore: 'Was er nimmt, gehört nun dir.' },
  { id: 'schwarzesloch',name: 'Schwarzes Loch',rarity:'legendary', shape: 'spiral',   color: '#8a5cff', cost: 55, cd: 12, travel: 1.35, fx: { dmg: 70, chill: 4, shieldBreak: true }, lore: 'Verschluckt Schilde, dann dich.' },
  { id: 'labyrinth',    name: 'Labyrinth',    rarity: 'legendary', shape: 'maze',     color: '#ffd35c', cost: 52, cd: 12, travel: 0.6,  fx: { dmg: 25, stun: 3 },                     lore: 'Wer hineingeht, findet nicht mehr hinaus.' },
  { id: 'donnerschlag', name: 'Donnerschlag', rarity: 'legendary', shape: 'storm',    color: '#fff08a', cost: 55, cd: 11, travel: 0.25, fx: { dmg: 14, hits: 5, hitGap: 0.18 },       lore: 'Fünf Blitze in einem Atemzug.' },
  // ---------------- Mythisch
  { id: 'weltenfeuer',   name: 'Weltenfeuer',    rarity: 'mythic', shape: 'sunstar', color: '#ff3b3b', cost: 75, cd: 18, travel: 1.0, fx: { dmg: 90, burn: [10, 5] },                                         lore: 'Eine Sonne, geboren aus einem Kreis.' },
  { id: 'schicksalsklee',name: 'Schicksalsklee', rarity: 'mythic', shape: 'clover',  color: '#37ffb0', cost: 70, cd: 20, travel: null, fx: { shield: [70, 8], heal: 70, cleanse: true, haste: 6, reflect: 3 }, lore: 'Wer ihn findet, hat Glück. Immer.' },
  { id: 'sternenbluete', name: 'Sternenblüte',   rarity: 'mythic', shape: 'rose5',   color: '#ff8fd8', cost: 80, cd: 22, travel: 1.4, fx: { dmg: 18, hits: 6, hitGap: 0.3, chill: 4, pierce: true },          lore: 'Sechs Sterne fallen. Kein Entkommen.' },
];

export const SPELL_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
export const spellThr = (sp) => RARITIES[sp.rarity].thr;
export const isHostile = (sp) => {
  const f = sp.fx;
  return !!(f.dmg || f.burn || f.poison || f.chill || f.stun || f.gcdHit || f.shieldBreak);
};

// Genauigkeit -> Stärke 0.80 .. 1.15
export function powerFactor(acc, thr) {
  const n = Math.min(1, Math.max(0, (acc - thr) / (0.95 - thr)));
  return 0.8 + 0.35 * n;
}

export function describeParts(sp, lvl = 1) {
  const f = sp.fx, m = levelMul(lvl), r = (v) => Math.round(v * m);
  const out = [];
  if (f.dmg) out.push({ i: '⚔', t: f.hits > 1 ? `${r(f.dmg)} × ${f.hits} Schaden` : `${r(f.dmg)} Schaden` });
  if (f.burn) out.push({ i: '🔥', t: `Brennen ${r(f.burn[0])}/s · ${f.burn[1]} s` });
  if (f.poison) out.push({ i: '☠', t: `Gift ${r(f.poison[0])}/s · ${f.poison[1]} s` });
  if (f.chill) out.push({ i: '❄', t: `Frost ${f.chill} s (langsamer, weniger Mana)` });
  if (f.stun) out.push({ i: '💫', t: `Betäubt ${f.stun} s` });
  if (f.gcdHit) out.push({ i: '💨', t: `Gegner wartet +${f.gcdHit} s` });
  if (f.shieldBreak) out.push({ i: '🕳', t: 'Zerstört Schilde' });
  if (f.drain) out.push({ i: '🩸', t: `Lebensraub ${Math.round(f.drain * 100)}%` });
  if (f.heal) out.push({ i: '❤', t: `Heilt ${r(f.heal)}` });
  if (f.shield) out.push({ i: '🛡', t: `Schild ${r(f.shield[0])} · ${f.shield[1]} s` });
  if (f.mana) out.push({ i: '💧', t: `+${f.mana} Mana` });
  if (f.cleanse) out.push({ i: '✨', t: 'Entfernt Brennen, Gift, Frost, Betäubung' });
  if (f.reflect) out.push({ i: '🪞', t: `Reflektiert den nächsten Angriff (${f.reflect} s)` });
  if (f.phase) out.push({ i: '👻', t: `Weicht aus (${f.phase} s)` });
  if (f.haste) out.push({ i: '⚡', t: `Hast ${f.haste} s` });
  if (f.pierce) out.push({ i: '🎯', t: 'Unblockbar' });
  return out;
}

export const roleOf = (sp) => {
  const f = sp.fx;
  if (f.dmg || f.burn || f.poison) return 'attack';
  if (f.shield || f.reflect || f.phase) return 'defense';
  if (f.heal) return 'heal';
  return 'utility';
};
export const ROLE_ICON = { attack: '⚔', defense: '🛡', heal: '❤', utility: '💧' };
