// Strich-Erkennung im Stil des "$1 Unistroke Recognizer":
// Strich wird neu abgetastet, normalisiert und mit Vorlagen verglichen.
// Fair gemacht: Größe, Seitenverhältnis, Startpunkt (bei geschlossenen Formen) und
// Zeichenrichtung spielen KEINE Rolle - nur die Form zählt.
import { SHAPES, SPELLS, SPELL_BY_ID, RARITIES } from './spells.js';

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
      const q = [
        src[i - 1][0] + t * (src[i][0] - src[i - 1][0]),
        src[i - 1][1] + t * (src[i][1] - src[i - 1][1]),
      ];
      out.push(q);
      src.splice(i, 0, q);
      D = 0;
    } else D += d;
  }
  while (out.length < n) out.push(src[src.length - 1].slice());
  return out.slice(0, n);
}

// leichtes Glätten gegen Zittern (Enden bleiben)
function smooth(p) {
  if (p.length < 5) return p;
  const o = [p[0]];
  for (let i = 1; i < p.length - 1; i++)
    o.push([(p[i - 1][0] + p[i][0] + p[i + 1][0]) / 3, (p[i - 1][1] + p[i][1] + p[i + 1][1]) / 3]);
  o.push(p[p.length - 1]);
  return o;
}

// auf Einheitsfläche bringen; sehr flache Formen (Linien) behalten ihr Seitenverhältnis weitgehend
export function normalize(p) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of p) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const w = maxX - minX, h = maxY - minY;
  const s = Math.max(w, h, 1e-6);
  const sx = Math.max(w, 0.4 * s), sy = Math.max(h, 0.4 * s);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return p.map(([x, y]) => [(x - cx) / sx, (y - cy) / sy]);
}

const variantCache = {};
function variants(shapeKey) {
  if (variantCache[shapeKey]) return variantCache[shapeKey];
  const sh = SHAPES[shapeKey];
  const seqs = [];
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
    if (sh.mirror) {
      const m = base.map(([x, y]) => [-x, y]);
      seqs.push(m, m.slice().reverse());
    }
  }
  return (variantCache[shapeKey] = seqs.map(normalize));
}

export function templateNormalized(shapeKey) {
  return normalize(resample(SHAPES[shapeKey].pts, N));
}

function score(cand, tpl) {
  let d = 0;
  for (let i = 0; i < N; i++) d += dist(cand[i], tpl[i]);
  return Math.max(0, 1 - d / N / 0.55);
}

export function shapeScore(cand, shapeKey) {
  let best = 0;
  for (const v of variants(shapeKey)) best = Math.max(best, score(cand, v));
  // Geschlossene Formen (Kreis, Herz, …): Strich muss sich ungefähr schließen
  if (SHAPES[shapeKey].closed) {
    const gap = dist(cand[0], cand[N - 1]);
    best -= Math.max(0, gap - 0.35) * 0.6;
  }
  return Math.max(0, best);
}

/**
 * Erkennt den Strich. `owned` = Liste freigeschalteter Zauber-IDs.
 * Es wird gegen ALLE Zauber verglichen - gewinnt ein gesperrter, schlägt es fehl
 * (so wird eine Eingabe nie "irgendwie" einem anderen Zauber zugeordnet).
 * Rückgabe: { ok, id, score, best, locked, all }
 */
export function recognize(rawPts, owned) {
  if (!rawPts || rawPts.length < 6) return { ok: false, reason: 'short', all: [] };
  const cand = normalize(resample(smooth(rawPts), N));
  const all = SPELLS.map((sp) => ({ id: sp.id, score: shapeScore(cand, sp.shape) })).sort(
    (a, b) => b.score - a.score
  );
  const top = all[0];
  const sp = SPELL_BY_ID[top.id];
  const thr = RARITIES[sp.rarity].thr;
  if (top.score < thr) return { ok: false, reason: 'low', best: top, all };
  // Zu knapp zwischen zwei gültigen Zaubern? Lieber "unklar" als ein falscher Zauber.
  const sec = all[1], sp2 = SPELL_BY_ID[sec.id];
  if (sec.score >= RARITIES[sp2.rarity].thr && top.score - sec.score < 0.03) return { ok: false, reason: 'ambiguous', best: top, all };
  if (!owned.includes(top.id)) return { ok: false, reason: 'locked', locked: top.id, best: top, all };
  return { ok: true, id: top.id, score: top.score, best: top, all };
}
