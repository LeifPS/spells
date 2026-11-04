// Zeichenfeld: leuchtender Strich mit Partikelspur, optionaler Geister-Hilfe und Rückmeldung.
import { TAU, clamp, rnd, rgba, glow, glowSprite } from './gfx.js';
import { templateNormalized } from './recog.js';
import { SHAPES } from './shapes.js';

export class DrawPad {
  constructor(canvas, { onStroke, onStart, color = '#9fd8ff' } = {}) {
    this.cv = canvas; this.onStroke = onStroke; this.onStart = onStart; this.color = color;
    this.pts = []; this.drawing = false; this.fade = []; this.sparks = [];
    this.ghost = null; this.ghostT = 0; this.msg = null; this.shakeT = 0; this.enabled = true;
    this.w = 0; this.h = 0; this.time = 0; this.running = false;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => this.up(e, ev === 'pointercancel'));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    this.g = this.cv.getContext('2d'); this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  pt(e) { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    try { this.cv.setPointerCapture(e.pointerId); } catch {}
    this.drawing = true; this.pts = [this.pt(e)]; this.msg = null;
    if (this.onStart) this.onStart();
  }
  move(e) {
    if (!this.drawing) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) {
      const p = this.pt(ev), l = this.pts[this.pts.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 1.5) continue;
      this.pts.push(p);
      if (this.pts.length > 1200) this.pts.shift();
      this.sparks.push({ x: p[0], y: p[1], vx: rnd(-30, 30), vy: rnd(-40, 10), life: rnd(0.3, 0.6), max: 0.6, s: rnd(4, 9) });
    }
  }
  up(e, cancel) {
    if (!this.drawing) return;
    this.drawing = false;
    const pts = this.pts; this.pts = [];
    if (cancel) return;
    this.fade.push({ pts, t: 0, col: this.color, ok: null });
    const f = this.fade[this.fade.length - 1];
    if (this.onStroke) {
      const res = this.onStroke(pts);
      if (res) { f.col = res.color || this.color; f.ok = res.ok; if (res.msg) this.say(res.msg, f.col); if (res.ok === false) this.shakeT = 0.25; }
    }
  }
  say(text, color = '#fff', sub = '') { this.msg = { text, sub, color, t: 0 }; }
  setGhost(key, color) { this.ghost = key ? { key, color } : null; this.ghostT = 0; }
  clearStroke() { this.pts = []; this.drawing = false; }

  run() {
    if (this.running) return; this.running = true;
    let prev = performance.now();
    const loop = (now) => { if (!this.running) return; const dt = Math.min(0.05, (now - prev) / 1000); prev = now; this.update(dt); this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  stop() { this.running = false; }

  update(dt) {
    this.time += dt; this.ghostT += dt; this.shakeT = Math.max(0, this.shakeT - dt);
    for (const s of this.sparks) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const f of this.fade) f.t += dt;
    this.fade = this.fade.filter((f) => f.t < 0.7);
    if (this.msg) { this.msg.t += dt; if (this.msg.t > 1.4) this.msg = null; }
  }

  strokePath(g, pts, col, width, a) {
    if (pts.length < 2) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); };
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(col, 0.28 * a); g.lineWidth = width * 3.4; path(); g.stroke();
    g.strokeStyle = rgba(col, 0.75 * a); g.lineWidth = width * 1.5; path(); g.stroke();
    g.strokeStyle = `rgba(255,255,255,${0.95 * a})`; g.lineWidth = width * 0.5; path(); g.stroke();
    g.globalCompositeOperation = 'source-over';
  }

  draw() {
    const g = this.g; if (!g) return;
    const w = this.w, h = this.h;
    g.clearRect(0, 0, w, h);
    g.save();
    if (this.shakeT) g.translate(Math.sin(this.shakeT * 90) * 5, 0);
    // Rahmen / Hinweis
    g.strokeStyle = 'rgba(160,200,255,.14)'; g.lineWidth = 1.5; g.setLineDash([6, 8]);
    g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 18); g.stroke(); g.setLineDash([]);
    // Geister-Hilfe
    if (this.ghost) {
      const pts = templateNormalized(this.ghost.key), sh = SHAPES[this.ghost.key], k = Math.min(w, h) * 0.36, cx = w / 2, cy = h / 2;
      const prog = sh.closed ? 1 : ((this.ghostT % 2.4) / 2.0);
      const n = Math.max(2, Math.min(pts.length, Math.round(pts.length * Math.min(1, prog))));
      g.globalAlpha = 0.5; g.setLineDash([2, 10]); g.lineCap = 'round';
      g.strokeStyle = this.ghost.color; g.lineWidth = 5; g.beginPath();
      pts.slice(0, n).forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](cx + x * k, cy + y * k)); g.stroke(); g.setLineDash([]);
      const st = pts[0]; g.globalAlpha = 0.9; g.fillStyle = '#7dff9c'; g.beginPath(); g.arc(cx + st[0] * k, cy + st[1] * k, 7 + Math.sin(this.time * 6) * 1.5, 0, TAU); g.fill();
      if (!sh.closed) { const en = pts[n - 1]; g.drawImage(glowSprite(this.ghost.color), cx + en[0] * k - 16, cy + en[1] * k - 16, 32, 32); }
      g.globalAlpha = 1;
    }
    // verblassende Striche
    for (const f of this.fade) {
      const a = 1 - f.t / 0.7;
      this.strokePath(g, f.pts, f.col, 5 * (0.6 + 0.4 * a), a);
    }
    // aktiver Strich
    if (this.drawing && this.pts.length > 1) {
      this.strokePath(g, this.pts, this.color, 5, 1);
      const l = this.pts[this.pts.length - 1];
      g.globalCompositeOperation = 'lighter'; glow(g, l[0], l[1], 26, this.color, 0.9); glow(g, l[0], l[1], 10, '#ffffff', 1); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    g.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) { g.globalAlpha = clamp(s.life / s.max) * 0.8; g.drawImage(glowSprite(this.color), s.x - s.s, s.y - s.s, s.s * 2, s.s * 2); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // Nachricht
    if (this.msg) {
      const m = this.msg, k = m.t < 0.12 ? 0.7 + 0.3 * (m.t / 0.12) : 1, a = clamp(1.6 - m.t) ;
      g.save(); g.globalAlpha = a; g.translate(w / 2, h * 0.5 - m.t * 14); g.scale(k, k);
      g.font = '800 22px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = 'rgba(8,4,24,.85)'; g.lineJoin = 'round'; g.strokeText(m.text, 0, 0); g.fillStyle = m.color; g.fillText(m.text, 0, 0);
      if (m.sub) { g.font = '600 13px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(m.sub, 0, 24); }
      g.restore();
    }
    g.restore();
  }
}
