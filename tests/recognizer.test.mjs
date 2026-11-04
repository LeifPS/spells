// Kalibrierungstest: simuliert "menschlich" gezeichnete Striche (Wackeln, Verzerrung,
// Drehung, beliebiger Start/Richtung) und prüft, wie oft der richtige Zauber erkannt wird.
// Aufruf: node tests/recognizer.test.mjs [noise]
import { SPELLS, SHAPES, RARITIES, RARITY_ORDER } from '../public/spells.js';
import { recognize, resample } from '../public/recognizer.js';

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rr = (a, b) => a + rnd() * (b - a);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

function human(shapeKey, noise) {
  const sh = SHAPES[shapeKey];
  let pts = resample(sh.pts, 90);
  if (sh.closed) {
    const ring = pts.slice(0, 89);
    const off = Math.floor(rnd() * ring.length);
    pts = ring.map((_, i) => ring[(off + i) % ring.length]);
    pts.push(pts[0]);
  }
  if (rnd() < 0.5) pts = pts.slice().reverse();
  const f1 = rr(1.2, 2.5), f2 = rr(2.5, 4.5), ph = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
  const ang = rr(-0.18, 0.18), sx = rr(0.7, 1.4), sy = rr(0.7, 1.4), sk = rr(-0.15, 0.15);
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

const noise = Number(process.argv[2] ?? 0.05);
const TRIALS = 200;
const ALL = SPELLS.map((s) => s.id);
let worst = 1;
console.log(`Rauschen ${noise}, ${TRIALS} Versuche je Zauber, alle Zauber freigeschaltet\n`);
for (const r of RARITY_ORDER) {
  for (const sp of SPELLS.filter((s) => s.rarity === r)) {
    let ok = 0, wrong = 0, low = 0, sum = 0;
    const conf = {};
    for (let i = 0; i < TRIALS; i++) {
      const res = recognize(human(sp.shape, noise), ALL);
      if (res.ok && res.id === sp.id) { ok++; sum += res.score; }
      else if (res.ok) { wrong++; conf[res.id] = (conf[res.id] || 0) + 1; }
      else low++;
    }
    worst = Math.min(worst, ok / TRIALS);
    console.log(
      `${r.padEnd(10)} ${sp.name.padEnd(16)} erkannt ${String(Math.round((ok / TRIALS) * 100)).padStart(3)}%  ` +
      `falsch ${String(wrong).padStart(3)}  zu schwach ${String(low).padStart(3)}  Ø-Score ${(sum / Math.max(ok, 1)).toFixed(2)}` +
      (wrong ? '  verwechselt: ' + JSON.stringify(conf) : '')
    );
  }
}
// Kritzeleien dürfen NICHT als Zauber durchgehen
let scribbleHits = 0;
for (let i = 0; i < 500; i++) {
  const pts = Array.from({ length: 40 }, () => [rr(0, 300), rr(0, 300)]);
  if (recognize(pts, ALL).ok) scribbleHits++;
}
console.log(`\nZufalls-Gekritzel fälschlich erkannt: ${scribbleHits}/500`);
console.log(`Schlechteste Erkennungsrate: ${Math.round(worst * 100)}%`);
