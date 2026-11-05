// Partikel- und Effekt-Engine: für jeden Zauber ein eigener Look.
import { TAU, clamp, lerp, rnd, pick, easeOut, easeInOut, rgba, lighten, darken, glow, glowSprite, softSprite, mix } from './gfx.js';
import { SPELL_BY_ID } from './spells.js';
import { sfx } from './audio.js';

const FIRE = ['#fff6c0', '#ffd23f', '#ff8a1f', '#e0401a', '#6a1a10'];
const ICE = ['#ffffff', '#c8f4ff', '#7fd8ff', '#3fa0e0'];
const POISON = ['#e8ffb0', '#a6ff4d', '#5fcf2b', '#2a7a1a'];
const ARCANE = ['#ffffff', '#e8c8ff', '#b565ff', '#6a2ad0'];
const GOLD = ['#ffffff', '#fff2a8', '#ffd35c', '#d99a1a'];

export class FX {
  constructor(scene) {
    this.sc = scene;
    this.ps = [];
    this.ents = [];
    this.projs = [];
    this.nums = [];
    scene.fx = this;
  }

  clear() { this.ps = []; this.ents = []; this.projs = []; this.nums = []; }

  // ------------------------------------------------------------ Grundbausteine
  p(o) {
    if (this.ps.length > (this.max || 900)) return;
    this.ps.push({ x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, life: 1, size: 6, size1: 0, col: '#fff', a: 1, a1: 0, shape: 'glow', rot: 0, vr: 0, layer: 1, ...o, max: o.life ?? 1 });
  }
  ent(life, draw, layer = 1) { this.ents.push({ life, max: life, draw, layer }); }
  later(ms, fn) { this.ent(ms / 1000, (g, e, k) => { if (k > 0.999 || e._done) return; }, 1); this.ents[this.ents.length - 1].onEnd = fn; }

  burst(x, y, { n = 20, pal, col = '#fff', speed = 200, size = 8, size1 = 0, life = 0.6, shape = 'glow', ay = 0, drag = 2, layer = 1, a = 1, spread = TAU, dir = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const ang = dir + (Math.random() - 0.5) * spread, sp = rnd(0.25, 1) * speed;
      this.p({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ay, drag, size: size * rnd(0.6, 1.3), size1, life: life * rnd(0.6, 1), col: pal ? pal[0] : col, pal, a, shape, layer, rot: Math.random() * TAU, vr: rnd(-6, 6) });
    }
  }
  ring(x, y, col, r = 90, life = 0.5, w = 5, flat = 1) {
    this.ent(life, (g, e, k) => {
      g.save(); g.translate(x, y); g.scale(1, flat); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba(col, (1 - k) * 0.9); g.lineWidth = w * (1 - k) + 0.5;
      g.beginPath(); g.arc(0, 0, r * easeOut(k), 0, TAU); g.stroke(); g.restore();
    });
  }
  groundRing(i, col, r, life = 0.6) { const f = this.sc.feet(i); this.ring(f.x, f.y, col, r, life, 5, 0.3); }
  smoke(x, y, n = 8, col = '#8a8a99', size = 22, life = 1.0, up = -30) {
    for (let i = 0; i < n; i++) this.p({ x: x + rnd(-10, 10), y: y + rnd(-8, 8), vx: rnd(-25, 25), vy: rnd(-20, 10) + up, drag: 1, size: size * 0.5, size1: size * rnd(1.2, 2), life: life * rnd(0.7, 1.2), col, shape: 'soft', a: 0.5, layer: 1 });
  }
  light(x, y, r, col, life = 0.4, a = 0.6) { this.sc.light(x, y, r, col, life, a); }

  bolt(a, b, col = '#ffe14d', life = 0.35, w = 5, branches = 2) {
    const mk = (p0, p1, off) => {
      const n = Math.max(4, Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) / 22)), pts = [];
      for (let i = 0; i <= n; i++) { const f = i / n, o = i === 0 || i === n ? 0 : off; pts.push([lerp(p0.x, p1.x, f) + rnd(-o, o), lerp(p0.y, p1.y, f) + rnd(-o, o)]); }
      return pts;
    };
    const main = mk(a, b, 22), subs = [];
    for (let k = 0; k < branches; k++) {
      const s = main[1 + Math.floor(Math.random() * (main.length - 2))];
      subs.push(mk({ x: s[0], y: s[1] }, { x: s[0] + rnd(-90, 90), y: s[1] + rnd(20, 110) }, 12));
    }
    this.ent(life, (g, e, k) => {
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
      const al = (1 - k) * (0.7 + 0.3 * Math.sin(k * 60));
      for (const [pts, ww] of [[main, w], ...subs.map((s) => [s, w * 0.45])]) {
        for (const [c, mul, aa] of [[col, 3.2, 0.35], [lighten(col, 0.5), 1.4, 0.9], ['#ffffff', 0.6, 1]]) {
          g.strokeStyle = rgba(c.length === 7 ? c : '#ffffff', aa * al); g.lineWidth = ww * mul;
          g.beginPath(); pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y)); g.stroke();
        }
      }
      g.restore();
    });
  }

  number(i, text, col, size = 26, dx = 0) {
    const h = this.sc.head(i), pos = this.sc.pos(i);
    this.nums.push({ x: h.x + dx + rnd(-10, 10), y: h.y - 0.35 * pos.s, vy: -70, life: 1.25, max: 1.25, text, col, size });
  }
  label(i, text, col) { this.number(i, text, col, 17, 0); this.nums[this.nums.length - 1].y -= 22; }

  // ------------------------------------------------------------ Geschosse
  launch(from, to, dur, o) {
    const pr = { x0: from.x, y0: from.y, x1: to.x, y1: to.y, x: from.x, y: from.y, t: 0, dur: Math.max(0.12, dur), arc: 0, wob: 0, ang: 0, spin: 0, hold: 0, acc: 0, ...o };
    this.projs.push(pr);
    return pr;
  }
  arrive(key) { // der Server meldet Treffer/Ausweichen: Geschoss verschwindet
    for (const pr of this.projs) if (pr.key === key && !pr.dead) { pr.dead = true; if (pr.onEnd) pr.onEnd(pr); }
  }

  // ------------------------------------------------------------ Zeitschritt
  update(dt) {
    for (const pr of this.projs) {
      if (pr.dead) continue;
      pr.t += dt / pr.dur;
      const k = Math.min(1, pr.t), e = pr.ease ? pr.ease(k) : k;
      const dx = pr.x1 - pr.x0, dy = pr.y1 - pr.y0, len = Math.hypot(dx, dy) || 1;
      const s = Math.sin(k * Math.PI);
      pr.x = pr.x0 + dx * e + (-dy / len) * pr.wob * s;
      pr.y = pr.y0 + dy * e + (dx / len) * pr.wob * s - pr.arc * s;
      pr.ang = Math.atan2(dy - pr.arc * Math.PI * Math.cos(k * Math.PI) * 0.5, dx);
      pr.rot = (pr.rot || 0) + pr.spin * dt;
      if (pr.trail) pr.trail(this, pr, dt);
      if (pr.t >= 1) { pr.hold += dt; if (pr.hold > 0.45) { pr.dead = true; if (pr.onEnd) pr.onEnd(pr); } }
    }
    this.projs = this.projs.filter((p) => !p.dead);

    for (const q of this.ps) {
      q.life -= dt;
      if (q.home) { const kk = 1 - q.life / q.max, f = Math.min(1, dt * (3 + kk * 10)); q.x += (q.tx - q.x) * f; q.y += (q.ty - q.y) * f; continue; }
      if (q.orbit) { const age = q.max - q.life; const an = q.oa + q.od * age, rr = q.or * (1 + 0.15 * Math.sin(age * 3)); q.x = q.ox + Math.cos(an) * rr; q.y = q.oy + Math.sin(an) * rr * 0.75 - age * 14; q.rot += q.vr * dt; continue; }
      q.vx += q.ax * dt; q.vy += q.ay * dt;
      const d = Math.max(0, 1 - q.drag * dt); q.vx *= d; q.vy *= d;
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    }
    this.ps = this.ps.filter((q) => q.life > 0);
    for (const e of this.ents) { e.life -= dt; if (e.life <= 0 && e.onEnd) { e.onEnd(); e.onEnd = null; } }
    this.ents = this.ents.filter((e) => e.life > 0);
    for (const n of this.nums) { n.life -= dt; n.y += n.vy * dt; n.vy *= Math.pow(0.08, dt); }
    this.nums = this.nums.filter((n) => n.life > 0);
  }

  // ------------------------------------------------------------ Zeichnen
  drawPart(g, q) {
    const k = 1 - q.life / q.max;
    const size = lerp(q.size, q.size1 || q.size * 0.3, k), a = clamp(lerp(q.a, q.a1, k) * (k < 0.08 ? k / 0.08 : 1), 0, 1);
    if (a <= 0.01 || size <= 0.2) return;
    let col = q.col;
    if (q.pal) col = q.pal[Math.min(q.pal.length - 1, Math.floor(k * q.pal.length))];
    g.globalAlpha = a;
    switch (q.shape) {
      case 'glow': g.drawImage(glowSprite(col), q.x - size, q.y - size, size * 2, size * 2); break;
      case 'soft': g.drawImage(softSprite(col), q.x - size, q.y - size, size * 2, size * 2); break;
      case 'spark': {
        const sp = Math.hypot(q.vx, q.vy) || 1, l = Math.min(30, size * 1.6 + sp * 0.04);
        g.strokeStyle = col; g.lineWidth = Math.max(1, size * 0.28); g.lineCap = 'round';
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - (q.vx / sp) * l, q.y - (q.vy / sp) * l); g.stroke(); break;
      }
      case 'shard': {
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = col;
        g.beginPath(); g.moveTo(size, 0); g.lineTo(-size * 0.5, -size * 0.4); g.lineTo(-size * 0.3, size * 0.4); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(size, 0); g.lineTo(-size * 0.2, -size * 0.12); g.lineTo(-size * 0.1, size * 0.1); g.closePath(); g.fill(); g.restore(); break;
      }
      case 'rock': {
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = col;
        g.beginPath(); g.moveTo(size, 0); g.lineTo(size * 0.2, -size * 0.9); g.lineTo(-size * 0.8, -size * 0.3); g.lineTo(-size * 0.6, size * 0.7); g.lineTo(size * 0.3, size * 0.8); g.closePath(); g.fill(); g.restore(); break;
      }
      case 'text': g.font = `700 ${size}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(q.glyph, q.x, q.y); break;
      case 'star4': {
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = col; g.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 ? size * 0.28 : size; const an = i * Math.PI / 4; g[i ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); }
        g.closePath(); g.fill(); g.restore(); break;
      }
      case 'crystal': { // wächst aus dem Boden
        const h = size * (k < 0.25 ? easeOut(k / 0.25) : 1);
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot);
        const gr = g.createLinearGradient(0, 0, 0, -h); gr.addColorStop(0, '#3fa0e0'); gr.addColorStop(1, '#e8fbff');
        g.fillStyle = gr; g.beginPath(); g.moveTo(-size * 0.22, 0); g.lineTo(0, -h); g.lineTo(size * 0.22, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(-size * 0.05, 0); g.lineTo(0, -h); g.lineTo(size * 0.1, 0); g.closePath(); g.fill(); g.restore(); break;
      }
      default: break;
    }
  }

  drawLayer(g, layer) {
    const add = ['glow', 'spark'], norm = (q) => !add.includes(q.shape);
    g.save();
    g.globalCompositeOperation = 'source-over';
    for (const q of this.ps) if (q.layer === layer && norm(q)) this.drawPart(g, q);
    for (const e of this.ents) if (e.layer === layer) { g.save(); e.draw(g, e, 1 - e.life / e.max); g.restore(); }
    g.globalCompositeOperation = 'lighter';
    for (const q of this.ps) if (q.layer === layer && !norm(q)) this.drawPart(g, q);
    g.restore(); g.globalAlpha = 1;
  }
  drawBack(g) { this.drawLayer(g, 0); }
  drawFront(g) {
    this.drawLayer(g, 1);
    for (const pr of this.projs) { if (pr.dead || !pr.draw) continue; g.save(); pr.draw(g, pr); g.restore(); }
    g.globalAlpha = 1;
    for (const n of this.nums) {
      const k = 1 - n.life / n.max, pop = k < 0.15 ? 0.6 + 0.8 * easeOut(k / 0.15) : 1 - (k - 0.15) * 0.15;
      g.save(); g.globalAlpha = clamp(n.life * 2.2); g.translate(n.x, n.y); g.scale(pop, pop);
      g.font = `900 ${n.size}px system-ui, -apple-system, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = Math.max(4, n.size * 0.22); g.strokeStyle = 'rgba(10,4,30,.85)'; g.strokeText(n.text, 0, 0);
      g.fillStyle = n.col; g.fillText(n.text, 0, 0); g.restore();
    }
  }

  // ------------------------------------------------------------ Auren (Status)
  flameAura(x, y, s) { this.p({ x, y, vx: rnd(-10, 10), vy: rnd(-70, -35), size: s * rnd(0.13, 0.22), size1: 0, life: rnd(0.45, 0.8), pal: FIRE, a: 0.85, layer: 1 }); }
  bubbleAura(x, y, s) { this.p({ x, y, vx: rnd(-8, 8), vy: rnd(-45, -20), size: s * rnd(0.06, 0.12), size1: s * 0.04, life: rnd(0.7, 1.2), col: '#8dff4d', a: 0.8, shape: 'glow', layer: 1 }); }
  frostAura(x, y, s) { this.p({ x, y, vx: rnd(-10, 10), vy: rnd(-15, 15), size: s * 0.07, size1: 0, life: rnd(0.5, 0.9), col: '#cdf4ff', shape: 'star4', a: 0.9, layer: 1, vr: 3 }); }
  curseAura(x, y, s) { this.p({ x, y, vx: rnd(-8, 8), vy: rnd(-40, -15), size: s * rnd(0.12, 0.2), size1: s * 0.05, life: rnd(0.6, 1.0), col: '#8a3ad0', shape: 'soft', a: 0.55, layer: 1 }); }
  regenAura(x, y, s) { this.p({ x, y, vx: rnd(-6, 6), vy: rnd(-60, -30), size: s * 0.16, life: rnd(0.7, 1.1), col: '#7dffc8', shape: 'text', glyph: '+', a: 0.9, layer: 1 }); }
  phoenixAura(x, y, s) { this.p({ x, y, vx: rnd(-12, 12), vy: rnd(-90, -40), size: s * rnd(0.06, 0.11), life: rnd(0.5, 0.9), pal: ['#fff6c0', '#ffb43a', '#ff6a1a'], a: 0.9, layer: 1 }); }
  rebirth(e) {
    const sc = this.sc, c = sc.chest(e.p), f = sc.feet(e.p), pos = sc.pos(e.p);
    sc.flash('#fff0c0', 0.7); sc.shake(10); sc.slowmo(0.35, 0.25);
    for (let k = 0; k < 4; k++) this.later(k * 90, () => this.ring(f.x, f.y, '#ffb43a', pos.s * (1.2 + k * 0.5), 0.7, 7, 0.3));
    this.burst(c.x, c.y, { n: 70, pal: ['#fff6c0', '#ffb43a', '#ff6a1a'], speed: 420, size: 12, life: 1.0, ay: -140 });
    this.burst(c.x, c.y, { n: 20, col: '#ffd35c', speed: 300, size: 8, life: 0.9, shape: 'star4' });
    this.light(c.x, c.y, 320, '#ffb43a', 0.9, 0.9);
    this.label(e.p, 'Wiedergeboren!', '#ffd35c'); this.number(e.p, `+${e.hp}`, '#6bff9a', 34);
    sfx.levelUp();
  }
  hasteAura(x, y, s, dir) { this.p({ x, y, vx: dir * rnd(120, 220), vy: 0, size: s * 0.1, life: 0.3, col: '#fff08a', shape: 'spark', a: 0.8, layer: 1 }); }

  // ------------------------------------------------------------ Zauber wirken
  cast(e) {
    const sp = SPELL_BY_ID[e.id], sc = this.sc, i = e.p;
    if (!sp) return;
    sc.trigger(i, 'cast'); sc.pl[i].orb = sp.color;
    const tip = sc.tip(i), from = { x: tip.x, y: tip.y }, tgt = 1 - i, to = sc.chest(tgt);
    this.light(tip.x, tip.y, 90, sp.color, 0.4, 0.55);
    this.burst(tip.x, tip.y, { n: 10, col: sp.color, speed: 120, size: 6, life: 0.4 });
    sfx.cast(sp.id);
    const key = `${i}:${e.id}`;
    const fn = CASTS[sp.id] || CASTS._default;
    fn(this, { e, sp, i, tgt, from, to, key, dur: e.travel || 0.5, c: sc.chest(i), feet: sc.feet(i), tfeet: sc.feet(tgt), pos: sc.pos(i), tpos: sc.pos(tgt) });
  }

  // ------------------------------------------------------------ Treffer
  hit(e) {
    const sp = SPELL_BY_ID[e.id], sc = this.sc, t = e.p, c = sc.chest(t);
    this.arrive(`${e.src}:${e.id}`);
    const ctx = { e, sp, i: e.src, tgt: t, at: c, feet: sc.feet(t), pos: sc.pos(t), n: e.n || 0 };
    const fn = IMPACTS[sp.id] || IMPACTS._default;
    fn(this, ctx);
    if (e.amount > 0) {
      sc.trigger(t, 'hurt', 1);
      const big = e.amount >= 40;
      this.number(t, String(e.amount), big ? '#ffd23f' : '#ffffff', big ? 36 : 26);
      sc.shake(clamp(3 + e.amount / 6, 3, 18));
      if (big || sp.rarity === 'legendary' || sp.rarity === 'mythic') sc.slowmo(0.3, 0.12);
      sfx.hit(e.amount);
    }
    if (e.absorbed > 0) {
      this.number(t, `🛡 ${e.absorbed}`, '#9cc8ff', 18, e.amount > 0 ? 34 : 0);
      this.burst(c.x, c.y, { n: 10, col: '#9cc8ff', speed: 220, size: 6, life: 0.4 });
      sfx.block();
    }
  }
  evade(e) {
    this.arrive(`${e.src ?? 1 - e.p}:${e.id}`);
    this.sc.trigger(e.p, 'dodge');
    this.label(e.p, 'Ausgewichen!', '#c8d0ff');
    const c = this.sc.chest(e.p);
    this.burst(c.x, c.y, { n: 10, col: '#c8d0ff', speed: 150, size: 6, life: 0.4 });
  }
  reflect(e) {
    const sc = this.sc, at = sc.chest(e.p), back = sc.chest(1 - e.p);
    this.arrive(`${1 - e.p}:${e.id}`);
    this.label(e.p, 'Reflektiert!', '#eaf0ff');
    this.ring(at.x, at.y, '#ffffff', 90, 0.45, 6);
    this.burst(at.x, at.y, { n: 18, col: '#eaf0ff', speed: 260, size: 6, life: 0.5, shape: 'spark' });
    this.light(at.x, at.y, 120, '#ffffff', 0.35, 0.7);
    sfx.reflect();
    const sp = SPELL_BY_ID[e.id];
    this.launch(at, back, e.travel || 0.5, { key: `${e.p}:${e.id}`, draw: (g, pr) => { glow(g, pr.x, pr.y, 26, sp.color, 0.9); glow(g, pr.x, pr.y, 12, '#ffffff', 1); g.globalAlpha = 1; }, trail: (fx, pr, dt) => { if (Math.random() < dt * 60) fx.p({ x: pr.x, y: pr.y, col: sp.color, size: 9, life: 0.3, vx: rnd(-20, 20), vy: rnd(-20, 20) }); } });
  }
  heal(e) {
    const sc = this.sc, c = sc.chest(e.p), f = sc.feet(e.p), pos = sc.pos(e.p);
    this.number(e.p, `+${e.amount}`, '#6bff9a', 28);
    if (e.src === 'drain') {
      const from = sc.chest(1 - e.p);
      for (let k = 0; k < 28; k++) {
        const delay = k * 0.018, a0 = Math.random() * TAU;
        this.later(delay * 1000, () => this.p({ x: from.x + Math.cos(a0) * 16, y: from.y + Math.sin(a0) * 16, vx: 0, vy: 0, size: rnd(6, 11), size1: 3, life: 0.55, col: '#ff7ad8', a: 0.9, layer: 1, home: true, tx: c.x, ty: c.y }));
      }
      return;
    }
    if (e.amount < 3) return;
    this.burst(c.x, c.y, { n: 14, col: '#7dffa8', speed: 60, size: 7, life: 0.9, ay: -80, drag: 1 });
    for (let k = 0; k < 5; k++) this.p({ x: c.x + rnd(-0.4, 0.4) * pos.s, y: c.y + rnd(0, 0.6) * pos.s, vy: rnd(-90, -50), size: rnd(16, 24), life: 1.0, col: '#8dffb0', shape: 'text', glyph: '+', a: 1 });
  }
  shield(e) {
    if (e.amount < 0) { const c = this.sc.chest(e.p); this.burst(c.x, c.y, { n: 24, col: '#9cc8ff', speed: 300, size: 7, life: 0.5, shape: 'spark' }); this.label(e.p, 'Schild zerstört!', '#9cc8ff'); return; }
    if (e.expired) { const c = this.sc.chest(e.p); this.burst(c.x, c.y, { n: 12, col: '#9cc8ff', speed: 160, size: 5, life: 0.5 }); return; }
    const c = this.sc.chest(e.p), pos = this.sc.pos(e.p);
    this.number(e.p, `🛡 ${e.amount}`, '#9cc8ff', 24);
    this.ring(c.x, c.y, '#9cc8ff', pos.s * 1.6, 0.5, 6);
    this.burst(c.x, c.y, { n: 18, col: '#d0e6ff', speed: pos.s * 2.2, size: 5, life: 0.5, shape: 'spark' });
    this.light(c.x, c.y, pos.s * 2, '#6aa8ff', 0.4, 0.5);
    sfx.shield();
  }
  mana(e) {
    const c = this.sc.chest(e.p);
    this.number(e.p, `+${e.amount} 💧`, '#7ab8ff', 22);
    for (let k = 0; k < 10; k++) this.p({ x: c.x + rnd(-40, 40), y: c.y + 60, vy: rnd(-120, -60), size: rnd(5, 9), life: 0.8, col: '#7ab8ff', a: 0.9, ay: 0 });
  }
  status(e) {
    const c = this.sc.chest(e.p), pos = this.sc.pos(e.p);
    const L = { burn: ['Brennt!', '#ff9a4f'], poison: ['Vergiftet!', '#9dff6b'], chill: ['Frost!', '#8fe3ff'], stun: ['Betäubt!', '#ffe14d'], reflect: ['Spiegel!', '#eaf0ff'], phase: ['Phase!', '#c8d0ff'], curse: ['Verflucht!', '#c890ff'], regen: ['Quelle!', '#7dffc8'], phoenix: ['Phönix bereit!', '#ffb43a'], haste: ['Hast!', '#fff08a'], gcd: ['Gestört!', '#c8f2ff'] }[e.type];
    if (!L) return;
    if (e.type === 'reflect' || e.type === 'phase' || e.type === 'haste') this.ring(c.x, c.y, L[1], pos.s * 1.4, 0.5, 5);
    this.label(e.p, L[0], L[1]);
    if (e.type === 'chill') this.burst(c.x, c.y, { n: 14, pal: ICE, speed: 150, size: 6, life: 0.6, shape: 'star4' });
    if (e.type === 'curse') { this.ring(c.x, c.y, '#8a3ad0', pos.s * 1.5, 0.6, 6); this.burst(c.x, c.y, { n: 16, pal: ['#e8c8ff', '#8a3ad0', '#3a0a6a'], speed: 140, size: 8, life: 0.7, ay: -40 }); }
    if (e.type === 'phoenix') { this.ring(c.x, c.y, '#ffb43a', pos.s * 1.8, 0.8, 7); this.burst(c.x, c.y, { n: 26, pal: ['#fff6c0', '#ffb43a', '#ff6a1a'], speed: 200, size: 9, life: 0.9, ay: -120 }); }
    if (e.type === 'stun') this.burst(c.x, c.y - pos.s * 0.6, { n: 12, col: '#ffe14d', speed: 160, size: 7, life: 0.6, shape: 'star4' });
  }
  cleanse(e) {
    const c = this.sc.chest(e.p), pos = this.sc.pos(e.p);
    this.ring(c.x, c.y, '#ffffff', pos.s * 1.6, 0.6, 6);
    this.burst(c.x, c.y, { n: 20, col: '#ffffff', speed: 200, size: 6, life: 0.7, shape: 'star4' });
    this.label(e.p, 'Gereinigt!', '#ffffff');
  }
  dot(e) {
    const c = this.sc.chest(e.p);
    if (e.type === 'sudden') { this.number(e.p, `☠ ${e.amount}`, '#ff4a7d', 22); this.sc.trigger(e.p, 'hurt', 0.6); return; }
    if (e.amount <= 0) return;
    const col = e.type === 'burn' ? '#ffa04a' : '#9dff6b';
    this.number(e.p, String(e.amount), col, 17);
    this.burst(c.x, c.y, { n: 4, col, speed: 90, size: 5, life: 0.4 });
    this.sc.trigger(e.p, 'hurt', 0.35);
  }
}

// ====================================================================== Zauber-Looks
function orbDraw(pal, size, flick = true) {
  return (g, pr) => {
    const s = size * (flick ? 1 + 0.12 * Math.sin(pr.t * 40) : 1);
    glow(g, pr.x, pr.y, s * 2.6, pal[2], 0.55); glow(g, pr.x, pr.y, s * 1.5, pal[1], 0.9); glow(g, pr.x, pr.y, s * 0.8, pal[0], 1); g.globalAlpha = 1;
  };
}
function trail(pal, rate = 70, size = 9, o = {}) {
  return (fx, pr, dt) => {
    pr.acc += dt * rate;
    while (pr.acc >= 1) { pr.acc -= 1; fx.p({ x: pr.x + rnd(-4, 4), y: pr.y + rnd(-4, 4), vx: rnd(-25, 25), vy: rnd(-25, 25) + (o.up || 0), size: size * rnd(0.6, 1.2), life: rnd(0.25, 0.5), pal, a: 0.9, ...o.extra }); }
    if (o.smoke && Math.random() < dt * 14) fx.p({ x: pr.x, y: pr.y, vy: -20, size: 8, size1: 22, life: 0.8, col: '#555566', shape: 'soft', a: 0.45 });
  };
}

const CASTS = {
  steinwall(fx, c) {
    for (let k = 0; k < 6; k++) fx.later(k * 45, () => fx.p({ x: c.feet.x + (k - 2.5) * c.pos.s * 0.32, y: c.feet.y + rnd(-6, 6), vy: -rnd(260, 360), ay: 900, size: c.pos.s * rnd(0.22, 0.34), life: 0.9, col: '#b8946a', shape: 'rock', a: 1, rot: rnd(-1, 1), vr: rnd(-3, 3) }));
    fx.smoke(c.feet.x, c.feet.y, 10, '#a08a66', 30, 1.0); fx.ring(c.feet.x, c.feet.y, '#b8946a', c.pos.s * 1.6, 0.6, 6, 0.3); fx.sc.shake(4);
  },
  pfeilsalve(fx, c) {
    for (let k = 0; k < 3; k++) fx.later(k * 140, () => fx.launch(c.from, c.to, Math.max(0.2, c.dur), { arc: (1 - k) * 22, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.ang); g.globalCompositeOperation = 'lighter'; glow(g, 0, 0, 16, '#ffcf8a', 0.55); g.globalAlpha = 1; g.fillStyle = '#fff6dc'; g.fillRect(-16, -1.6, 30, 3.2); g.beginPath(); g.moveTo(14, 0); g.lineTo(6, -5); g.lineTo(6, 5); g.fill(); }, trail: trail(['#ffcf8a', '#fff'], 50, 5) }));
  },
  schwaechefluch(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, arc: 24, draw: orbDraw(['#f0d8ff', '#a05cd8', '#5a1aa8'], 11), trail: (f, pr, dt) => { pr.acc += dt * 55; while (pr.acc >= 1) { pr.acc -= 1; f.p({ x: pr.x + rnd(-5, 5), y: pr.y + rnd(-5, 5), vy: rnd(-30, 5), size: 10, size1: 20, life: rnd(0.4, 0.7), col: '#6a2ab0', shape: 'soft', a: 0.5 }); } } });
  },
  schattenschritt(fx, c) {
    fx.smoke(c.c.x, c.c.y + c.pos.s * 0.3, 14, '#2a2a50', c.pos.s * 0.5, 1.3, -10); fx.ring(c.feet.x, c.feet.y, '#9aa0ff', c.pos.s * 1.5, 0.7, 6, 0.3);
    fx.burst(c.c.x, c.c.y, { n: 18, pal: ['#e8eaff', '#9aa0ff', '#3a3a90'], speed: 160, size: 7, life: 0.9, ay: -30 }); fx.light(c.c.x, c.c.y, 170, '#7a80ff', 0.6, 0.5);
  },
  heilquelle(fx, c) {
    fx.ring(c.feet.x, c.feet.y, '#58e0c0', c.pos.s * 1.5, 0.8, 6, 0.3);
    for (let k = 0; k < 26; k++) fx.later(k * 22, () => fx.p({ x: c.feet.x + rnd(-0.25, 0.25) * c.pos.s, y: c.feet.y - 4, vx: rnd(-50, 50), vy: -rnd(300, 460), ay: 900, size: rnd(5, 9), life: 0.95, pal: ['#ffffff', '#9ff5e0', '#58e0c0'], a: 0.95 }));
    fx.light(c.feet.x, c.feet.y - c.pos.s * 0.5, 190, '#58e0c0', 0.8, 0.5);
  },
  glueckswurf(fx, c) {
    const E = [['Volltreffer!', '#ff9bf2'], ['Heilung!', '#6bff9a'], ['Schild!', '#9cc8ff'], ['Mana!', '#7ab8ff'], ['Betäubung!', '#ffe14d'], ['Feuer!', '#ff9a4f']];
    const o = E[c.e.roll] || E[0];
    for (let k = 0; k < 8; k++) fx.p({ x: c.c.x + rnd(-1, 1) * c.pos.s * 0.4, y: c.c.y - c.pos.s * 0.7, vx: rnd(-80, 80), vy: -rnd(120, 220), ay: 300, size: rnd(18, 28), life: 0.9, col: k % 2 ? '#ff9bf2' : '#fff', shape: 'text', glyph: k % 3 ? '?' : '!', a: 1, rot: rnd(-0.5, 0.5) });
    fx.later(260, () => fx.label(c.i, o[0], o[1]));
    if (c.e.hostile) fx.launch(c.from, c.to, c.dur, { key: c.key, arc: 40, draw: orbDraw(['#fff', o[1], o[1]], 11), trail: trail([o[1], '#fff'], 60, 8) });
  },
  meteor(fx, c) {
    const from = { x: c.to.x - 160, y: -90 };
    fx.ent(c.dur, (g, e, k) => { g.translate(c.tfeet.x, c.tfeet.y); g.scale(1, 0.3); g.globalCompositeOperation = 'lighter'; const r = c.tpos.s * (0.3 + 0.9 * k), pulse = 0.6 + 0.4 * Math.sin(k * 30); g.strokeStyle = `rgba(255,90,40,${0.35 + 0.5 * k * pulse})`; g.lineWidth = 4 + 6 * k; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); g.fillStyle = `rgba(255,60,20,${0.12 * k})`; g.fill(); }, 0);
    fx.launch(from, c.to, c.dur, { key: c.key, arc: 0, draw: orbDraw(['#fff6c0', '#ff8a1f', '#e0401a'], 26), trail: trail(FIRE, 120, 18, { smoke: true, up: -10 }) });
  },
  phoenixnest(fx, c) {
    fx.sc.flash('#ffe8b0', 0.35);
    for (let k = 0; k < 3; k++) fx.later(k * 120, () => fx.ring(c.feet.x, c.feet.y, '#ffb43a', c.pos.s * (1.2 + k * 0.5), 0.8, 6, 0.3));
    for (let k = 0; k < 40; k++) fx.later(k * 16, () => fx.p({ x: c.feet.x + rnd(-1, 1) * c.pos.s * 0.6, y: c.feet.y, vx: rnd(-40, 40), vy: -rnd(120, 360), size: rnd(8, 15), life: rnd(0.8, 1.3), pal: ['#fff6c0', '#ffb43a', '#ff6a1a', '#6a1a10'], a: 0.95, ay: -40 }));
    fx.light(c.c.x, c.c.y, 260, '#ffa23a', 0.9, 0.7);
  },

  _default(fx, c) { fx.launch(c.from, c.to, c.dur, { key: c.key, arc: 30, draw: orbDraw([ '#fff', c.sp.color, c.sp.color ], 9), trail: trail([c.sp.color, '#fff'], 60, 8) }); },

  feuerball(fx, c) { fx.launch(c.from, c.to, c.dur, { key: c.key, arc: 50, draw: orbDraw(FIRE.slice(0, 3), 15), trail: trail(FIRE, 90, 14, { smoke: true, up: -20 }) }); },
  eissplitter(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.ang); glow(g, 0, 0, 30, '#8fe3ff', 0.6); g.globalAlpha = 1; g.fillStyle = '#e8fbff'; g.strokeStyle = '#7fd8ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(26, 0); g.lineTo(-12, -8); g.lineTo(-6, 0); g.lineTo(-12, 8); g.closePath(); g.fill(); g.stroke(); }, trail: trail(ICE, 80, 8, { extra: { shape: 'star4' } }) });
  },
  windstoss(fx, c) {
    for (let k = 0; k < 3; k++) fx.launch(c.from, c.to, c.dur + k * 0.04, { key: k ? undefined : c.key, wob: (k - 1) * 26, arc: 10, spin: 8, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.ang); g.strokeStyle = 'rgba(235,250,255,.9)'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.arc(-4, 0, 16, -1.1, 1.1); g.stroke(); g.strokeStyle = 'rgba(200,240,255,.5)'; g.lineWidth = 8; g.beginPath(); g.arc(-8, 0, 20, -0.9, 0.9); g.stroke(); }, trail: trail(['#ffffff', '#c8f2ff'], 50, 7, { extra: { shape: 'soft', a: 0.6 } }) });
  },
  klingenhieb(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.ang); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(0, 0, 8, 0, 0, 26); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(210,230,255,1)'); g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(-14, 0, 26, -0.95, 0.95); g.stroke(); g.strokeStyle = 'rgba(160,200,255,.6)'; g.lineWidth = 12; g.beginPath(); g.arc(-18, 0, 26, -0.8, 0.8); g.stroke(); }, trail: trail(['#ffffff', '#9cc0ff'], 80, 6, { extra: { shape: 'spark' } }) });
  },
  heilfunke(fx, c) { healAura(fx, c, '#5cf08a', 14); },
  erdbrocken(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, arc: 110, spin: 7, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.rot); g.fillStyle = '#8a6a44'; g.beginPath(); g.moveTo(18, 0); g.lineTo(6, -16); g.lineTo(-14, -9); g.lineTo(-16, 8); g.lineTo(2, 15); g.closePath(); g.fill(); g.fillStyle = '#a98856'; g.beginPath(); g.moveTo(18, 0); g.lineTo(6, -16); g.lineTo(0, -2); g.closePath(); g.fill(); }, trail: trail(['#b89a6a', '#6a5030'], 40, 10, { extra: { shape: 'soft', a: 0.5 } }) });
  },
  manaquelle(fx, c) {
    for (let k = 0; k < 22; k++) fx.later(k * 30, () => { const a = Math.random() * TAU, r = c.pos.s * rnd(1.0, 1.7); fx.p({ x: c.c.x + Math.cos(a) * r, y: c.c.y + Math.sin(a) * r * 0.7, size: rnd(6, 10), size1: 3, life: 0.6, col: '#7ab8ff', a: 0.95, home: true, tx: c.c.x, ty: c.c.y }); });
    fx.ring(c.feet.x, c.feet.y, '#7ab8ff', c.pos.s * 1.4, 0.7, 5, 0.3); fx.light(c.c.x, c.c.y, 150, '#4a90ff', 0.6, 0.5);
  },
  funkenschuss(fx, c) { fx.launch(c.from, c.to, c.dur, { key: c.key, draw: orbDraw(['#ffffff', '#ffe07a', '#ffb43a'], 7), trail: trail(['#ffffff', '#ffe07a'], 90, 5, { extra: { shape: 'spark' } }) }); },

  blitz(fx, c) {
    const top = { x: c.to.x + rnd(-30, 30), y: -20 };
    fx.bolt(top, c.to, '#ffe14d', 0.4, 6, 3); fx.sc.flash('#fff8c0', 0.35); fx.light(c.to.x, c.to.y, 220, '#ffe14d', 0.4, 0.8);
  },
  schlangenbiss(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, wob: 36, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.ang); glow(g, 0, 0, 30, '#7dff6b', 0.6); g.globalAlpha = 1; g.fillStyle = '#4fbf3a'; g.beginPath(); g.ellipse(0, 0, 14, 9, 0, 0, TAU); g.fill(); g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(5, -3, 2.4, 0, TAU); g.arc(5, 3, 2.4, 0, TAU); g.fill(); g.strokeStyle = '#ff4a6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 0); g.lineTo(21, -2); g.moveTo(14, 0); g.lineTo(21, 2); g.stroke(); }, trail: trail(['#c8ff9a', '#7dff6b', '#2a7a1a'], 90, 11) });
  },
  giftwolke(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, arc: 80, spin: 6, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.rot); g.fillStyle = '#58b848'; g.beginPath(); g.arc(0, 4, 11, 0, TAU); g.fill(); g.fillStyle = '#a6ff4d'; g.fillRect(-4, -12, 8, 8); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-4, 1, 3, 0, TAU); g.fill(); }, trail: trail(POISON, 40, 8) });
  },
  schutzwall(fx, c) {
    fx.ring(c.feet.x, c.feet.y, '#6aa8ff', c.pos.s * 1.7, 0.7, 6, 0.3);
    for (let k = 0; k < 7; k++) fx.later(k * 40, () => { const a = -Math.PI + (k / 6) * Math.PI; fx.burst(c.c.x + Math.cos(a) * c.pos.s * 1.2, c.c.y + 0.4 * c.pos.s - Math.sin(-a) * c.pos.s * 0.2, { n: 6, pal: ['#ffffff', '#9cc8ff', '#4a88e0'], speed: 80, size: 8, life: 0.7, ay: -120 }); });
    fx.light(c.c.x, c.c.y, 200, '#4a88e0', 0.6, 0.6);
  },
  lichtkreuz(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.ang + Math.PI / 2); glow(g, 0, 0, 34, '#fff2a8', 0.7); g.globalAlpha = 1; g.fillStyle = '#fffbe0'; g.fillRect(-3, -17, 6, 34); g.fillRect(-12, -6, 24, 6); }, trail: trail(GOLD, 70, 8, { extra: { shape: 'star4' } }) });
  },
  eisstoss(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.ang); glow(g, -4, 0, 40, '#7fd8ff', 0.5); g.globalAlpha = 1; const gr = g.createLinearGradient(-30, 0, 34, 0); gr.addColorStop(0, '#3fa0e0'); gr.addColorStop(1, '#ffffff'); g.fillStyle = gr; g.beginPath(); g.moveTo(38, 0); g.lineTo(-24, -9); g.lineTo(-30, 0); g.lineTo(-24, 9); g.closePath(); g.fill(); }, trail: trail(ICE, 100, 9, { extra: { shape: 'soft', a: 0.6 } }) });
  },
  zeitsand(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, spin: 5, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.rot); glow(g, 0, 0, 30, '#ffcf6b', 0.55); g.globalAlpha = 1; g.fillStyle = '#ffe9a8'; g.beginPath(); g.moveTo(-10, -14); g.lineTo(10, -14); g.lineTo(0, 0); g.lineTo(10, 14); g.lineTo(-10, 14); g.lineTo(0, 0); g.closePath(); g.fill(); g.strokeStyle = '#a8742a'; g.lineWidth = 2; g.stroke(); }, trail: trail(GOLD, 80, 5, { extra: { ay: 120 } }) });
  },
  spiegel(fx, c) {
    fx.ring(c.c.x, c.c.y, '#ffffff', c.pos.s * 1.6, 0.6, 5); fx.light(c.c.x, c.c.y, 150, '#e8eeff', 0.5, 0.7);
    fx.burst(c.c.x, c.c.y, { n: 22, col: '#ffffff', speed: 220, size: 6, life: 0.6, shape: 'star4' });
  },

  herzkraft(fx, c) {
    healAura(fx, c, '#ff6fa5', 16, '♥');
    fx.ent(0.9, (g, e, k) => { g.globalAlpha = (1 - k) * 0.9; g.font = `${Math.round(c.pos.s * (1.2 + k))}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff6fa5'; g.shadowColor = '#ff6fa5'; g.shadowBlur = 24; g.fillText('♥', c.c.x, c.c.y - k * 40); });
  },
  pentagramm(fx, c) {
    const f = c.tfeet, R = c.tpos.s * 1.5;
    fx.ent(c.dur + 0.5, (g, e, k) => {
      const prog = clamp((1 - e.life / e.max) * (c.dur + 0.5) / c.dur), a = 0.4 + 0.6 * prog;
      g.translate(f.x, f.y); g.scale(1, 0.3); g.rotate(prog * 2.2); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba('#c05cff', a); g.shadowColor = '#c05cff'; g.shadowBlur = 20; g.lineWidth = 4; g.lineJoin = 'round';
      const r = R * easeOut(Math.min(1, prog * 1.2));
      g.beginPath(); [0, 2, 4, 1, 3, 0].forEach((v, j) => { const an = -Math.PI / 2 + v * TAU / 5; g[j ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); }); g.stroke();
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    }, 0);
    fx.light(f.x, f.y, 140, '#c05cff', c.dur, 0.35);
  },
  himmelstor(fx, c) {
    fx.ent(0.9, (g, e, k) => { const a = Math.sin(k * Math.PI), w = c.pos.s * 1.1; const gr = g.createLinearGradient(0, c.feet.y - c.pos.s * 3.2, 0, c.feet.y); gr.addColorStop(0, 'rgba(180,240,255,0)'); gr.addColorStop(1, `rgba(200,245,255,${0.7 * a})`); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(c.feet.x - w, c.feet.y - c.pos.s * 3.2, w * 2, c.pos.s * 3.2); g.strokeStyle = `rgba(255,255,255,${0.9 * a})`; g.lineWidth = 4; g.beginPath(); g.arc(c.feet.x, c.feet.y - c.pos.s * 1.2, w, Math.PI, 0); g.lineTo(c.feet.x + w, c.feet.y); g.moveTo(c.feet.x - w, c.feet.y - c.pos.s * 1.2); g.lineTo(c.feet.x - w, c.feet.y); g.stroke(); }, 1);
    fx.burst(c.c.x, c.c.y, { n: 24, pal: ['#ffffff', '#9fe6ff'], speed: 120, size: 7, life: 1.0, ay: -60, shape: 'star4' });
    fx.light(c.c.x, c.c.y, 220, '#9fe6ff', 0.7, 0.6);
  },
  fackel(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, arc: 60, spin: 9, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.rot); g.fillStyle = '#6b4222'; g.fillRect(-16, -3, 24, 6); glow(g, 12, 0, 26, '#ff9a3f', 0.8); g.globalAlpha = 1; }, trail: trail(FIRE, 100, 12, { smoke: true, up: -30 }) });
  },
  zeitriss(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, spin: 8, draw: (g, pr) => { g.translate(pr.x, pr.y); g.rotate(pr.rot); glow(g, 0, 0, 30, '#8c9bff', 0.7); g.globalAlpha = 1; g.strokeStyle = '#e8ecff'; g.lineWidth = 3; g.beginPath(); for (let t = 0; t <= TAU; t += 0.2) g[t ? 'lineTo' : 'moveTo'](Math.sin(t) * 14, Math.sin(t) * Math.cos(t) * 22); g.stroke(); }, trail: trail(['#ffffff', '#8c9bff', '#4a50c0'], 80, 8) });
  },
  seelenraub(fx, c) {
    fx.launch(c.from, c.to, c.dur, { key: c.key, wob: 24, draw: (g, pr) => { glow(g, pr.x, pr.y, 36, '#e04dff', 0.7); glow(g, pr.x, pr.y, 20, '#ff9af0', 0.9); g.globalAlpha = 1; g.fillStyle = '#2a0838'; g.beginPath(); g.arc(pr.x, pr.y, 9, 0, TAU); g.fill(); g.fillStyle = '#ffd0ff'; g.beginPath(); g.arc(pr.x - 3, pr.y - 2, 2, 0, TAU); g.arc(pr.x + 3, pr.y - 2, 2, 0, TAU); g.fill(); }, trail: trail(['#ffd0ff', '#e04dff', '#7a1a9a'], 90, 10) });
  },
  schwarzesloch(fx, c) {
    const f = c.tfeet;
    fx.launch(c.from, c.to, c.dur, { key: c.key, ease: easeInOut, draw: (g, pr) => { const R = 10 + pr.t * 26; glow(g, pr.x, pr.y, R * 2.6, '#8a5cff', 0.55); g.globalAlpha = 1; g.fillStyle = '#05000d'; g.beginPath(); g.arc(pr.x, pr.y, R, 0, TAU); g.fill(); g.strokeStyle = '#c9a8ff'; g.lineWidth = 3; g.beginPath(); g.ellipse(pr.x, pr.y, R * 1.7, R * 0.5, pr.t * 8, 0, TAU); g.stroke(); }, trail: trail(['#c9a8ff', '#6a2ad0'], 60, 8), onEnd: () => {} });
    fx.ent(c.dur, (g, e, k) => { g.globalCompositeOperation = 'lighter'; for (let n = 0; n < 14; n++) { const a = (n / 14) * TAU + k * 8, r = (1 - k) * c.tpos.s * 2.2 * (0.4 + (n % 3) * 0.3); const x = c.to.x + Math.cos(a) * r, y = c.to.y + Math.sin(a) * r * 0.7; glow(g, x, y, 7, '#b08aff', 0.4 + k * 0.5); } g.globalAlpha = 1; }, 1);
  },
  labyrinth(fx, c) {
    const f = c.tfeet, R = c.tpos.s * 1.3;
    fx.ent(c.dur + 0.4, (g, e) => { const prog = clamp((1 - e.life / e.max) * (c.dur + 0.4) / c.dur); g.translate(f.x, f.y); g.scale(1, 0.3); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#ffd35c', 0.3 + 0.7 * prog); g.shadowColor = '#ffd35c'; g.shadowBlur = 16; g.lineWidth = 4; g.lineJoin = 'round';
      const m = [[0, 0], [1, 0], [1, 1], [0.12, 1], [0.12, 0.14], [0.78, 0.14], [0.78, 0.82], [0.3, 0.82], [0.3, 0.38], [0.58, 0.38]];
      const n = Math.max(2, Math.ceil(m.length * prog)); g.beginPath(); m.slice(0, n).forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo']((x - 0.5) * R * 2, (y - 0.5) * R * 2)); g.stroke(); }, 0);
    fx.launch(c.from, c.to, c.dur, { key: c.key, draw: orbDraw(GOLD, 11), trail: trail(GOLD, 60, 7) });
  },
  donnerschlag(fx, c) {
    const top = { x: c.to.x, y: c.to.y - c.tpos.s * 3.4 };
    fx.ent(1.6, (g, e, k) => { const a = Math.sin(clamp(k * 1.2) * Math.PI) * 0.8; for (let n = 0; n < 7; n++) { g.globalAlpha = a; g.drawImage(softSprite(n % 2 ? '#2a2a4a' : '#4a4a70'), top.x - 90 + n * 30, top.y - 20 + Math.sin(n + e.life * 4) * 6, 90, 60); } }, 1);
    fx.light(top.x, top.y, 200, '#aab0ff', 0.8, 0.4);
  },
  weltenfeuer(fx, c) {
    const f = c.tfeet, top = { x: c.to.x - 40, y: -60 };
    fx.ent(c.dur + 0.3, (g, e) => { const prog = clamp((1 - e.life / e.max) * (c.dur + 0.3) / c.dur); g.translate(f.x, f.y); g.scale(1, 0.3); g.fillStyle = `rgba(255,60,20,${0.15 + 0.3 * prog})`; g.beginPath(); g.arc(0, 0, c.tpos.s * (0.6 + prog) * 1.3, 0, TAU); g.fill(); g.strokeStyle = `rgba(255,150,60,${0.4 + 0.5 * prog})`; g.lineWidth = 3; g.stroke(); }, 0);
    fx.launch(top, { x: c.to.x, y: c.to.y + 10 }, c.dur, { key: c.key, ease: (k) => k * k, draw: (g, pr) => { const R = 30 + pr.t * 26; glow(g, pr.x, pr.y, R * 3, '#ff6a1a', 0.55); glow(g, pr.x, pr.y, R * 1.6, '#ffb43a', 0.9); glow(g, pr.x, pr.y, R, '#fff6c0', 1); g.globalAlpha = 1; }, trail: trail(FIRE, 140, 22, { smoke: true, up: -10 }) });
    fx.sc.flash('#ff7a2a', 0.18);
  },
  schicksalsklee(fx, c) {
    for (let k = 0; k < 26; k++) fx.p({ x: c.c.x, y: c.c.y, size: rnd(18, 30), life: rnd(1.4, 2.0), col: pick(['#37ffb0', '#fff2a8', '#ffffff']), shape: 'text', glyph: pick(['☘', '✦', '✿']), a: 1, orbit: true, ox: c.c.x, oy: c.c.y, oa: Math.random() * TAU, or: rnd(c.pos.s * 0.5, c.pos.s * 1.4), od: rnd(2, 4) * (Math.random() < 0.5 ? 1 : -1) });
    fx.ring(c.feet.x, c.feet.y, '#37ffb0', c.pos.s * 2.4, 0.9, 8, 0.3); fx.ring(c.c.x, c.c.y, '#fff2a8', c.pos.s * 1.8, 0.7, 6);
    fx.light(c.c.x, c.c.y, 280, '#37ffb0', 0.9, 0.6); fx.sc.flash('#37ffb0', 0.22);
  },
  sternenbluete(fx, c) {
    const f = c.tfeet, R = c.tpos.s * 1.9;
    fx.ent(c.dur + 2.0, (g, e) => { const t = (1 - e.life / e.max) * (c.dur + 2.0), prog = clamp(t / c.dur), a = clamp(e.life * 1.5, 0, 1); g.translate(f.x, f.y); g.scale(1, 0.3); g.rotate(t * 0.6); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#ff8fd8', (0.3 + 0.7 * prog) * a); g.shadowColor = '#ff8fd8'; g.shadowBlur = 18; g.lineWidth = 3.5; g.beginPath(); for (let n = 0; n <= 120; n++) { const th = n / 120 * Math.PI, r = Math.cos(5 * th) * R * easeOut(prog); g[n ? 'lineTo' : 'moveTo'](r * Math.cos(th), r * Math.sin(th)); } g.stroke(); }, 0);
    fx.light(f.x, f.y, 180, '#ff8fd8', c.dur, 0.4);
    fx.sc.flash('#ff8fd8', 0.12);
  },
};

function healAura(fx, c, col, n = 14, glyph = '+') {
  fx.ring(c.feet.x, c.feet.y, col, c.pos.s * 1.5, 0.7, 6, 0.3);
  for (let k = 0; k < n; k++) fx.later(k * 35, () => fx.p({ x: c.c.x + rnd(-0.5, 0.5) * c.pos.s, y: c.feet.y - rnd(0, 0.5) * c.pos.s, vy: rnd(-130, -70), size: rnd(7, 12), life: 1.0, col, a: 0.95, shape: glyph === '+' && k % 3 === 0 ? 'text' : 'glow', glyph, ax: 0 }));
  fx.light(c.c.x, c.c.y, 180, col, 0.6, 0.55);
}

const IMPACTS = {
  pfeilsalve(fx, c) { fx.burst(c.at.x, c.at.y, { n: 8, pal: ['#fff', '#ffcf8a'], speed: 200, size: 5, life: 0.35, shape: 'spark' }); fx.light(c.at.x, c.at.y, 70, '#ffcf8a', 0.2, 0.6); },
  schwaechefluch(fx, c) {
    fx.ring(c.at.x, c.at.y, '#a05cd8', 100, 0.6, 7); fx.burst(c.at.x, c.at.y, { n: 22, pal: ['#f0d8ff', '#a05cd8', '#3a0a6a'], speed: 220, size: 9, life: 0.8, ay: -30 });
    fx.ent(0.9, (g, e, k) => { g.translate(c.at.x, c.at.y - c.pos.s * 0.9); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.sin(k * Math.PI); g.strokeStyle = '#c890ff'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.moveTo(-9, -9); g.lineTo(9, 9); g.moveTo(9, -9); g.lineTo(-9, 9); g.stroke(); });
  },
  glueckswurf(fx, c) { fx.burst(c.at.x, c.at.y, { n: 24, col: '#ff9bf2', speed: 260, size: 8, life: 0.6, shape: 'star4' }); fx.ring(c.at.x, c.at.y, '#ff9bf2', 90, 0.45); fx.light(c.at.x, c.at.y, 150, '#ff9bf2', 0.4, 0.6); },
  meteor(fx, c) {
    fx.sc.flash('#ffe0b0', 0.55); fx.sc.shake(16);
    fx.burst(c.at.x, c.at.y, { n: 80, pal: FIRE, speed: 520, size: 15, life: 1.0, ay: 200 });
    fx.burst(c.at.x, c.at.y, { n: 16, col: '#6a5a4a', speed: 420, size: 10, life: 1.0, shape: 'rock', ay: 700, drag: 0.5 });
    fx.smoke(c.at.x, c.feet.y - 6, 14, '#3a3a48', 40, 1.5); fx.ring(c.feet.x, c.feet.y, '#ff8a1f', 240, 0.8, 11, 0.3); fx.ring(c.at.x, c.at.y, '#ffd23f', 130, 0.5, 8); fx.light(c.at.x, c.at.y, 280, '#ff8a1f', 0.7, 0.9);
  },

  _default(fx, c) { fx.burst(c.at.x, c.at.y, { n: 24, col: c.sp.color, speed: 260, size: 8, life: 0.6 }); fx.ring(c.at.x, c.at.y, c.sp.color, 80, 0.45); fx.light(c.at.x, c.at.y, 140, c.sp.color, 0.4, 0.6); },
  feuerball(fx, c) { fx.burst(c.at.x, c.at.y, { n: 36, pal: FIRE, speed: 300, size: 12, life: 0.7, ay: 160 }); fx.smoke(c.at.x, c.at.y, 6, '#3a3a48', 30, 1.1); fx.ring(c.at.x, c.at.y, '#ff8a1f', 100, 0.45, 7); fx.light(c.at.x, c.at.y, 190, '#ff8a1f', 0.45, 0.8); },
  eissplitter(fx, c) { fx.burst(c.at.x, c.at.y, { n: 18, col: '#c8f4ff', speed: 300, size: 10, life: 0.7, shape: 'shard', ay: 200 }); fx.burst(c.at.x, c.at.y, { n: 12, pal: ICE, speed: 160, size: 6, life: 0.6, shape: 'star4' }); fx.ring(c.at.x, c.at.y, '#8fe3ff', 80, 0.4); fx.light(c.at.x, c.at.y, 150, '#8fe3ff', 0.4, 0.7); },
  windstoss(fx, c) { fx.burst(c.at.x, c.at.y, { n: 22, col: '#e8fbff', speed: 360, size: 6, life: 0.5, shape: 'spark' }); fx.ring(c.at.x, c.at.y, '#e8fbff', 110, 0.4, 8); for (let k = 0; k < 4; k++) fx.p({ x: c.at.x, y: c.at.y + rnd(-20, 20), vx: rnd(-200, 200), vy: rnd(-120, -20), size: 12, col: '#9cd88a', shape: 'text', glyph: '🍃', life: 0.8, a: 1, drag: 1.5 }); },
  klingenhieb(fx, c) { fx.ent(0.3, (g, e, k) => { g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 6 * (1 - k) + 1; g.lineCap = 'round'; const r = 52 * easeOut(k) + 10; g.beginPath(); g.moveTo(c.at.x - r, c.at.y - r * 0.7); g.lineTo(c.at.x + r, c.at.y + r * 0.7); g.stroke(); g.beginPath(); g.moveTo(c.at.x + r, c.at.y - r * 0.7); g.lineTo(c.at.x - r, c.at.y + r * 0.7); g.stroke(); }); fx.burst(c.at.x, c.at.y, { n: 16, pal: ['#ffffff', '#9cc0ff'], speed: 280, size: 5, life: 0.4, shape: 'spark' }); },
  erdbrocken(fx, c) { fx.burst(c.at.x, c.at.y, { n: 10, col: '#8a6a44', speed: 280, size: 9, life: 0.9, shape: 'rock', ay: 600, drag: 0.5 }); fx.smoke(c.at.x, c.feet.y - 6, 10, '#a08a66', 34, 1.2); fx.ring(c.feet.x, c.feet.y, '#c9a06e', 120, 0.5, 6, 0.3); fx.sc.shake(8); },
  funkenschuss(fx, c) { fx.burst(c.at.x, c.at.y, { n: 12, pal: ['#ffffff', '#ffe07a', '#ffb43a'], speed: 220, size: 5, life: 0.4, shape: 'spark' }); fx.light(c.at.x, c.at.y, 90, '#ffe07a', 0.25, 0.6); },
  blitz(fx, c) { fx.burst(c.at.x, c.at.y, { n: 30, pal: ['#ffffff', '#fff08a', '#ffd23f'], speed: 380, size: 7, life: 0.5, shape: 'spark' }); fx.ring(c.feet.x, c.feet.y, '#ffe14d', 120, 0.5, 7, 0.3); fx.sc.flash('#fffbe0', 0.25); },
  schlangenbiss(fx, c) { fx.burst(c.at.x, c.at.y, { n: 24, pal: POISON, speed: 240, size: 9, life: 0.7, ay: 120 }); fx.ring(c.at.x, c.at.y, '#7dff6b', 90, 0.45); },
  giftwolke(fx, c) { for (let k = 0; k < 24; k++) fx.p({ x: c.feet.x + rnd(-1, 1) * c.pos.s * 0.9, y: c.feet.y - rnd(0, 1.6) * c.pos.s, vx: rnd(-20, 20), vy: rnd(-25, 5), size: rnd(18, 30), size1: rnd(34, 50), life: rnd(1.3, 2.0), col: pick(['#8dff4d', '#5fcf2b', '#b86bff']), shape: 'soft', a: 0.5 }); for (let k = 0; k < 4; k++) fx.p({ x: c.at.x + rnd(-30, 30), y: c.at.y, vy: rnd(-50, -20), size: 18, col: '#c8ffa0', shape: 'text', glyph: '☠', life: 1.2, a: 0.9 }); fx.light(c.at.x, c.at.y, 160, '#8dff4d', 0.6, 0.45); },
  lichtkreuz(fx, c) { fx.ent(0.45, (g, e, k) => { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,248,200,${(1 - k) * 0.9})`; const L = 80 * easeOut(k) + 20, w = 10 * (1 - k) + 2; g.fillRect(c.at.x - w / 2, c.at.y - L, w, L * 2); g.fillRect(c.at.x - L * 0.7, c.at.y - w / 2, L * 1.4, w); }); fx.burst(c.at.x, c.at.y, { n: 18, pal: GOLD, speed: 220, size: 8, life: 0.7, shape: 'star4' }); fx.light(c.at.x, c.at.y, 190, '#fff2a8', 0.45, 0.8); },
  eisstoss(fx, c) { for (let k = 0; k < 7; k++) fx.later(k * 30, () => fx.p({ x: c.feet.x + (k - 3) * c.pos.s * 0.28 + rnd(-6, 6), y: c.feet.y + rnd(-4, 4), size: c.pos.s * rnd(0.9, 1.6), life: 1.1, shape: 'crystal', rot: rnd(-0.3, 0.3), a: 1, a1: 0.9, layer: 1 })); fx.burst(c.at.x, c.at.y, { n: 20, pal: ICE, speed: 240, size: 8, life: 0.6, shape: 'shard' }); fx.ring(c.feet.x, c.feet.y, '#8fe3ff', 120, 0.5, 6, 0.3); fx.light(c.at.x, c.at.y, 170, '#7fd8ff', 0.5, 0.7); },
  zeitsand(fx, c) { fx.ent(1.3, (g, e, k) => { const a = Math.sin(k * Math.PI), R = c.pos.s * 1.0; g.translate(c.feet.x, c.feet.y - c.pos.s * 0.2); g.scale(1, 0.35); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,207,107,${a})`; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(k * 14) * R * 0.8, Math.sin(k * 14) * R * 0.8); g.moveTo(0, 0); g.lineTo(Math.cos(k * 3) * R * 0.5, Math.sin(k * 3) * R * 0.5); g.stroke(); }, 0); fx.burst(c.at.x, c.at.y - 40, { n: 24, pal: GOLD, speed: 70, size: 5, life: 1.0, ay: 200 }); fx.light(c.at.x, c.at.y, 150, '#ffcf6b', 0.5, 0.6); },
  fackel(fx, c) { fx.burst(c.at.x, c.at.y, { n: 30, pal: FIRE, speed: 220, size: 11, life: 0.8, ay: -80 }); fx.ring(c.at.x, c.at.y, '#ff9a3f', 90, 0.45); fx.light(c.at.x, c.at.y, 170, '#ff9a3f', 0.5, 0.7); },
  pentagramm(fx, c) { fx.ent(0.6, (g, e, k) => { g.globalCompositeOperation = 'lighter'; const w = c.pos.s * 0.9 * (1 - k * 0.5); const gr = g.createLinearGradient(0, c.feet.y - 480, 0, c.feet.y); gr.addColorStop(0, 'rgba(192,92,255,0)'); gr.addColorStop(1, `rgba(220,160,255,${1 - k})`); g.fillStyle = gr; g.fillRect(c.feet.x - w, c.feet.y - 480, w * 2, 480); }); fx.burst(c.at.x, c.at.y, { n: 40, pal: ARCANE, speed: 380, size: 10, life: 0.8 }); fx.ring(c.feet.x, c.feet.y, '#c05cff', 170, 0.6, 9, 0.3); fx.sc.flash('#c05cff', 0.3); fx.light(c.at.x, c.at.y, 240, '#c05cff', 0.6, 0.8); },
  zeitriss(fx, c) { fx.ent(0.9, (g, e, k) => { const a = Math.sin(k * Math.PI); g.globalCompositeOperation = 'lighter'; g.translate(c.at.x, c.at.y); const h = c.pos.s * 1.4 * a, w = 10 + 16 * a; const gr = g.createLinearGradient(-w, 0, w, 0); gr.addColorStop(0, 'rgba(140,155,255,0)'); gr.addColorStop(0.5, `rgba(240,245,255,${a})`); gr.addColorStop(1, 'rgba(140,155,255,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, TAU); g.fill(); }); fx.ring(c.at.x, c.at.y, '#8c9bff', 130, 0.7, 6); fx.ring(c.at.x, c.at.y, '#e8ecff', 80, 0.5, 4); fx.burst(c.at.x, c.at.y, { n: 24, pal: ['#ffffff', '#8c9bff'], speed: 220, size: 7, life: 0.8, shape: 'star4' }); fx.light(c.at.x, c.at.y, 200, '#8c9bff', 0.6, 0.7); },
  seelenraub(fx, c) { fx.burst(c.at.x, c.at.y, { n: 30, pal: ['#ffd0ff', '#e04dff', '#7a1a9a'], speed: 260, size: 9, life: 0.7 }); fx.ring(c.at.x, c.at.y, '#e04dff', 110, 0.5, 7); fx.light(c.at.x, c.at.y, 200, '#e04dff', 0.5, 0.8); },
  schwarzesloch(fx, c) { fx.burst(c.at.x, c.at.y, { n: 60, pal: ['#ffffff', '#c9a8ff', '#6a2ad0', '#05000d'], speed: 460, size: 12, life: 0.9 }); fx.ring(c.at.x, c.at.y, '#c9a8ff', 220, 0.8, 12); fx.ring(c.at.x, c.at.y, '#6a2ad0', 150, 0.6, 8); fx.sc.flash('#2a0a5a', 0.5); fx.light(c.at.x, c.at.y, 300, '#8a5cff', 0.7, 0.9); fx.sc.shake(16); },
  labyrinth(fx, c) { for (let k = 0; k < 8; k++) fx.later(k * 25, () => fx.p({ x: c.feet.x + Math.cos(k / 8 * TAU) * c.pos.s * 0.8, y: c.feet.y + Math.sin(k / 8 * TAU) * c.pos.s * 0.26, size: c.pos.s * 1.2, life: 1.2, shape: 'crystal', col: '#ffd35c', rot: 0, a: 1, a1: 0.8 })); fx.burst(c.at.x, c.at.y, { n: 24, pal: GOLD, speed: 220, size: 8, life: 0.8, shape: 'star4' }); fx.ring(c.feet.x, c.feet.y, '#ffd35c', 130, 0.6, 7, 0.3); fx.light(c.at.x, c.at.y, 180, '#ffd35c', 0.6, 0.7); },
  donnerschlag(fx, c) {
    const top = { x: c.at.x + rnd(-40, 40), y: -30 };
    fx.bolt(top, { x: c.at.x + rnd(-15, 15), y: c.at.y }, '#fff08a', 0.3, 5, 2);
    fx.burst(c.at.x, c.at.y, { n: 18, pal: ['#ffffff', '#fff08a'], speed: 320, size: 6, life: 0.4, shape: 'spark' }); fx.sc.flash('#fffbe0', 0.2); fx.light(c.at.x, c.at.y, 170, '#fff08a', 0.3, 0.8);
  },
  weltenfeuer(fx, c) { fx.sc.flash('#fff6d0', 0.8); fx.burst(c.at.x, c.at.y, { n: 90, pal: FIRE, speed: 560, size: 16, life: 1.1, ay: 120 }); fx.burst(c.at.x, c.at.y, { n: 30, pal: ['#ffffff', '#ffd23f'], speed: 700, size: 7, life: 0.7, shape: 'spark' }); for (let k = 0; k < 3; k++) fx.later(k * 110, () => fx.ring(c.feet.x, c.feet.y, k % 2 ? '#ffd23f' : '#ff3b3b', 260 + k * 60, 0.8, 12, 0.3)); fx.ring(c.at.x, c.at.y, '#fff6c0', 200, 0.6, 12); fx.smoke(c.at.x, c.at.y, 14, '#3a3a48', 50, 1.8); fx.light(c.at.x, c.at.y, 380, '#ff6a1a', 0.9, 1); fx.sc.shake(26); },
  sternenbluete(fx, c) {
    const x = c.at.x + rnd(-1, 1) * c.pos.s * 1.2, y = c.feet.y - rnd(0, 0.6) * c.pos.s;
    fx.ent(0.22, (g, e, k) => { g.globalCompositeOperation = 'lighter'; const px = lerp(x - 60, x, k), py = lerp(-40, y, k * k); glow(g, px, py, 34, '#ff8fd8', 0.9); glow(g, px, py, 14, '#ffffff', 1); }, 1);
    fx.later(210, () => { fx.burst(x, y, { n: 26, pal: ['#ffffff', '#ff8fd8', '#c04aa0'], speed: 320, size: 9, life: 0.6, shape: 'star4' }); fx.ring(x, y + 6, '#ff8fd8', 90, 0.45, 6, 0.4); fx.light(x, y, 160, '#ff8fd8', 0.35, 0.8); fx.sc.shake(7); });
  },
};
