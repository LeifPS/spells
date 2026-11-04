// Gemeinsame Daten: Seltenheiten, Formen (Vorlagen zum Nachzeichnen) und Zauber.
// Wird vom Browser UND vom Worker importiert.

const TAU = Math.PI * 2;

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];

// thr = Mindest-Genauigkeit (0..1), damit der Zauber gelingt. Höher = schwerer.
// weight = Gewicht im Paket, refund = Münzen bei Duplikat.
export const RARITIES = {
  common:    { name: 'Gewöhnlich', color: '#aab4c6', thr: 0.60, weight: 60, refund: 15 },
  rare:      { name: 'Selten',     color: '#4da3ff', thr: 0.66, weight: 25, refund: 30 },
  epic:      { name: 'Episch',     color: '#b45cff', thr: 0.70, weight: 10, refund: 80 },
  legendary: { name: 'Legendär',   color: '#ffb020', thr: 0.74, weight: 4,  refund: 200 },
  mythic:    { name: 'Mythisch',   color: '#ff3b6b', thr: 0.76, weight: 1,  refund: 500 },
};

// ---------- Formen (Koordinaten 0..1, y nach unten) ----------
const circle = (n = 48) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * TAU;
    return [0.5 + 0.5 * Math.sin(t), 0.5 - 0.5 * Math.cos(t)];
  });

const heart = (n = 60) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * TAU;
    return [
      16 * Math.sin(t) ** 3,
      -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
    ];
  });

const starPts = () => {
  const v = (k) => {
    const a = (-90 + 72 * k) * (Math.PI / 180);
    return [0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)];
  };
  return [0, 2, 4, 1, 3, 0].map(v);
};

const infinity = (n = 60) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * TAU;
    return [Math.sin(t), Math.sin(t) * Math.cos(t)];
  });

const spiral = (n = 90, turns = 2) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const f = i / n;
    const r = 0.04 + 0.46 * (1 - f);
    const a = f * turns * TAU;
    return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)];
  });

// Kleeblatt (3-Blatt-Rose), geschlossen
const clover = (n = 90) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const th = (i / n) * Math.PI;
    const r = Math.cos(3 * th);
    return [r * Math.cos(th), r * Math.sin(th)];
  });

// S-Kurve (Schild)
function sCurve(n = 60) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [0.5 + 0.5 * Math.sin(t * TAU), t];
  });
}

// Omega: Fußlinien + fast geschlossener Bogen
function omega(n = 60) {
  const pts = [[0, 1], [0.3, 1], [0.27, 0.8]];
  for (let i = 0; i <= n; i++) {
    const a = ((125 + (290 * i) / n) * Math.PI) / 180; // von links unten über oben nach rechts unten
    pts.push([0.5 + 0.38 * Math.cos(a), 0.42 + 0.38 * Math.sin(a)]);
  }
  pts.push([0.73, 0.8], [0.7, 1], [1, 1]);
  return pts;
}

// Kreis, danach (vom selben Startpunkt oben) ein Pentagramm
const sunstar = () => [...circle(48), ...starPts().slice(1)];

export const SHAPES = {
  circle:   { closed: true, pts: circle() },
  line:     { pts: [[0.5, 0], [0.5, 1]] },
  caret:    { pts: [[0, 1], [0.5, 0], [1, 1]] },
  vee:      { pts: [[0, 0], [0.5, 1], [1, 0]] },
  arrow:    { pts: [[0.5, 1], [0.5, 0], [0.2, 0.32], [0.5, 0], [0.8, 0.32]] },
  gate:     { pts: [[0, 1], [0, 0], [1, 0], [1, 1]] },
  omega:    { pts: omega() },
  dagger:   { pts: [[0.5, 0], [0.5, 1], [0.5, 0.3], [0.1, 0.3], [0.9, 0.3]] },
  zigzag:   { pts: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  sshape:   { pts: sCurve() },
  triangle: { closed: true, pts: [[0.5, 0], [1, 1], [0, 1], [0.5, 0]] },
  wave:     { pts: [[0, 0], [0.25, 1], [0.5, 0.3], [0.75, 1], [1, 0]] },
  heart:    { closed: true, pts: heart() },
  star:     { closed: true, pts: starPts() },
  infinity: { closed: true, pts: infinity() },
  spiral:   { mirror: true, pts: spiral() },
  sunstar:  { mirror: true, pts: sunstar() },
  clover:   { closed: true, pts: clover() },
};

// ---------- Zauber ----------
// fx: dmg, heal, shield, burn:[schaden,runden], poison:[schaden,runden],
//     chill (nächster gegnerischer Schadenszauber -35%), drain (Anteil des Schadens als Heilung), cleanse
export const SPELLS = [
  // Gewöhnlich
  { id: 'feuerball',   name: 'Feuerball',        rarity: 'common', shape: 'circle',   vfx: 'fireball', color: '#ff7a2f', fx: { dmg: 22, burn: [3, 3] } },
  { id: 'eissplitter', name: 'Eissplitter',      rarity: 'common', shape: 'line',     vfx: 'shard',    color: '#8fe3ff', fx: { dmg: 18, chill: true } },
  { id: 'windstoss',   name: 'Windstoß',         rarity: 'common', shape: 'caret',    vfx: 'gust',     color: '#c8f2ff', fx: { dmg: 26 } },
  { id: 'heilfunke',   name: 'Heilfunke',        rarity: 'common', shape: 'arrow',    vfx: 'heal',     color: '#5cf08a', fx: { heal: 24 } },
  { id: 'klingenhieb', name: 'Klingenhieb',      rarity: 'common', shape: 'vee',      vfx: 'shard',    color: '#d6e4ff', fx: { dmg: 24 } },
  // Selten
  { id: 'blitz',       name: 'Blitzschlag',      rarity: 'rare',   shape: 'zigzag',   vfx: 'bolt',     color: '#ffe14d', fx: { dmg: 42 } },
  { id: 'schutzwall',  name: 'Schutzwall',       rarity: 'rare',   shape: 'gate',     vfx: 'shield',   color: '#6aa8ff', fx: { shield: 40 } },
  { id: 'giftwolke',   name: 'Giftwolke',        rarity: 'rare',   shape: 'triangle', vfx: 'cloud',    color: '#8dff4d', fx: { dmg: 12, poison: [8, 4] } },
  { id: 'schlangenbiss', name: 'Schlangenbiss',  rarity: 'rare',   shape: 'sshape',   vfx: 'cloud',    color: '#7dff6b', fx: { dmg: 16, poison: [9, 3] } },
  { id: 'lichtkreuz',  name: 'Lichtkreuz',       rarity: 'rare',   shape: 'dagger',   vfx: 'bolt',     color: '#fff2a8', fx: { dmg: 28, heal: 14 } },
  // Episch
  { id: 'eissturm',    name: 'Eissturm',         rarity: 'epic',   shape: 'wave',     vfx: 'storm',    color: '#7fd8ff', fx: { dmg: 38, chill: true } },
  { id: 'herzkraft',   name: 'Herzkraft',        rarity: 'epic',   shape: 'heart',    vfx: 'heart',    color: '#ff6fa5', fx: { heal: 55, shield: 20 } },
  { id: 'pentagramm',  name: 'Pentagramm',       rarity: 'epic',   shape: 'star',     vfx: 'pentagram',color: '#c05cff', fx: { dmg: 62 } },
  { id: 'himmelstor',  name: 'Himmelstor',       rarity: 'epic',   shape: 'omega',    vfx: 'shield',   color: '#9fe6ff', fx: { shield: 55, heal: 30 } },
  // Legendär
  { id: 'schwarzesloch', name: 'Schwarzes Loch', rarity: 'legendary', shape: 'spiral',   vfx: 'vortex', color: '#8a5cff', fx: { dmg: 80, drain: 0.3 } },
  { id: 'seelenraub',  name: 'Seelenraub',       rarity: 'legendary', shape: 'infinity', vfx: 'drain',  color: '#e04dff', fx: { dmg: 50, drain: 1.0 } },
  // Mythisch
  { id: 'weltenfeuer', name: 'Weltenfeuer',      rarity: 'mythic', shape: 'sunstar',  vfx: 'inferno',  color: '#ff3b3b', fx: { dmg: 110, burn: [10, 3] } },
  { id: 'schicksalsklee', name: 'Schicksalsklee',rarity: 'mythic', shape: 'clover',   vfx: 'clover',   color: '#37ffb0', fx: { shield: 70, heal: 60, cleanse: true } },
];

export const SPELL_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

export function describe(sp) {
  const f = sp.fx;
  const out = [];
  if (f.dmg) out.push(`${f.dmg} Schaden`);
  if (f.burn) out.push(`Brennen ${f.burn[0]}×${f.burn[1]}`);
  if (f.poison) out.push(`Gift ${f.poison[0]}×${f.poison[1]}`);
  if (f.chill) out.push('Frost: nächster Schadenszauber des Gegners −35%');
  if (f.drain) out.push(`Lebensraub ${Math.round(f.drain * 100)}%`);
  if (f.heal) out.push(`Heilt ${f.heal}`);
  if (f.shield) out.push(`Schild ${f.shield}`);
  if (f.cleanse) out.push('Entfernt Brennen, Gift & Frost');
  return out.join(' · ');
}
