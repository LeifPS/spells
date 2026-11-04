// Simuliert menschlich gezeichnete Striche (Wackeln, Verzerrung, Drehung) gegen zufällige Decks.
// node tests/recog.test.mjs [rauschen=0.05]
import { SPELLS, RARITIES, RARITY_ORDER } from '../public/js/spells.js';
import { SHAPES } from '../public/js/shapes.js';
import { recognize, resample } from '../public/js/recog.js';

let seed = 4242;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rr = (a, b) => a + rnd() * (b - a);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

export function human(shapeKey, noise) {
  const sh = SHAPES[shapeKey];
  let pts = resample(sh.pts, 90);
  if (sh.closed) { const ring = pts.slice(0, 89), off = Math.floor(rnd() * 89); pts = ring.map((_, i) => ring[(off + i) % 89]); pts.push(pts[0]); }
  if (rnd() < 0.5) pts = pts.slice().reverse();
  if (sh.mirror && rnd() < 0.5) pts = pts.map(([x, y]) => [1 - x, y]);
  const f1 = rr(1.2, 2.5), f2 = rr(2.5, 4.5), ph = [0, 1, 2, 3].map(() => rnd() * 6);
  const ang = rr(-0.16, 0.16), sx = rr(0.7, 1.4), sy = rr(0.7, 1.4), sk = rr(-0.12, 0.12);
  return pts.map(([x, y], i) => {
    const t = i / (pts.length - 1);
    let px = x - 0.5, py = y - 0.5;
    px += noise * (0.7 * Math.sin(f1 * 6.28 * t + ph[0]) + 0.4 * Math.sin(f2 * 6.28 * t + ph[1])) + gauss() * noise * 0.25;
    py += noise * (0.7 * Math.sin(f1 * 6.28 * t + ph[2]) + 0.4 * Math.sin(f2 * 6.28 * t + ph[3])) + gauss() * noise * 0.25;
    px = px * sx + py * sk; py = py * sy;
    const c = Math.cos(ang), s = Math.sin(ang);
    return [200 + 220 * (px * c - py * s), 200 + 220 * (px * s + py * c)];
  });
}

if (process.argv[1].endsWith('recog.test.mjs')) {
  const noise = Number(process.argv[2] ?? 0.05), TR = 150;
  const info = (s) => ({ id: s.id, shape: s.shape, thr: RARITIES[s.rarity].thr });
  let worst = 1, wrongTotal = 0, n = 0;
  console.log(`Rauschen ${noise}, ${TR} Striche je Zauber, zufälliges 6er-Deck\n`);
  for (const r of RARITY_ORDER) for (const sp of SPELLS.filter((s) => s.rarity === r)) {
    let ok = 0, wrong = 0, low = 0, amb = 0, nid = 0; const conf = {};
    for (let i = 0; i < TR; i++) {
      const others = SPELLS.filter((s) => s !== sp).sort(() => rnd() - 0.5);
      const deck = [sp, ...others.slice(0, 5)].map(info), out = others.slice(5).map(info);
      const res = recognize(human(sp.shape, noise), deck, out);
      if (res.ok && res.id === sp.id) ok++;
      else if (res.ok) { wrong++; conf[res.id] = (conf[res.id] || 0) + 1; }
      else if (res.reason === 'ambiguous') amb++;
      else if (res.reason === 'notInDeck') nid++;
      else low++;
    }
    worst = Math.min(worst, ok / TR); wrongTotal += wrong; n += TR;
    console.log(`${r.padEnd(9)} ${sp.name.padEnd(15)} ok ${String(Math.round(ok / TR * 100)).padStart(3)}%  falsch ${String(wrong).padStart(2)}  zu schwach ${String(low).padStart(2)}  unklar ${String(amb).padStart(2)}  nicht-im-Deck ${String(nid).padStart(2)}` + (wrong ? '  ' + JSON.stringify(conf) : ''));
  }
  let sc = 0;
  for (let i = 0; i < 600; i++) { const pts = Array.from({ length: 40 }, () => [rr(0, 300), rr(0, 300)]); if (recognize(pts, SPELLS.map(info)).ok) sc++; }
  console.log(`\nFalsch-Zauber gesamt: ${(wrongTotal / n * 100).toFixed(2)}%   Gekritzel fälschlich erkannt: ${sc}/600   schlechteste Quote: ${Math.round(worst * 100)}%`);
}
