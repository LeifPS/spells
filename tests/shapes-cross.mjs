// Zeigt, welche Formen sich (als perfekte Vorlage) zu ähnlich sind.
import { SHAPES } from '../public/js/shapes.js';
import { shapeScore, templateNormalized } from '../public/js/recog.js';
const keys = Object.keys(SHAPES);
const rows = [];
for (const a of keys) for (const b of keys) {
  if (a >= b) continue;
  rows.push([a, b, Math.max(shapeScore(templateNormalized(a), b), shapeScore(templateNormalized(b), a))]);
}
rows.sort((x, y) => y[2] - x[2]);
for (const r of rows.slice(0, Number(process.argv[2] || 14))) console.log(r[0].padEnd(10), r[1].padEnd(10), r[2].toFixed(2));
