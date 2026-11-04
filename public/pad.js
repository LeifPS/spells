// Zeichenfläche: Maus & Finger, leuchtende Spur, optionale Hilfsform.
import { pathLength } from './recognizer.js';

export class DrawPad {
  /**
   * onStroke(points, pad) -> { color, label, ok } | undefined
   */
  constructor(canvas, { onStroke, color = '#9fd0ff' } = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.onStroke = onStroke;
    this.color = color;
    this.enabled = true;
    this.cur = null; // aktueller Strich
    this.last = null; // letzter Strich { pts, color, born }
    this.ghost = null; // Hilfsform (normalisiert -0.5..0.5)
    this.ghostStart = null;
    this.sparks = [];
    this.label = null; // { text, color, born }
    this.hint = '';
    this.running = false;
    this.w = 0; this.h = 0;
    this._bind();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return;
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * dpr);
    this.cv.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _pos(e) {
    const r = this.cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  _bind() {
    const c = this.cv;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch {}
      this.cur = { pts: [this._pos(e)], id: e.pointerId };
      this.last = null;
      this.label = null;
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.cur || e.pointerId !== this.cur.id) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) {
        const p = this._pos(ev);
        const q = this.cur.pts[this.cur.pts.length - 1];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2) {
          this.cur.pts.push(p);
          if (Math.random() < 0.6) this._spark(p);
        }
      }
    });
    const end = (e) => {
      if (!this.cur || e.pointerId !== this.cur.id) return;
      const pts = this.cur.pts;
      this.cur = null;
      if (pts.length < 2) return;
      const len = pathLength(pts);
      let res;
      if (len >= 0.25 * Math.min(this.w, this.h) && this.onStroke) res = this.onStroke(pts, this);
      else res = { ok: false, label: 'Zu kurz', color: '#9aa3b2' };
      this.last = { pts, color: (res && res.color) || this.color, born: performance.now(), ok: !!(res && res.ok) };
      if (res && res.label) this.label = { text: res.label, color: res.color || '#fff', born: performance.now() };
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _spark(p) {
    this.sparks.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60 - 20, life: 0.5 });
    if (this.sparks.length > 80) this.sparks.shift();
  }

  setGhost(normPts, closed) {
    this.ghost = normPts;
    this.ghostStart = normPts && !closed ? normPts[0] : null;
  }

  clear() { this.cur = null; this.last = null; this.label = null; }

  start() {
    if (this.running) return;
    this.running = true;
    let prev = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - prev) / 1000); prev = t;
      this.draw(t, dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() { this.running = false; }

  draw(t, dt) {
    const { ctx, w, h } = this;
    if (!w) { this.resize(); return; }
    ctx.clearRect(0, 0, w, h);

    // Hintergrund
    ctx.fillStyle = this.enabled ? 'rgba(20,16,50,0.82)' : 'rgba(12,10,28,0.85)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(160,140,255,0.15)';
    ctx.lineWidth = 1;
    for (let x = 20; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 20; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Hilfsform
    if (this.ghost) {
      const s = Math.min(w, h) * 0.7;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.setLineDash([2, 10]);
      ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      this.ghost.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.ghostStart) {
        ctx.fillStyle = 'rgba(120,255,160,0.8)';
        ctx.beginPath(); ctx.arc(this.ghostStart[0] * s, this.ghostStart[1] * s, 9, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    if (!this.cur && !this.last && this.hint) {
      ctx.fillStyle = 'rgba(200,190,255,0.45)';
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.hint, w / 2, h / 2);
    }

    // letzter Strich (verblasst)
    if (this.last) {
      const age = (t - this.last.born) / 1000;
      const a = Math.max(0, 1 - Math.max(0, age - 0.8) / 0.8);
      if (a > 0) this._stroke(this.last.pts, this.last.color, a, 7);
      else this.last = null;
    }
    if (this.cur) this._stroke(this.cur.pts, this.color, 1, 7);

    // Funken
    ctx.globalCompositeOperation = 'lighter';
    this.sparks = this.sparks.filter((s) => (s.life -= dt) > 0);
    for (const s of this.sparks) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      ctx.fillStyle = this.color;
      ctx.globalAlpha = Math.max(0, s.life * 1.6);
      ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Ergebnis-Text
    if (this.label) {
      const age = (t - this.label.born) / 1000;
      if (age < 2.2) {
        ctx.globalAlpha = Math.min(1, 1.6 - Math.max(0, age - 0.6));
        ctx.font = '800 26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        const y = h * 0.16 - Math.min(age, 0.3) * 20;
        ctx.strokeText(this.label.text, w / 2, y);
        ctx.fillStyle = this.label.color;
        ctx.fillText(this.label.text, w / 2, y);
        ctx.globalAlpha = 1;
      }
    }

    if (!this.enabled && this.disabledText) {
      ctx.fillStyle = 'rgba(200,190,255,0.5)';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.disabledText, w / 2, h / 2);
    }
  }

  _stroke(pts, color, alpha, width) {
    const ctx = this.ctx;
    if (pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 22; ctx.lineWidth = width + 4;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = width * 0.45;
    ctx.stroke();
    ctx.restore();
  }
}
