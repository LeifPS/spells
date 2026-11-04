// Arena: Zauberer, Partikel, Effekte für jeden Zauber.
import { sfx } from './audio.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Arena {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.ps = []; this.projs = []; this.beams = []; this.texts = []; this.timers = [];
    this.st = [{}, {}];
    this.hurt = [0, 0]; this.cast_ = [0, 0];
    this.dead = [false, false];
    this.colors = ['#6a8dff', '#ff7a5c'];
    this.you = 0;
    this.shakeV = 0; this.flashV = 0; this.flashColor = '#fff';
    this.running = false;
    this.w = 0; this.h = 0;
    this.stars = Array.from({ length: 60 }, () => [Math.random(), Math.random() * 0.7, Math.random() * 1.6 + 0.4, Math.random() * 6]);
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

  reset(you) {
    this.you = you;
    this.ps = []; this.projs = []; this.beams = []; this.texts = []; this.timers = [];
    this.st = [{}, {}]; this.hurt = [0, 0]; this.cast_ = [0, 0]; this.dead = [false, false];
    this.shakeV = 0; this.flashV = 0;
    this.colors = you === 0 ? ['#6a8dff', '#ff7a5c'] : ['#ff7a5c', '#6a8dff'];
  }

  P(i) {
    const { w, h } = this;
    return i === this.you ? { x: w * 0.27, y: h * 0.8 } : { x: w * 0.74, y: h * 0.5 };
  }
  size() { return Math.min(this.w, this.h * 1.1) * 0.15; }
  center(i) { const p = this.P(i); return { x: p.x, y: p.y - this.size() * 0.9 }; }

  later(ms, fn) { this.timers.push({ t: ms / 1000, fn }); }

  start() {
    if (this.running) return;
    this.running = true;
    let prev = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - prev) / 1000); prev = t;
      this.update(dt); this.draw(t / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() { this.running = false; }

  // ------------------------------------------------------------ Emitter
  emit(o) {
    if (this.ps.length > 700) return;
    this.ps.push({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 1, max: 1, size: 4, grow: 0, color: '#fff', shape: 'dot', rot: 0, vr: 0, a: 1, ...o, max: o.life ?? 1 });
  }
  burst(x, y, color, n, speed, size = 4, life = 0.7, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = rnd(0.2, 1) * speed;
      this.emit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: rnd(size * 0.5, size * 1.4), life: rnd(life * 0.6, life), color: typeof color === 'function' ? color() : color, drag: 1.5, ...o });
    }
  }
  ring(x, y, color, r = 90, life = 0.5, width = 6) {
    this.emit({ x, y, shape: 'ring', size: 8, grow: r / life, life, color, a: 0.9, width });
  }
  float(i, text, color = '#fff', size = 30, below = false) {
    const c = this.center(i);
    this.texts.push({ x: c.x + (below ? 0 : rnd(-14, 14)), y: below ? c.y + this.size() * 1.25 : c.y - this.size() * 0.9, vy: -55, life: below ? 1.8 : 1.3, max: 1.3, text, color, size });
  }
  shake(v) { this.shakeV = Math.max(this.shakeV, v); }
  flash(color, v = 0.5) { this.flashColor = color; this.flashV = Math.max(this.flashV, v); }

  proj(from, to, o) {
    this.projs.push({ x: from.x, y: from.y, x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: 0, dur: 0.6, size: 12, arc: 0, wob: 0, kind: 'orb', trail: null, color: '#fff', ...o });
  }

  beam(o) { this.beams.push({ life: 0.4, max: 0.4, ...o }); }

  // ------------------------------------------------------------ Zauber
  /** Startet den Effekt. Gibt zurück, nach wie vielen ms der Treffer passiert. */
  cast(i, sp) {
    const c = this.center(i), t = this.center(1 - i), col = sp.color;
    this.cast_[i] = 0.5;
    const big = sp.rarity === 'legendary' || sp.rarity === 'mythic';
    sfx.cast(big ? 'big' : '');
    const hit = (ms, fn) => this.later(ms, fn);
    switch (sp.vfx) {
      case 'fireball':
        this.proj(c, t, { color: col, size: 15, dur: 0.65, arc: -50, trail: () => pick(['#ff7a2f', '#ffd23f', '#ff4d2f']) });
        hit(650, () => { this.burst(t.x, t.y, () => pick(['#ff7a2f', '#ffd23f', '#ff4d2f']), 38, 260, 6, 0.7, { g: 200 }); this.ring(t.x, t.y, '#ff9a4f', 90); });
        return 650;
      case 'shard':
        this.proj(c, t, { color: col, size: 13, dur: 0.4, kind: 'shard', trail: () => pick(['#ffffff', '#8fe3ff']) });
        hit(400, () => { this.burst(t.x, t.y, '#bff1ff', 26, 300, 5, 0.6, { shape: 'shard' }); this.ring(t.x, t.y, '#8fe3ff', 70); });
        return 400;
      case 'gust':
        for (let k = 0; k < 3; k++) this.proj(c, t, { color: col, size: 9, dur: 0.55 + k * 0.05, wob: 28 * (k - 1), kind: 'orb', trail: () => '#ffffff' });
        hit(600, () => { this.burst(t.x, t.y, '#e8fbff', 30, 340, 4, 0.6); this.ring(t.x, t.y, '#c8f2ff', 100); });
        return 600;
      case 'heal':
        this.ring(c.x, c.y, col, 100, 0.6);
        for (let k = 0; k < 16; k++) this.emit({ x: c.x + rnd(-40, 40), y: c.y + rnd(-10, 50), vy: rnd(-90, -40), life: rnd(0.8, 1.3), color: col, shape: 'text', glyph: '+', size: rnd(18, 30) });
        sfx.heal();
        return 250;
      case 'bolt': {
        this.beam({ kind: 'bolt', a: c, b: { x: t.x, y: t.y }, color: col, life: 0.38 });
        this.later(120, () => { this.flash('#fff6c0', 0.55); this.burst(t.x, t.y, '#fff3a0', 40, 380, 5, 0.6); this.ring(t.x, t.y, col, 110); this.shake(10); });
        return 130;
      }
      case 'shield':
        this.ring(c.x, c.y, col, 120, 0.6, 8);
        this.burst(c.x, c.y, col, 24, 200, 4, 0.9);
        sfx.shield();
        return 200;
      case 'cloud':
        this.proj(c, t, { color: col, size: 10, dur: 0.5, arc: -40, trail: () => col });
        hit(500, () => {
          for (let k = 0; k < 30; k++) this.emit({ x: t.x + rnd(-30, 30), y: t.y + rnd(-20, 40), vx: rnd(-25, 25), vy: rnd(-30, 5), size: rnd(18, 34), grow: 18, life: rnd(1.1, 1.7), color: pick([col, '#5fcf2b', '#b86bff']), a: 0.32 });
        });
        return 500;
      case 'storm':
        for (let k = 0; k < 14; k++) hit(k * 45, () => {
          const x = t.x + rnd(-60, 60);
          this.proj({ x: x - 90, y: t.y - 300 }, { x, y: t.y + rnd(-20, 30) }, { color: col, size: 10, dur: 0.28, kind: 'shard', trail: () => '#e6faff' });
          this.later(280, () => this.burst(x, t.y, '#bff1ff', 8, 160, 4, 0.5, { shape: 'shard' }));
        });
        hit(650, () => { this.ring(t.x, t.y, col, 120); this.shake(8); });
        return 700;
      case 'heart':
        this.ring(c.x, c.y, col, 110, 0.6);
        for (let k = 0; k < 14; k++) this.emit({ x: c.x + rnd(-50, 50), y: c.y + rnd(0, 60), vy: rnd(-100, -50), life: rnd(0.9, 1.5), color: pick([col, '#ff9ec4', '#fff']), shape: 'text', glyph: '♥', size: rnd(20, 36) });
        sfx.heal();
        return 300;
      case 'pentagram':
        this.beam({ kind: 'pent', a: t, color: col, life: 0.8 });
        hit(780, () => { this.burst(t.x, t.y, () => pick([col, '#fff', '#8a2bff']), 60, 420, 6, 0.8); this.ring(t.x, t.y, col, 150, 0.6, 10); this.flash(col, 0.4); this.shake(16); });
        return 780;
      case 'vortex':
        for (let k = 0; k < 80; k++) hit(k * 8, () => {
          this.emit({ shape: 'dot', size: rnd(3, 7), life: 0.8, color: pick([col, '#fff', '#2a0a5a']), orbit: { cx: t.x, cy: t.y, a: Math.random() * TAU, r: rnd(90, 170), da: 7, dr: -150 } });
        });
        hit(850, () => { this.burst(t.x, t.y, () => pick([col, '#000', '#c9a8ff']), 70, 460, 7, 0.9); this.ring(t.x, t.y, col, 190, 0.7, 12); this.flash('#220044', 0.55); this.shake(22); });
        return 880;
      case 'drain':
        this.burst(t.x, t.y, col, 30, 260, 5, 0.6);
        this.ring(t.x, t.y, col, 110, 0.5);
        for (let k = 0; k < 45; k++) hit(150 + k * 10, () => {
          this.emit({ x: t.x + rnd(-20, 20), y: t.y + rnd(-20, 20), size: rnd(4, 8), life: 0.9, color: pick([col, '#ffb0ff', '#fff']), home: { tx: c.x, ty: c.y, k: 4.5 } });
        });
        this.shake(10);
        return 250;
      case 'inferno':
        this.flash('#ff5522', 0.35);
        for (let k = 0; k < 130; k++) hit(100 + k * 5, () => {
          this.emit({ x: t.x + rnd(-45, 45), y: t.y + 60, vx: rnd(-40, 40), vy: rnd(-520, -240), size: rnd(10, 24), grow: -6, life: rnd(0.6, 1.1), color: pick(['#ff3b1f', '#ff8a1f', '#ffd23f', '#fff1a8']), a: 0.8 });
        });
        for (let k = 0; k < 3; k++) hit(150 + k * 180, () => this.ring(t.x, t.y + 40, k % 2 ? '#ffd23f' : '#ff3b3b', 200, 0.7, 12));
        hit(450, () => { this.shake(26); this.burst(t.x, t.y, () => pick(['#ff3b1f', '#ffd23f']), 80, 520, 8, 0.9); });
        return 450;
      case 'clover':
        this.ring(c.x, c.y, col, 140, 0.8, 10);
        for (let k = 0; k < 20; k++) this.emit({ shape: 'text', glyph: pick(['☘', '✦', '✿']), size: rnd(20, 34), life: rnd(1.2, 1.8), color: pick([col, '#fff', '#ffe14d']), orbit: { cx: c.x, cy: c.y, a: Math.random() * TAU, r: rnd(30, 90), da: rnd(2, 4), dr: rnd(10, 40) } });
        this.flash(col, 0.25);
        sfx.heal();
        return 400;
      default:
        this.proj(c, t, { color: col, size: 12, dur: 0.6, trail: () => col });
        return 600;
    }
  }

  /** Treffer-Effekt (nach dem Zauber): Zauberer blinkt, Zahl fliegt. */
  hitFx(i, amount, absorbed, color) {
    const c = this.center(i);
    if (amount > 0) {
      this.hurt[i] = 0.45;
      this.float(i, `-${amount}`, '#ff5a5a', 26 + Math.min(26, amount / 3));
      this.burst(c.x, c.y, color || '#fff', 8 + Math.min(20, amount / 3), 200, 4, 0.5);
      this.shake(Math.min(20, 4 + amount / 5));
      sfx.hit(amount >= 50);
    }
    if (absorbed > 0) this.float(i, `🛡 ${absorbed}`, '#8fc2ff', 22);
  }
  healFx(i, amount, drain) { if (amount > 0) this.float(i, `+${amount}`, drain ? '#ff9cf0' : '#6bff9a', 28); }
  shieldFx(i, amount) { this.float(i, `🛡 +${amount}`, '#8fc2ff', 26); }
  dotFx(i, type, amount, absorbed) {
    const c = this.center(i);
    this.hurt[i] = 0.3;
    this.float(i, `${type === 'burn' ? '🔥' : '☠'} -${amount}`, type === 'burn' ? '#ff9a4f' : '#9dff6b', 22);
    this.burst(c.x, c.y, type === 'burn' ? '#ff8a1f' : '#8dff4d', 10, 120, 4, 0.5, { g: -80 });
  }

  // ------------------------------------------------------------ Update
  update(dt) {
    this.timers = this.timers.filter((t) => { t.t -= dt; if (t.t <= 0) { t.fn(); return false; } return true; });
    for (let i = 0; i < 2; i++) { this.hurt[i] = Math.max(0, this.hurt[i] - dt); this.cast_[i] = Math.max(0, this.cast_[i] - dt); }
    this.shakeV *= Math.pow(0.02, dt); if (this.shakeV < 0.3) this.shakeV = 0;
    this.flashV = Math.max(0, this.flashV - dt * 1.6);

    for (const pr of this.projs) {
      pr.t += dt / pr.dur;
      const k = Math.min(1, pr.t);
      const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
      const dx = pr.x1 - pr.x0, dy = pr.y1 - pr.y0, len = Math.hypot(dx, dy) || 1;
      pr.x = pr.x0 + dx * e + (-dy / len) * pr.wob * Math.sin(k * Math.PI);
      pr.y = pr.y0 + dy * e + (dx / len) * pr.wob * Math.sin(k * Math.PI) + pr.arc * Math.sin(k * Math.PI);
      pr.ang = Math.atan2(dy, dx);
      if (pr.trail) this.emit({ x: pr.x + rnd(-3, 3), y: pr.y + rnd(-3, 3), vx: rnd(-30, 30), vy: rnd(-30, 30), size: pr.size * rnd(0.3, 0.7), life: rnd(0.25, 0.5), color: pr.trail() });
    }
    this.projs = this.projs.filter((p) => p.t < 1);

    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);

    for (const p of this.ps) {
      p.life -= dt;
      if (p.orbit) {
        const o = p.orbit; o.a += o.da * dt; o.r = Math.max(2, o.r + o.dr * dt);
        p.x = o.cx + Math.cos(o.a) * o.r; p.y = o.cy + Math.sin(o.a) * o.r;
      } else if (p.home) {
        p.x += (p.home.tx - p.x) * Math.min(1, p.home.k * dt); p.y += (p.home.ty - p.y) * Math.min(1, p.home.k * dt);
      } else {
        p.vy += p.g * dt;
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d; p.vy *= d;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      p.size = Math.max(0.1, p.size + p.grow * dt);
      p.rot += p.vr * dt;
    }
    this.ps = this.ps.filter((p) => p.life > 0);

    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 0.97; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  // ------------------------------------------------------------ Zeichnen
  draw(time) {
    const { ctx, w, h } = this;
    if (!w) { this.resize(); return; }
    ctx.save();
    if (this.shakeV) ctx.translate(rnd(-this.shakeV, this.shakeV), rnd(-this.shakeV, this.shakeV));

    // Himmel
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#120a35'); g.addColorStop(0.6, '#2e1a66'); g.addColorStop(1, '#4a2a7c');
    ctx.fillStyle = g; ctx.fillRect(-30, -30, w + 60, h + 60);
    for (const [sx, sy, sr, ph] of this.stars) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 1.5 + ph);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * w, sy * h, sr, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.beginPath(); ctx.arc(w * 0.18, h * 0.16, Math.min(w, h) * 0.07, 0, TAU); ctx.fill();
    // Hügel
    ctx.fillStyle = '#24124f';
    ctx.beginPath(); ctx.moveTo(0, h * 0.6);
    ctx.quadraticCurveTo(w * 0.25, h * 0.42, w * 0.5, h * 0.58);
    ctx.quadraticCurveTo(w * 0.8, h * 0.4, w, h * 0.56);
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();

    // Plattformen + Zauberer (hinterer zuerst)
    const order = [1 - this.you, this.you];
    for (const i of order) {
      const p = this.P(i), s = this.size();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + s * 0.1, s * 1.05, s * 0.28, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(120,90,200,0.35)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 1.05, s * 0.28, 0, 0, TAU); ctx.fill();
      this.wizard(i, p.x, p.y, s, time);
      const st = this.st[i];
      if (st.shield > 0) {
        const c = this.center(i);
        const pulse = 1 + 0.04 * Math.sin(time * 5);
        const rg = ctx.createRadialGradient(c.x, c.y, s * 0.6, c.x, c.y, s * 1.5 * pulse);
        rg.addColorStop(0, 'rgba(110,170,255,0.05)'); rg.addColorStop(1, 'rgba(110,170,255,0.55)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(c.x, c.y, s * 1.5 * pulse, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(180,215,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      }
      const icons = (st.burn ? '🔥' : '') + (st.poison ? '☠️' : '') + (st.chill ? '❄️' : '');
      if (icons) { ctx.font = `${Math.round(s * 0.34)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(icons, p.x, p.y - s * 2.35); }
    }

    // Strahlen
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.beams) {
      const k = b.life / (b.max || 0.4);
      if (b.kind === 'bolt') {
        ctx.strokeStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 24; ctx.lineWidth = 6 * k + 2; ctx.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y);
          const n = 9;
          for (let j = 1; j < n; j++) {
            const f = j / n;
            ctx.lineTo(b.a.x + (b.b.x - b.a.x) * f + rnd(-26, 26), b.a.y + (b.b.y - b.a.y) * f + rnd(-26, 26));
          }
          ctx.lineTo(b.b.x, b.b.y); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        }
        ctx.shadowBlur = 0;
      } else if (b.kind === 'pent') {
        const prog = 1 - k, r = this.size() * (0.5 + prog * 1.6);
        ctx.save(); ctx.translate(b.a.x, b.a.y); ctx.rotate(prog * 3);
        ctx.strokeStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 24; ctx.lineWidth = 5; ctx.lineJoin = 'round';
        ctx.globalAlpha = Math.min(1, prog * 3);
        ctx.beginPath();
        [0, 2, 4, 1, 3, 0].forEach((v, j) => { const a = -Math.PI / 2 + v * TAU / 5; ctx[j ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); });
        ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // Geschosse
    for (const pr of this.projs) {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.ang || 0);
      ctx.shadowColor = pr.color; ctx.shadowBlur = 24; ctx.fillStyle = pr.color;
      if (pr.kind === 'shard') {
        ctx.beginPath(); ctx.moveTo(pr.size * 1.8, 0); ctx.lineTo(0, -pr.size * 0.6); ctx.lineTo(-pr.size, 0); ctx.lineTo(0, pr.size * 0.6); ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, pr.size, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, pr.size * 0.45, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    // Partikel
    for (const p of this.ps) {
      const k = Math.max(0, p.life / p.max);
      ctx.globalAlpha = Math.min(1, k * 1.6) * p.a;
      if (p.shape === 'dot') {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, TAU); ctx.fill();
      } else if (p.shape === 'shard') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1.5, p.size * 0.5); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(a) * p.size * 3, p.y - Math.sin(a) * p.size * 3); ctx.stroke();
      } else if (p.shape === 'ring') {
        const r = p.size + p.grow * (p.max - p.life);
        ctx.strokeStyle = p.color; ctx.lineWidth = (p.width || 5) * k; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
      } else if (p.shape === 'text') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = p.color; ctx.font = `700 ${p.size}px system-ui, sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(p.glyph, p.x, p.y);
        ctx.globalCompositeOperation = 'lighter';
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Zahlen
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `900 ${t.size}px system-ui, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (this.flashV > 0) { ctx.globalAlpha = Math.min(0.6, this.flashV); ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  }

  wizard(i, x, y, s, time) {
    const { ctx } = this;
    const flip = i !== this.you; // Gegner blickt nach links
    const bob = Math.sin(time * 2.2 + i) * s * 0.04;
    const hurt = this.hurt[i] > 0;
    const cast = this.cast_[i];
    const color = this.colors[i];
    ctx.save();
    ctx.translate(x + (hurt ? rnd(-4, 4) : 0), y + bob);
    if (this.dead[i]) { ctx.rotate(flip ? -1.3 : 1.3); ctx.translate(0, s * 0.3); ctx.globalAlpha = 0.75; }
    ctx.scale(flip ? -1 : 1, 1);
    if (hurt) { ctx.shadowColor = '#ff2a2a'; ctx.shadowBlur = 24; }
    // Stab
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.62, s * 0.05); ctx.lineTo(s * 0.62, -s * 1.35 - cast * s * 0.2); ctx.stroke();
    ctx.fillStyle = cast > 0 ? '#fff' : '#ffd86b';
    ctx.shadowColor = cast > 0 ? '#fff' : '#ffd86b'; ctx.shadowBlur = 14 + cast * 40;
    ctx.beginPath(); ctx.arc(s * 0.62, -s * 1.42 - cast * s * 0.2, s * (0.13 + cast * 0.18), 0, TAU); ctx.fill();
    ctx.shadowBlur = hurt ? 24 : 0; ctx.shadowColor = '#ff2a2a';
    // Robe
    const rg = ctx.createLinearGradient(0, -s, 0, 0);
    rg.addColorStop(0, color); rg.addColorStop(1, '#241a52');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.moveTo(-s * 0.55, 0); ctx.quadraticCurveTo(-s * 0.5, -s * 0.8, -s * 0.28, -s * 0.95);
    ctx.lineTo(s * 0.28, -s * 0.95); ctx.quadraticCurveTo(s * 0.5, -s * 0.8, s * 0.55, 0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    // Gürtel
    ctx.fillStyle = '#ffd86b'; ctx.fillRect(-s * 0.36, -s * 0.5, s * 0.72, s * 0.07);
    // Kopf
    ctx.fillStyle = '#f4cfa0'; ctx.beginPath(); ctx.arc(0, -s * 1.1, s * 0.27, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(s * 0.1, -s * 1.1, s * 0.035, 0, TAU); ctx.arc(s * 0.2, -s * 1.1, s * 0.035, 0, TAU); ctx.fill();
    // Bart
    ctx.fillStyle = '#e8e8f0'; ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 1.02); ctx.quadraticCurveTo(0, -s * 0.5, s * 0.2, -s * 1.02); ctx.quadraticCurveTo(0, -s * 0.9, -s * 0.2, -s * 1.02); ctx.fill();
    // Hut
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 1.25); ctx.lineTo(s * 0.42, -s * 1.25); ctx.lineTo(s * 0.12, -s * 2.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd86b'; ctx.fillRect(-s * 0.32, -s * 1.34, s * 0.64, s * 0.08);
    ctx.restore();
  }
}
