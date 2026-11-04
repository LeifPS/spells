// Strich-Erkennung (Template-Vergleich im Stil des $1-Recognizers).
// Fair: Größe, Seitenverhältnis, Startpunkt/Richtung (bei geschlossenen Formen) sind egal.
import { SHAPES } from './shapes.js';

export const N = 64;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function pathLength(p) {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += dist(p[i - 1], p[i]);
  return d;
}

export function resample(pts, n = N) {
  if (pts.length < 2) return Array(n).fill(pts[0] || [0, 0]);
  const I = pathLength(pts) / (n - 1);
  if (I === 0) return Array(n).fill(pts[0]);
  const src = pts.map((p) => p.slice());
  const out = [src[0]];
  let D = 0;
  for (let i = 1; i < src.length; i++) {
    const d = dist(src[i - 1], src[i]);
    if (d > 0 && D + d >= I) {
      const t = (I - D) / d;
      const q = [src[i - 1][0] + t * (src[i][0] - src[i - 1][0]), src[i - 1][1] + t * (src[i][1] - src[i - 1][1])];
      out.push(q);
      src.splice(i, 0, q);
      D = 0;
    } else D += d;
  }
  while (out.length < n) out.push(src[src.length - 1].slice());
  return out.slice(0, n);
}

function smooth(p) {
  if (p.length < 5) return p;
  const o = [p[0]];
  for (let i = 1; i < p.length - 1; i++) o.push([(p[i - 1][0] + p[i][0] + p[i + 1][0]) / 3, (p[i - 1][1] + p[i][1] + p[i + 1][1]) / 3]);
  o.push(p[p.length - 1]);
  return o;
}

export function normalize(p) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of p) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const w = maxX - minX, h = maxY - minY, s = Math.max(w, h, 1e-6);
  const sx = Math.max(w, 0.4 * s), sy = Math.max(h, 0.4 * s);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return p.map(([x, y]) => [(x - cx) / sx, (y - cy) / sy]);
}

const cache = {};
function variants(key) {
  if (cache[key]) return cache[key];
  const sh = SHAPES[key], seqs = [];
  if (sh.closed) {
    const ring = resample(sh.pts, N + 1).slice(0, N);
    for (let off = 0; off < N; off += 2) {
      const seq = [];
      for (let i = 0; i < N; i++) seq.push(ring[(off + i) % N]);
      seqs.push(seq, seq.slice().reverse());
    }
  } else {
    const base = resample(sh.pts, N);
    seqs.push(base, base.slice().reverse());
    if (sh.mirror) { const m = base.map(([x, y]) => [-x, y]); seqs.push(m, m.slice().reverse()); }
  }
  return (cache[key] = seqs.map(normalize));
}

/** Normalisierte Vorlage (für Anzeige/Hilfsform) */
export const templateNormalized = (key) => normalize(resample(SHAPES[key].pts, N));

export function prepare(raw) {
  return normalize(resample(smooth(raw), N));
}

export function shapeScore(cand, key) {
  let best = 0;
  for (const v of variants(key)) {
    let d = 0;
    for (let i = 0; i < N; i++) d += dist(cand[i], v[i]);
    best = Math.max(best, 1 - d / N / 0.55);
  }
  if (SHAPES[key].closed) best -= Math.max(0, dist(cand[0], cand[N - 1]) - 0.35) * 0.6;
  return Math.max(0, best);
}

/**
 * Erkennt den Strich gegen das Deck.
 * deck: [{ id, shape, thr }]   others: [{ id, shape, thr }] (nicht im Deck, nur zur Absicherung)
 * Rückgabe { ok, id, score, reason, best, all }
 */
export function recognize(raw, deck, others = []) {
  if (!raw || raw.length < 6) return { ok: false, reason: 'short', all: [] };
  const cand = prepare(raw);
  const all = deck.map((s) => ({ id: s.id, thr: s.thr, score: shapeScore(cand, s.shape) })).sort((a, b) => b.score - a.score);
  const top = all[0];
  if (!top) return { ok: false, reason: 'empty', all };
  // sieht der Strich eindeutig nach einem Zauber aus, der NICHT im Deck ist?
  for (const o of others) {
    const sc = shapeScore(cand, o.shape);
    if (sc >= o.thr && sc > top.score + 0.06) return { ok: false, reason: 'notInDeck', other: o.id, best: top, all };
  }
  if (top.score < top.thr) return { ok: false, reason: 'low', best: top, all };
  const sec = all[1];
  if (sec && sec.score >= sec.thr && top.score - sec.score < 0.03) return { ok: false, reason: 'ambiguous', best: top, all };
  return { ok: true, id: top.id, score: top.score, best: top, all };
}
