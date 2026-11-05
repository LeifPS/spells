// Formen zum Nachzeichnen. Koordinaten 0..1 (y nach unten). Ein einziger Strich.
// closed = geschlossene Form (Startpunkt & Richtung egal), mirror = auch gespiegelt gültig.
const TAU = Math.PI * 2;
const N = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

const circle = (n = 48) => N(n, (t) => [0.5 + 0.5 * Math.sin(t * TAU), 0.5 - 0.5 * Math.cos(t * TAU)]);

const star = () => [0, 2, 4, 1, 3, 0].map((k) => {
  const a = (-90 + 72 * k) * (Math.PI / 180);
  return [0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)];
});

const heart = () => N(60, (t) => [
  16 * Math.sin(t * TAU) ** 3,
  -(13 * Math.cos(t * TAU) - 5 * Math.cos(2 * t * TAU) - 2 * Math.cos(3 * t * TAU) - Math.cos(4 * t * TAU)),
]);

const infinity = () => N(60, (t) => [Math.sin(t * TAU), Math.sin(t * TAU) * Math.cos(t * TAU)]);
const eight = () => N(60, (t) => [Math.sin(t * TAU) * Math.cos(t * TAU), Math.sin(t * TAU) * 1.0]); // liegende 8 -> hochkant

const spiral = () => N(100, (f) => {
  const r = 0.04 + 0.46 * (1 - f), a = f * 2.25 * TAU;
  return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)];
});

const clover = () => N(90, (t) => {
  const th = t * Math.PI, r = Math.cos(3 * th);
  return [r * Math.cos(th), r * Math.sin(th)];
});
const rose5 = () => N(120, (t) => {
  const th = t * Math.PI, r = Math.cos(5 * th);
  return [r * Math.cos(th), r * Math.sin(th)];
});

const sCurve = () => N(60, (t) => [0.5 + 0.5 * Math.sin(t * TAU), t]);

const omega = () => {
  const pts = [[0, 1], [0.3, 1], [0.27, 0.8]];
  for (let i = 0; i <= 60; i++) {
    const a = ((125 + (290 * i) / 60) * Math.PI) / 180;
    pts.push([0.5 + 0.38 * Math.cos(a), 0.42 + 0.38 * Math.sin(a)]);
  }
  pts.push([0.73, 0.8], [0.7, 1], [1, 1]);
  return pts;
};

// Stiel nach unten, dann Kreis am Ende (Fackel)
const lollipop = () => [[0.5, 0], [0.5, 0.52], ...N(40, (t) => [0.5 + 0.24 * Math.sin(t * TAU), 0.76 - 0.24 * Math.cos(t * TAU)]).slice(0)];

// kleines "b": Stiel, dann Bauch rechts
const bshape = () => [[0.22, 0], [0.22, 1], [0.22, 0.52], ...N(24, (t) => { const a = -Math.PI / 2 + t * Math.PI; return [0.22 + 0.55 * Math.cos(a), 0.76 + 0.24 * Math.sin(a)]; })];

// eckige Spirale (Labyrinth)
const maze = () => [[0, 0], [1, 0], [1, 1], [0.12, 1], [0.12, 0.14], [0.78, 0.14], [0.78, 0.82], [0.3, 0.82], [0.3, 0.38], [0.58, 0.38]];

// Kreis, dann (ab oben) ein Pentagramm
const sunstar = () => [...circle(48), ...star().slice(1)];

// Fragezeichen: Haken oben (Dreiviertelkreis), dann Stiel
const question = () => [...N(36, (t) => { const a = Math.PI + t * 1.5 * Math.PI; return [0.5 + 0.34 * Math.cos(a), 0.3 + 0.3 * Math.sin(a)]; }), [0.5, 0.82]];
// Tropfen: Spitze oben, runder Bauch
const teardrop = () => [[0.5, 0], ...N(40, (t) => { const a = Math.PI / 2 - Math.PI * 0.35 + t * Math.PI * 1.7; return [0.5 + 0.36 * Math.cos(a), 0.64 + 0.36 * Math.sin(a)]; }), [0.5, 0]];
// Haken (J)
const hook = () => [[0.7, 0], [0.7, 0.7], ...N(20, (t) => { const a = t * Math.PI; return [0.4 + 0.3 * Math.cos(a), 0.7 + 0.3 * Math.sin(a)]; })];

export const SHAPES = {
  circle:   { closed: true, pts: circle() },
  vline:    { pts: [[0.5, 0], [0.5, 1]] },
  hline:    { pts: [[0, 0.5], [1, 0.5]] },
  slash:    { pts: [[0, 1], [1, 0]] },
  backslash:{ pts: [[0, 0], [1, 1]] },
  caret:    { pts: [[0, 1], [0.5, 0], [1, 1]] },
  vee:      { pts: [[0, 0], [0.5, 1], [1, 0]] },
  arrow:    { pts: [[0.5, 1], [0.5, 0], [0.18, 0.34], [0.5, 0], [0.82, 0.34]] },

  zigzag:   { pts: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  sshape:   { pts: sCurve() },
  triangle: { closed: true, pts: [[0.5, 0], [1, 1], [0, 1], [0.5, 0]] },
  gate:     { pts: [[0, 1], [0, 0], [1, 0], [1, 1]] },
  dagger:   { pts: [[0.5, 0], [0.5, 1], [0.5, 0.42], [0.08, 0.42], [0.92, 0.42]] },
  nshape:   { pts: [[0, 1], [0, 0], [1, 1], [1, 0]] },
  hourglass:{ pts: [[0, 0], [1, 1], [1, 0], [0, 1]] },
  bshape:   { pts: bshape() },

  heart:    { closed: true, pts: heart() },
  star:     { closed: true, pts: star() },
  omega:    { pts: omega() },
  lollipop: { pts: lollipop() },
  eight:    { closed: true, pts: eight() },

  infinity: { closed: true, pts: infinity() },
  spiral:   { mirror: true, pts: spiral() },
  maze:     { mirror: true, pts: maze() },
  storm:    { pts: [[0, 1], [0.17, 0], [0.33, 1], [0.5, 0], [0.67, 1], [0.83, 0], [1, 1]] },

  sunstar:  { mirror: true, pts: sunstar() },
  clover:   { closed: true, pts: clover() },
  rose5:    { closed: true, pts: rose5() },

  // Erweiterung (v3)
  lshape:   { pts: [[0, 0], [0, 1], [1, 1]] },
  tshape:   { pts: [[0, 0], [1, 0], [0.5, 0], [0.5, 1]] },
  chevl:    { pts: [[1, 0], [0, 0.5], [1, 1]] },
  hook:     { pts: hook() },
  teardrop: { closed: true, pts: teardrop() },
  question: { pts: question() },
  arrowdn:  { pts: [[0.5, 0], [0.5, 1], [0.18, 0.66], [0.5, 1], [0.82, 0.66]] },
  wings:    { pts: [[0, 0], [0.25, 1], [0.5, 0.25], [0.75, 1], [1, 0]] },
};
