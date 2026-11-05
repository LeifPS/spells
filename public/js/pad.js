// Zeichenfläche über dem ganzen Bildschirm: leuchtender Strich, Tinten-Auflösung, Energie-Sog, Geister-Hilfe.
import { TAU, clamp, rnd, rgba, glow, glowSprite, softSprite, lerp, easeOut } from './gfx.js';
import { templateNormalized } from './recog.js';
import { SHAPES } from './shapes.js';

export class DrawPad {
  /** opts: onStroke(pts)->{ok,color,msg,sub}|null, onStart(), target()->{x,y} (Bildschirmkoordinaten) */
  constructor(canvas, { onStroke, onStart, target, color = '#9fd8ff' } = {}) {
    this.cv = canvas; this.onStroke = onStroke; this.onStart = onStart; this.targetFn = target; this.color = color;
    this.pts = []; this.drawing = false; this.fade = []; this.sparks = [];
    this.ghost = null; this.ghostT = 0; this.msg = null; this.shakeT = 0; this._enabled = true; this.pid = null;
    this.w = 0; this.h = 0; this.time = 0; this.running = false; this.low = false;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => this.up(e, ev === 'pointercancel'));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
    this.resize();
  }
  get enabled() { return this._enabled; }
  set enabled(v) { this._enabled = v; this.cv.style.pointerEvents = v ? 'auto' : 'none'; if (!v) { this.drawing = false; this.pts = []; } }
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
    if (!this._enabled || this.drawing) return;
    e.preventDefault();
    this.pid = e.pointerId;
    try { this.cv.setPointerCapture(e.pointerId); } catch {}
    this.drawing = true; this.pts = [this.pt(e)]; this.msg = null;
    if (this.onStart) this.onStart();
  }
  move(e) {
    if (!this.drawing || e.pointerId !== this.pid) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) {
      const p = this.pt(ev), l = this.pts[this.pts.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 1.5) continue;
      this.pts.push(p);
      if (this.pts.length > 1500) this.pts.shift();
      if (!this.low || Math.random() < 0.4) this.sparks.push({ x: p[0], y: p[1], vx: rnd(-30, 30), vy: rnd(-40, 10), life: rnd(0.3, 0.6), max: 0.6, s: rnd(4, 9) });
    }
  }
  up(e, cancel) {
    if (!this.drawing || e.pointerId !== this.pid) return;
    this.drawing = false; this.pid = null;
    const pts = this.pts; this.pts = [];
    if (cancel) return;
    const f = { pts, t: 0, col: this.color, mode: 'ink' };
    let res = null;
    if (this.onStroke) res = this.onStroke(pts);
    if (res) {
      f.col = res.color || this.color;
      if (res.msg) this.say(res.msg, f.col, res.sub || '');
      if (res.ok === false) this.shakeT = 0.25;
      if (res.ok === true) { f.mode = 'absorb'; f.target = this.targetFn ? this.targetFn() : null; if (!f.target) f.mode = 'ink'; }
    }
    this.initFade(f);
    this.fade.push(f);
  }
  initFade(f) {
    const pts = f.pts; if (pts.length < 2) return;
    // gleichmäßige Stützpunkte entlang des Strichs
    const samp = []; let acc = 0, last = pts[0]; samp.push(last);
    const step = this.low ? 26 : 14;
    for (const p of pts) { acc += Math.hypot(p[0] - last[0], p[1] - last[1]); last = p; if (acc >= step) { samp.push(p); acc = 0; } }
    f.samp = samp;
    if (f.mode === 'ink') {
      f.dur = 1.15;
      f.blobs = samp.map((p) => ({ x: p[0], y: p[1], s0: rnd(5, 9), s1: rnd(20, 40), vx: rnd(-14, 14), vy: rnd(-10, 14), d: rnd(0.55, 1.15), a: rnd(0.35, 0.6) }));
      const nd = this.low ? 2 : 5; f.drips = [];
      for (let i = 0; i < nd && samp.length; i++) { const p = samp[Math.floor(Math.random() * samp.length)]; f.drips.push({ x: p[0] + rnd(-3, 3), y: p[1], v: rnd(10, 40), len: 4, w: rnd(2.2, 4), d: rnd(0.5, 1.0) }); }
    } else {
      f.dur = 1.0;
      const T = f.target;
      f.parts = samp.map((p, i) => { const mx = (p[0] + T.x) / 2 + rnd(-60, 60), my = Math.min(p[1], T.y) - rnd(30, 120); return { x0: p[0], y0: p[1], cx: mx, cy: my, tx: T.x, ty: T.y, delay: (i / samp.length) * 0.28, dur: rnd(0.4, 0.65), s: rnd(6, 12) }; });
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
    for (const f of this.fade) {
      f.t += dt;
      if (f.drips) for (const d of f.drips) { d.v += 420 * dt; d.y += d.v * dt; d.len = Math.min(46, d.len + d.v * dt * 0.7); }
    }
    this.fade = this.fade.filter((f) => f.t < (f.dur || 0.7));
    if (this.msg) { this.msg.t += dt; if (this.msg.t > 1.4) this.msg = null; }
  }

  strokePath(g, pts, col, width, a, wob = 0, t = 0) {
    if (pts.length < 2 || a <= 0.01) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const X = (p, i) => p[0] + (wob ? Math.sin(i * 0.55 + t * 8) * wob : 0), Y = (p, i) => p[1] + (wob ? Math.cos(i * 0.43 + t * 7) * wob : 0);
    const path = () => { g.beginPath(); g.moveTo(X(pts[0], 0), Y(pts[0], 0)); for (let i = 1; i < pts.length - 1; i++) { const mx = (X(pts[i], i) + X(pts[i + 1], i + 1)) / 2, my = (Y(pts[i], i) + Y(pts[i + 1], i + 1)) / 2; g.quadraticCurveTo(X(pts[i], i), Y(pts[i], i), mx, my); } g.lineTo(X(pts[pts.length - 1], pts.length - 1), Y(pts[pts.length - 1], pts.length - 1)); };
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
    // Geister-Hilfe (mittig)
    if (this.ghost) {
      const pts = templateNormalized(this.ghost.key), sh = SHAPES[this.ghost.key], k = Math.min(w, h) * 0.27, cx = w / 2, cy = h * 0.4;
      const prog = sh.closed ? 1 : ((this.ghostT % 2.4) / 2.0);
      const n = Math.max(2, Math.min(pts.length, Math.round(pts.length * Math.min(1, prog))));
      g.globalAlpha = 0.5; g.setLineDash([2, 10]); g.lineCap = 'round';
      g.strokeStyle = this.ghost.color; g.lineWidth = 5; g.beginPath();
      pts.slice(0, n).forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](cx + x * k, cy + y * k)); g.stroke(); g.setLineDash([]);
      const st = pts[0]; g.globalAlpha = 0.9; g.fillStyle = '#7dff9c'; g.beginPath(); g.arc(cx + st[0] * k, cy + st[1] * k, 7 + Math.sin(this.time * 6) * 1.5, 0, TAU); g.fill();
      if (!sh.closed) { const en = pts[n - 1]; g.drawImage(glowSprite(this.ghost.color), cx + en[0] * k - 16, cy + en[1] * k - 16, 32, 32); }
      g.globalAlpha = 1;
    }
    // aufgelöste Striche
    for (const f of this.fade) this.drawFade(g, f);
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
      const m = this.msg, k = m.t < 0.12 ? 0.7 + 0.3 * (m.t / 0.12) : 1, a = clamp(1.6 - m.t);
      g.save(); g.globalAlpha = a; g.translate(w / 2, h * 0.3 - m.t * 14); g.scale(k, k);
      g.font = '800 24px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 7; g.strokeStyle = 'rgba(8,4,24,.85)'; g.lineJoin = 'round'; g.strokeText(m.text, 0, 0); g.fillStyle = m.color; g.fillText(m.text, 0, 0);
      if (m.sub) { g.font = '600 14px system-ui, sans-serif'; g.lineWidth = 5; g.strokeStyle = 'rgba(8,4,24,.8)'; g.strokeText(m.sub, 0, 26); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText(m.sub, 0, 26); }
      g.restore();
    }
    g.restore();
  }

  drawFade(g, f) {
    const k = clamp(f.t / f.dur);
    if (f.mode === 'ink') {
      // Strich quillt auf, wird unscharf und löst sich wie Tinte im Wasser auf
      const a = Math.pow(1 - k, 1.5);
      this.strokePath(g, f.pts, f.col, 5 + 10 * easeOut(k), a * 0.8, k * 5, f.t);
      g.globalCompositeOperation = 'lighter';
      for (const b of f.blobs) {
        const kk = clamp(k / b.d); if (kk >= 1) continue;
        const s = lerp(b.s0, b.s1, easeOut(kk)), x = b.x + b.vx * f.t, y = b.y + b.vy * f.t;
        g.globalAlpha = b.a * (1 - kk) * (kk < 0.1 ? kk / 0.1 : 1);
        g.drawImage(softSprite(f.col), x - s, y - s, s * 2, s * 2);
      }
      g.globalAlpha = 1;
      for (const d of f.drips) {
        const kk = clamp(k / d.d); if (kk >= 1) continue;
        const gr = g.createLinearGradient(0, d.y - d.len, 0, d.y); gr.addColorStop(0, rgba(f.col, 0)); gr.addColorStop(1, rgba(f.col, 0.85 * (1 - kk)));
        g.strokeStyle = gr; g.lineWidth = d.w * (1 - kk * 0.5); g.lineCap = 'round'; g.beginPath(); g.moveTo(d.x, d.y - d.len); g.lineTo(d.x, d.y); g.stroke();
        g.drawImage(glowSprite(f.col), d.x - d.w * 2, d.y - d.w * 2, d.w * 4, d.w * 4);
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    } else {
      // gelungen: Strich zerfällt in Funken und fliegt zum Zauberstab
      this.strokePath(g, f.pts, f.col, 5, Math.max(0, 1 - k * 4));
      g.globalCompositeOperation = 'lighter';
      for (const p of f.parts) {
        const kk = clamp((f.t - p.delay) / p.dur); if (kk <= 0 || kk >= 1) continue;
        const e = kk * kk * (3 - 2 * kk), it = 1 - e;
        const x = it * it * p.x0 + 2 * it * e * p.cx + e * e * p.tx, y = it * it * p.y0 + 2 * it * e * p.cy + e * e * p.ty;
        const s = p.s * (1 - kk * 0.6);
        g.globalAlpha = 0.9; g.drawImage(glowSprite(f.col), x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2);
        g.globalAlpha = 1; g.drawImage(glowSprite('#ffffff'), x - s * 0.5, y - s * 0.5, s, s);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  }
}
