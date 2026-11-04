// Grafik-Helfer: Farben, Glow-Sprites, Easing, Zauber-Symbole.
import { SHAPES } from './shapes.js';
import { templateNormalized } from './recog.js';
import { RARITIES } from './spells.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
export const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgb = (c) => `rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;
export const rgba = (h, a) => { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
export function mix(a, b, t) {
  const x = hexRgb(a), y = hexRgb(b);
  return '#' + [0, 1, 2].map((i) => Math.round(lerp(x[i], y[i], t)).toString(16).padStart(2, '0')).join('');
}
export const lighten = (h, t) => mix(h, '#ffffff', t);
export const darken = (h, t) => mix(h, '#000000', t);

// deterministischer Zufall (für Hintergründe)
export function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------------------------------------------------------------- Glow-Sprites (additives Zeichnen)
const glowCache = new Map();
export function glowSprite(color) {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, rgba(color, 1));
  rg.addColorStop(0.18, rgba(color, 0.75));
  rg.addColorStop(0.5, rgba(color, 0.22));
  rg.addColorStop(1, rgba(color, 0));
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}
const softCache = new Map();
export function softSprite(color) { // weich, ohne harten Kern (Rauch/Nebel)
  let c = softCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, rgba(color, 0.7));
  rg.addColorStop(0.6, rgba(color, 0.25));
  rg.addColorStop(1, rgba(color, 0));
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  softCache.set(color, c);
  return c;
}
export function glow(ctx, x, y, r, color, a = 1) {
  ctx.globalAlpha = a;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
}

// ---------------------------------------------------------------- Zauber-Symbol (Rune auf Kachel)
/** Zeichnet die Form des Zaubers glühend in ein Quadrat der Größe size. */
export function strokeShape(ctx, key, cx, cy, size, color, { width = 0.07, glowAmt = 0.12, start = true, alpha = 1 } = {}) {
  const pts = templateNormalized(key), k = size * 0.74;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = size * glowAmt;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, size * width);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * k, cy + y * k) : ctx.moveTo(cx + x * k, cy + y * k)));
  ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1, size * width * 0.32);
  ctx.stroke();
  if (start && !SHAPES[key].closed) {
    ctx.fillStyle = '#7dff9c'; ctx.shadowColor = '#7dff9c'; ctx.shadowBlur = size * 0.08;
    ctx.beginPath(); ctx.arc(cx + pts[0][0] * k, cy + pts[0][1] * k, Math.max(2, size * 0.04), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** Komplettes Symbol: Hintergrund-Verlauf in Zauberfarbe + Runenkreis + Form */
export function drawSpellIcon(cv, sp, size = 128, { bg = true, ring = true } = {}) {
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;
  if (bg) {
    const rg = ctx.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, rgba(sp.color, 0.38)); rg.addColorStop(0.7, rgba(darken(sp.color, 0.7), 0.35)); rg.addColorStop(1, 'rgba(10,6,30,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, size, size);
  }
  if (ring) {
    ctx.save();
    ctx.strokeStyle = rgba(sp.color, 0.45); ctx.lineWidth = Math.max(1, size * 0.012);
    ctx.beginPath(); ctx.arc(c, c, size * 0.45, 0, TAU); ctx.stroke();
    ctx.setLineDash([size * 0.02, size * 0.035]); ctx.strokeStyle = rgba(sp.color, 0.3);
    ctx.beginPath(); ctx.arc(c, c, size * 0.4, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  strokeShape(ctx, sp.shape, c, c, size * 0.8, sp.color, { width: 0.06 });
}

export function fitCanvas(cv, w, h, dpr = Math.min(window.devicePixelRatio || 1, 2)) {
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export const rarityColor = (r) => RARITIES[r].color;
