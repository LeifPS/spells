// Kampf-Szene: Hintergründe (4 Themen), Arena-Boden, Zauberer mit Animationen, Status-Overlays.
import { TAU, clamp, lerp, rnd, pick, easeOut, hexRgb, rgba, mix, lighten, darken, seeded, glowSprite, softSprite, glow, fitCanvas } from './gfx.js';

// ------------------------------------------------------------------ Themen
const THEMES = {
  wald: {
    sky: ['#071530', '#143055', '#2d5a6a', '#4f8a78'], body: '#e8f0ff', bodyGlow: '#9fc8ff', far: '#1a3a4e', mid: '#0f2a36', near: '#08161f',
    floor: ['#4a5a6a', '#2a3644', '#141c28'], rune: '#7fe8ff', amb: 'firefly', ambColor: '#d9ff7a', fog: '#7fb8c8',
  },
  vulkan: {
    sky: ['#160304', '#4a0f08', '#a02a0a', '#e0661a'], body: '#ffd9a0', bodyGlow: '#ff8a3a', far: '#3a0d08', mid: '#240805', near: '#120403',
    floor: ['#5a3a34', '#32201c', '#180d0b'], rune: '#ff8a3a', amb: 'ember', ambColor: '#ffae4a', fog: '#c8501c',
  },
  eis: {
    sky: ['#06142c', '#0f3558', '#2a6f94', '#9fd8ea'], body: '#f4fbff', bodyGlow: '#b8e8ff', far: '#2a5878', mid: '#173d5a', near: '#0b2236',
    floor: ['#8aa8c0', '#4c6a84', '#22364a'], rune: '#b8f0ff', amb: 'snow', ambColor: '#ffffff', fog: '#cfeeff',
  },
  tempel: {
    sky: ['#140828', '#341660', '#7a2f8c', '#d27a9a'], body: '#ffe8c8', bodyGlow: '#ffb0d0', far: '#2c1450', mid: '#1c0c38', near: '#0e061e',
    floor: ['#6a5a7a', '#3a2e50', '#1a1228'], rune: '#ffd36a', amb: 'mote', ambColor: '#ffc8ff', fog: '#b07ad0',
  },
};
export const THEME_NAMES = Object.keys(THEMES);

function ridge(g, w, baseY, amp, rough, seed, fill, step = 8) {
  const r = seeded(seed);
  const ph = [r() * 9, r() * 9, r() * 9];
  g.fillStyle = fill; g.beginPath(); g.moveTo(0, baseY + 400);
  for (let x = 0; x <= w + step; x += step) {
    const y = baseY - amp * (0.55 * Math.sin(x * rough + ph[0]) + 0.3 * Math.sin(x * rough * 2.3 + ph[1]) + 0.15 * Math.sin(x * rough * 5.1 + ph[2]));
    g.lineTo(x, y);
  }
  g.lineTo(w, baseY + 400); g.closePath(); g.fill();
}

function pine(g, x, y, h, color) {
  g.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const t = i / 4, yy = y - h * (0.18 + t * 0.62), ww = h * 0.3 * (1 - t * 0.7);
    g.beginPath(); g.moveTo(x, yy - h * 0.3); g.lineTo(x - ww, yy); g.lineTo(x + ww, yy); g.closePath(); g.fill();
  }
  g.fillRect(x - h * 0.03, y - h * 0.2, h * 0.06, h * 0.2);
}

function renderBackground(name, w, h, dpr) {
  const T = THEMES[name], cv = document.createElement('canvas');
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const rng = seeded(name.length * 977 + 13);

  // Himmel
  const sg = g.createLinearGradient(0, 0, 0, h * 0.68);
  T.sky.forEach((c, i) => sg.addColorStop(i / (T.sky.length - 1), c));
  g.fillStyle = sg; g.fillRect(0, 0, w, h);

  // Sterne
  for (let i = 0; i < 70; i++) { g.globalAlpha = rng() * 0.8; g.fillStyle = '#fff'; g.beginPath(); g.arc(rng() * w, rng() * h * 0.45, rng() * 1.3 + 0.3, 0, TAU); g.fill(); }
  g.globalAlpha = 1;

  // Himmelskörper mit Halo
  const bx = w * (name === 'tempel' ? 0.7 : 0.2), by = h * 0.17, br = Math.min(w, h) * (name === 'vulkan' ? 0.1 : 0.075);
  g.globalCompositeOperation = 'lighter';
  g.drawImage(glowSprite(T.bodyGlow), bx - br * 4, by - br * 4, br * 8, br * 8);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = T.body; g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill();
  g.fillStyle = 'rgba(0,0,0,.12)'; // Krater
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(bx + (rng() - 0.5) * br, by + (rng() - 0.5) * br, br * (0.1 + rng() * 0.15), 0, TAU); g.fill(); }

  // Polarlicht (Eis) / Strahlen (Tempel)
  if (name === 'eis') {
    for (let k = 0; k < 3; k++) {
      const ag = g.createLinearGradient(0, h * 0.05, 0, h * 0.42);
      const c = ['#5affb0', '#7aa8ff', '#ff7ad0'][k];
      ag.addColorStop(0, rgba(c, 0)); ag.addColorStop(0.5, rgba(c, 0.28)); ag.addColorStop(1, rgba(c, 0));
      g.fillStyle = ag; g.beginPath(); g.moveTo(0, h * 0.2 + k * 14);
      for (let x = 0; x <= w; x += 10) g.lineTo(x, h * (0.16 + k * 0.05) + Math.sin(x * 0.012 + k * 2) * h * 0.05);
      for (let x = w; x >= 0; x -= 10) g.lineTo(x, h * (0.34 + k * 0.05) + Math.sin(x * 0.01 + k) * h * 0.04);
      g.closePath(); g.fill();
    }
  }
  if (name === 'tempel') {
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      const x0 = w * (0.1 + k * 0.2), rg = g.createLinearGradient(x0, 0, x0 + 60, h * 0.7);
      rg.addColorStop(0, 'rgba(255,200,255,.20)'); rg.addColorStop(1, 'rgba(255,200,255,0)');
      g.fillStyle = rg; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + 50, 0); g.lineTo(x0 + 190, h * 0.7); g.lineTo(x0 + 60, h * 0.7); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  // ferne Berge / Vulkan
  ridge(g, w, h * 0.5, h * 0.12, 0.011, 11 + name.length, mix(T.far, T.sky[2], 0.35));
  if (name === 'vulkan') {
    const vx = w * 0.72, vy = h * 0.5, vh = h * 0.24;
    g.fillStyle = darken(T.far, 0.2); g.beginPath(); g.moveTo(vx - w * 0.28, vy + 30); g.lineTo(vx - 24, vy - vh); g.lineTo(vx + 24, vy - vh); g.lineTo(vx + w * 0.28, vy + 30); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glowSprite('#ff6a1a'), vx - 90, vy - vh - 70, 180, 140);
    g.strokeStyle = 'rgba(255,110,30,.8)'; g.lineWidth = 3;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(vx + (k - 1) * 12, vy - vh + 4); g.bezierCurveTo(vx + (k - 1) * 40, vy - vh * 0.6, vx + (k - 1) * 70, vy - vh * 0.3, vx + (k - 1) * 110, vy + 10); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
  }
  // Nebel zwischen den Ebenen
  const fg = g.createLinearGradient(0, h * 0.4, 0, h * 0.58);
  fg.addColorStop(0, rgba(T.fog, 0)); fg.addColorStop(1, rgba(T.fog, 0.35));
  g.fillStyle = fg; g.fillRect(0, h * 0.4, w, h * 0.2);

  ridge(g, w, h * 0.56, h * 0.09, 0.017, 31 + name.length, T.mid);

  // Silhouetten je Thema
  if (name === 'wald') for (let i = 0; i < 16; i++) pine(g, rng() * w, h * 0.56 + rng() * h * 0.04, h * (0.12 + rng() * 0.1), i % 2 ? T.mid : T.near);
  if (name === 'eis') for (let i = 0; i < 10; i++) {
    const x = rng() * w, hh = h * (0.08 + rng() * 0.14), ww = hh * 0.22;
    g.fillStyle = mix(T.mid, '#bfe8ff', 0.25 + rng() * 0.2);
    g.beginPath(); g.moveTo(x - ww, h * 0.58); g.lineTo(x - ww * 0.2, h * 0.58 - hh); g.lineTo(x + ww * 0.4, h * 0.58 - hh * 0.7); g.lineTo(x + ww, h * 0.58); g.fill();
  }
  if (name === 'vulkan') for (let i = 0; i < 9; i++) {
    const x = rng() * w, hh = h * (0.06 + rng() * 0.12);
    g.fillStyle = T.near; g.beginPath(); g.moveTo(x - hh * 0.3, h * 0.6); g.lineTo(x - hh * 0.05, h * 0.6 - hh); g.lineTo(x + hh * 0.2, h * 0.6 - hh * 0.6); g.lineTo(x + hh * 0.35, h * 0.6); g.fill();
  }
  if (name === 'tempel') {
    for (let i = 0; i < 6; i++) {
      const x = w * (0.06 + i * 0.17) + rng() * 20, hh = h * (0.16 + rng() * 0.08);
      g.fillStyle = i % 2 ? T.near : T.mid; g.fillRect(x, h * 0.6 - hh, 16, hh);
      g.fillRect(x - 5, h * 0.6 - hh - 6, 26, 8);
      if (rng() > 0.5) { g.beginPath(); g.arc(x + 8, h * 0.6 - hh - 6, 22, Math.PI, 0); g.lineTo(x + 30, h * 0.6 - hh - 6); g.fill(); }
    }
    // schwebende Inseln
    for (let i = 0; i < 3; i++) {
      const x = w * (0.2 + i * 0.3), y = h * (0.28 + (i % 2) * 0.08);
      g.fillStyle = T.mid; g.beginPath(); g.moveTo(x - 40, y); g.quadraticCurveTo(x, y + 36, x + 40, y); g.closePath(); g.fill();
      g.fillStyle = mix(T.mid, '#5a8a58', 0.5); g.fillRect(x - 40, y - 4, 80, 6);
    }
  }

  // Arena-Boden (Ellipse mit Ringen & Runen)
  const fx = w / 2, fy = h * 0.72, rx = w * 0.7, ry = h * 0.34;
  ridge(g, w, h * 0.62, h * 0.02, 0.03, 5, T.near);
  const fgr = g.createRadialGradient(fx, fy - ry * 0.2, ry * 0.1, fx, fy, rx);
  fgr.addColorStop(0, T.floor[0]); fgr.addColorStop(0.6, T.floor[1]); fgr.addColorStop(1, T.floor[2]);
  g.save(); g.beginPath(); g.ellipse(fx, fy, rx, ry, 0, 0, TAU); g.clip();
  g.fillStyle = fgr; g.fillRect(0, 0, w, h);
  // Steinplatten
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1.4;
  for (let k = 1; k <= 5; k++) { g.beginPath(); g.ellipse(fx, fy, rx * k / 5, ry * k / 5, 0, 0, TAU); g.stroke(); }
  for (let a = 0; a < 16; a++) { const an = a / 16 * TAU; g.beginPath(); g.moveTo(fx + Math.cos(an) * rx * 0.2, fy + Math.sin(an) * ry * 0.2); g.lineTo(fx + Math.cos(an) * rx, fy + Math.sin(an) * ry); g.stroke(); }
  // Runen am Ring
  g.fillStyle = rgba(T.rune, 0.5); g.font = `${Math.round(h * 0.04)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ';
  for (let a = 0; a < 16; a++) { const an = (a + 0.5) / 16 * TAU; g.save(); g.translate(fx + Math.cos(an) * rx * 0.92, fy + Math.sin(an) * ry * 0.92); g.scale(1, ry / rx); g.rotate(an + Math.PI / 2); g.fillText(runes[a], 0, 0); g.restore(); }
  // Risse
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) { let x = fx + (rng() - 0.5) * rx * 1.4, y = fy + (rng() - 0.5) * ry * 1.4; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * 26; y += rng() * 14; g.lineTo(x, y); } g.stroke(); }
  g.restore();
  // Rand der Arena (Dicke)
  g.strokeStyle = darken(T.floor[1], 0.35); g.lineWidth = 7; g.beginPath(); g.ellipse(fx, fy, rx, ry, 0, 0.05 * Math.PI, 0.95 * Math.PI); g.stroke();
  g.strokeStyle = rgba(T.rune, 0.45); g.lineWidth = 1.5; g.beginPath(); g.ellipse(fx, fy, rx - 4, ry - 3, 0, 0, TAU); g.stroke();
  return cv;
}

// ------------------------------------------------------------------ Zauberer-Grafik (Einheiten: Füße bei y=0, Höhe ≈ 2.45)
function star5(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

export function drawWizardArt(g, o) {
  const { skin, t = 0, cast = 0, hurt = 0, dead = 0, win = 0, stun = false, orb = '#ffd86b', dodge = 0 } = o;
  const robe = skin.robe, trim = skin.trim;
  const bob = Math.sin(t * 2.1) * 0.02, sway = Math.sin(t * 1.5) * 0.05;
  const armK = clamp(Math.max(cast * 1.5, win));
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (dead > 0) { const k = easeOut(dead); g.translate(-0.25 * k, 0); g.rotate(-1.4 * k); g.translate(0, 0.12 * k); }
  if (dodge > 0) g.translate(-0.25 * Math.sin(dodge * Math.PI), 0);
  if (hurt > 0) g.translate(-0.07 * hurt, 0);

  // Umhang (hinten)
  g.fillStyle = darken(robe, 0.5);
  g.beginPath(); g.moveTo(-0.2, -1.15 + bob); g.bezierCurveTo(-0.5 - sway, -0.8, -0.78 - sway * 1.6, -0.35, -0.7 - sway * 2, 0.0);
  g.lineTo(-0.1, 0); g.closePath(); g.fill();

  // hintere Hand/Ärmel
  g.strokeStyle = darken(robe, 0.25); g.lineWidth = 0.17;
  g.beginPath(); g.moveTo(-0.2, -1.1 + bob); g.lineTo(-0.34, -0.8); g.lineTo(-0.28, -0.62); g.stroke();
  g.fillStyle = '#e8b88c'; g.beginPath(); g.arc(-0.27, -0.58, 0.075, 0, TAU); g.fill();

  // Robe
  const rg = g.createLinearGradient(0, -1.2, 0, 0);
  rg.addColorStop(0, lighten(robe, 0.22)); rg.addColorStop(0.5, robe); rg.addColorStop(1, darken(robe, 0.38));
  g.fillStyle = rg;
  g.beginPath(); g.moveTo(-0.27, -1.16 + bob);
  g.bezierCurveTo(-0.34, -0.8, -0.48, -0.4, -0.57, 0);
  g.quadraticCurveTo(-0.28, 0.06, 0, 0.03); g.quadraticCurveTo(0.3, 0.06, 0.57, 0);
  g.bezierCurveTo(0.48, -0.4, 0.34, -0.8, 0.27, -1.16 + bob);
  g.quadraticCurveTo(0, -1.26 + bob, -0.27, -1.16 + bob); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 0.025;
  for (const [x0, x1] of [[-0.12, -0.24], [0.12, 0.22], [0.0, 0.02], [-0.2, -0.38]]) { g.beginPath(); g.moveTo(x0, -0.95); g.quadraticCurveTo((x0 + x1) / 2, -0.5, x1, 0.0); g.stroke(); }
  // Saum & Mittelborte
  g.fillStyle = trim;
  g.beginPath(); g.moveTo(-0.575, -0.06); g.quadraticCurveTo(-0.28, 0.0, 0, -0.03); g.quadraticCurveTo(0.3, 0.0, 0.575, -0.06); g.lineTo(0.56, 0.0); g.quadraticCurveTo(0.3, 0.06, 0, 0.03); g.quadraticCurveTo(-0.28, 0.06, -0.56, 0); g.closePath(); g.fill();
  g.strokeStyle = trim; g.lineWidth = 0.035;
  g.beginPath(); g.moveTo(0.04, -1.18); g.quadraticCurveTo(0.08, -0.6, 0.03, 0); g.stroke();
  // Gürtel
  g.fillStyle = darken(trim, 0.55); g.beginPath(); g.moveTo(-0.31, -0.72); g.lineTo(0.31, -0.72); g.lineTo(0.34, -0.63); g.lineTo(-0.34, -0.63); g.closePath(); g.fill();
  g.fillStyle = trim; g.fillRect(-0.04, -0.74, 0.1, 0.12);
  // Schulterkragen
  g.fillStyle = darken(robe, 0.15); g.beginPath(); g.ellipse(0, -1.18 + bob, 0.35, 0.1, 0, 0, TAU); g.fill();
  g.strokeStyle = trim; g.lineWidth = 0.03; g.stroke();

  // vordere Hand & Stab
  const hand = { x: lerp(0.5, 0.66, armK), y: lerp(-0.72, -1.08, armK) + bob };
  const tilt = 0.05 + 0.26 * armK + (win > 0 ? -0.2 : 0);
  const sb = { x: hand.x - 0.02, y: hand.y + 0.78 }, st = { x: hand.x + tilt, y: hand.y - 1.1 - 0.12 * armK };
  g.strokeStyle = '#6b4222'; g.lineWidth = 0.085; g.beginPath(); g.moveTo(sb.x, sb.y); g.lineTo(st.x, st.y); g.stroke();
  g.strokeStyle = '#a8703a'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(sb.x + 0.015, sb.y); g.lineTo(st.x + 0.015, st.y); g.stroke();
  // Stabkopf
  g.strokeStyle = trim; g.lineWidth = 0.05; g.beginPath(); g.arc(st.x, st.y - 0.06, 0.11, Math.PI * 0.15, Math.PI * 0.85, true); g.stroke();
  g.globalCompositeOperation = 'lighter';
  const orbR = 0.2 + cast * 0.35 + 0.02 * Math.sin(t * 5);
  glow(g, st.x, st.y - 0.1, orbR * 2.4, orb, 0.55 + cast * 0.4);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.fillStyle = lighten(orb, 0.35); g.beginPath(); g.arc(st.x, st.y - 0.1, 0.095, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(st.x - 0.03, st.y - 0.13, 0.03, 0, TAU); g.fill();
  // Ärmel vorn
  g.strokeStyle = robe; g.lineWidth = 0.18;
  const sh = { x: 0.2, y: -1.1 + bob }, el = { x: lerp(0.4, 0.5, armK), y: lerp(-0.9, -1.12, armK) + bob };
  g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(el.x, el.y); g.lineTo(hand.x - 0.03, hand.y + 0.02); g.stroke();
  g.strokeStyle = trim; g.lineWidth = 0.04; g.beginPath(); g.arc(hand.x - 0.03, hand.y + 0.02, 0.095, 0, TAU); g.stroke();
  g.fillStyle = '#f0c096'; g.beginPath(); g.arc(hand.x, hand.y, 0.08, 0, TAU); g.fill();

  // Kopf
  const hc = { x: 0.05, y: -1.46 + bob * 1.4 };
  const fg = g.createRadialGradient(hc.x + 0.05, hc.y - 0.05, 0.02, hc.x, hc.y, 0.3);
  fg.addColorStop(0, '#fbd8b0'); fg.addColorStop(1, '#d9a070');
  g.fillStyle = fg; g.beginPath(); g.ellipse(hc.x, hc.y, 0.245, 0.27, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,110,110,.22)'; g.beginPath(); g.arc(hc.x + 0.12, hc.y + 0.07, 0.06, 0, TAU); g.fill();
  // Nase
  g.fillStyle = '#e8a07c'; g.beginPath(); g.ellipse(hc.x + 0.245, hc.y + 0.03, 0.07, 0.055, 0.2, 0, TAU); g.fill();
  // Augen
  const ex = [hc.x + 0.02, hc.x + 0.15];
  for (const x of ex) {
    if (hurt > 0.25 || dead > 0) { g.strokeStyle = '#222'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(x - 0.035, hc.y - 0.07); g.lineTo(x + 0.035, hc.y - 0.02); g.moveTo(x + 0.035, hc.y - 0.07); g.lineTo(x - 0.035, hc.y - 0.02); g.stroke(); }
    else if (stun) { g.strokeStyle = '#222'; g.lineWidth = 0.025; g.beginPath(); for (let a = 0; a < 9; a += 0.5) g.lineTo(x + Math.cos(a + t * 6) * 0.01 * a, hc.y - 0.045 + Math.sin(a + t * 6) * 0.01 * a); g.stroke(); }
    else {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, hc.y - 0.04, 0.045, 0.058, 0, 0, TAU); g.fill();
      g.fillStyle = cast > 0.2 ? orb : '#2a2a3a'; g.beginPath(); g.arc(x + 0.015, hc.y - 0.035, 0.028, 0, TAU); g.fill();
    }
  }
  // Brauen
  g.strokeStyle = '#eceaf2'; g.lineWidth = 0.05; g.beginPath();
  g.moveTo(hc.x - 0.04, hc.y - 0.15 + (hurt > 0.25 ? 0.03 : 0)); g.lineTo(hc.x + 0.07, hc.y - 0.13);
  g.moveTo(hc.x + 0.11, hc.y - 0.13); g.lineTo(hc.x + 0.2, hc.y - 0.15 + (cast > 0.2 ? 0.04 : 0)); g.stroke();
  // Bart
  const bg = g.createLinearGradient(0, hc.y, 0, -0.75);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#b4b4c6');
  g.fillStyle = bg; g.beginPath();
  g.moveTo(hc.x - 0.2, hc.y + 0.02);
  g.bezierCurveTo(hc.x - 0.26, hc.y + 0.3, hc.x - 0.08 + sway * 0.4, hc.y + 0.6, hc.x + 0.04 + sway * 0.8, -0.78);
  g.bezierCurveTo(hc.x + 0.16, hc.y + 0.5, hc.x + 0.3, hc.y + 0.3, hc.x + 0.24, hc.y + 0.02);
  g.bezierCurveTo(hc.x + 0.2, hc.y + 0.12, hc.x + 0.1, hc.y + 0.1, hc.x + 0.02, hc.y + 0.13);
  g.bezierCurveTo(hc.x - 0.08, hc.y + 0.1, hc.x - 0.16, hc.y + 0.1, hc.x - 0.2, hc.y + 0.02); g.fill();
  g.strokeStyle = 'rgba(120,120,150,.35)'; g.lineWidth = 0.015;
  for (const dx of [-0.08, 0.02, 0.12]) { g.beginPath(); g.moveTo(hc.x + dx, hc.y + 0.15); g.quadraticCurveTo(hc.x + dx + sway * 0.3, hc.y + 0.35, hc.x + dx * 0.6 + sway * 0.5, hc.y + 0.5); g.stroke(); }
  // Schnurrbart
  g.fillStyle = '#f4f2fa';
  g.beginPath(); g.ellipse(hc.x + 0.14, hc.y + 0.115, 0.11, 0.045, 0.15, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(hc.x - 0.0, hc.y + 0.115, 0.09, 0.04, -0.1, 0, TAU); g.fill();

  // Hut
  const hatY = -1.68 + bob * 1.4, hv = skin.hat | 0;
  const hg = g.createLinearGradient(0, -2.5, 0, hatY);
  hg.addColorStop(0, lighten(robe, 0.12)); hg.addColorStop(1, darken(robe, 0.3));
  const brimRx = hv === 2 ? 0.72 : hv === 1 ? 0.45 : 0.55;
  g.fillStyle = darken(robe, 0.3); g.beginPath(); g.ellipse(0.03, hatY, brimRx, 0.12, -0.04, 0, TAU); g.fill();
  g.fillStyle = hg; g.beginPath();
  if (hv === 0) {
    g.moveTo(-0.32, hatY - 0.02); g.quadraticCurveTo(-0.3, hatY - 0.5, -0.1 + sway * 0.6, hatY - 0.72);
    g.quadraticCurveTo(-0.28 + sway, hatY - 0.82, -0.58 + sway * 1.5, hatY - 0.62);
    g.quadraticCurveTo(-0.1, hatY - 0.55, 0.36, hatY - 0.02);
  } else if (hv === 1) {
    g.moveTo(-0.3, hatY - 0.02); g.lineTo(-0.2, hatY - 1.0 + sway * 0.2); g.quadraticCurveTo(-0.1 + sway * 0.4, hatY - 1.12, 0.05 + sway, hatY - 1.05); g.lineTo(0.3, hatY - 0.02);
  } else {
    g.moveTo(-0.33, hatY - 0.02); g.quadraticCurveTo(-0.2, hatY - 0.45, 0.0, hatY - 0.62); g.quadraticCurveTo(0.16, hatY - 0.7, 0.14 + sway, hatY - 0.58); g.quadraticCurveTo(0.2, hatY - 0.4, 0.35, hatY - 0.02);
  }
  g.closePath(); g.fill();
  g.fillStyle = trim; g.beginPath(); g.moveTo(-0.33, hatY - 0.04); g.quadraticCurveTo(0.03, hatY + 0.03, 0.37, hatY - 0.04); g.lineTo(0.35, hatY - 0.14); g.quadraticCurveTo(0.03, hatY - 0.08, -0.31, hatY - 0.14); g.closePath(); g.fill();
  g.fillStyle = lighten(trim, 0.4); star5(g, 0.03, hatY - 0.085, 0.05);
  g.fillStyle = rgba(trim, 0.8);
  for (const [x, y, r] of [[-0.12, -0.3, 0.025], [0.05, -0.22, 0.02], [-0.22, -0.5, 0.02]]) { g.beginPath(); g.arc(x, hatY + y, r, 0, TAU); g.fill(); }
  if (hv === 2) { g.strokeStyle = '#ff6a8a'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(0.32, hatY - 0.1); g.quadraticCurveTo(0.6, hatY - 0.4, 0.5, hatY - 0.7); g.stroke(); }
  g.restore();
}

// ------------------------------------------------------------------ Szene
export class Scene {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.fx = null;
    this.theme = 'wald';
    this.you = 0;
    this.time = 0;
    this.shakeV = 0; this.flashV = 0; this.flashColor = '#fff';
    this.slow = 1; this.slowT = 0;
    this.lights = [];
    this.pl = [this.newPl(), this.newPl()];
    this.sprites = [document.createElement('canvas'), document.createElement('canvas')];
    this.amb = [];
    this.running = false;
    this.w = 0; this.h = 0; this.dpr = 1; this.bg = null;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  newPl() {
    return { skin: { robe: '#2c6fd1', trim: '#ffd86b', hat: 0 }, name: '', cast: 0, hurt: 0, dead: 0, win: 0, dodge: 0, orb: '#ffd86b', st: {}, emote: null, flash: 0 };
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.w = r.width; this.h = r.height; this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.ctx = fitCanvas(this.cv, this.w, this.h, this.dpr);
    this.bg = renderBackground(this.theme, this.w, this.h, this.dpr);
    this.initAmbient();
  }

  setTheme(name) {
    this.theme = THEMES[name] ? name : 'wald';
    if (this.w) { this.bg = renderBackground(this.theme, this.w, this.h, this.dpr); this.initAmbient(); }
  }

  reset(you, players) {
    this.you = you;
    this.pl = [this.newPl(), this.newPl()];
    players.forEach((p, i) => { this.pl[i].skin = p.skin; this.pl[i].name = p.name; this.pl[i].orb = p.skin.trim; });
    this.lights = []; this.shakeV = 0; this.flashV = 0; this.slow = 1;
  }

  initAmbient() {
    const T = THEMES[this.theme], n = T.amb === 'snow' ? 60 : T.amb === 'ember' ? 40 : 28;
    this.amb = Array.from({ length: n }, () => ({ x: Math.random() * this.w, y: Math.random() * this.h, v: rnd(8, 28), ph: Math.random() * 9, s: rnd(1, 3.2) }));
    this.fog = Array.from({ length: 6 }, (_, i) => ({ x: Math.random() * this.w, y: this.h * (0.42 + i * 0.07), s: rnd(0.8, 1.6), v: rnd(4, 12) * (i % 2 ? 1 : -1) }));
  }

  // ---- Positionen (Zauberer)
  unit() { return clamp(this.h * 0.2, 38, 104); }
  pos(i) {
    const w = this.w, h = this.h, wide = w > h * 1.5, me = i === this.you;
    const u = this.unit();
    if (wide) return me ? { x: w * 0.27, y: h * 0.86, s: u * 1.05 } : { x: w * 0.73, y: h * 0.66, s: u * 0.88 };
    return me ? { x: w * 0.27, y: h * 0.9, s: u * 1.0 } : { x: w * 0.74, y: h * 0.62, s: u * 0.82 };
  }
  chest(i) { const p = this.pos(i); return { x: p.x + 0.05 * p.s, y: p.y - 0.85 * p.s }; }
  head(i) { const p = this.pos(i); return { x: p.x, y: p.y - 1.5 * p.s }; }
  tip(i) {
    const p = this.pos(i), f = i === this.you ? 1 : -1;
    return { x: p.x + f * 0.9 * p.s, y: p.y - 1.75 * p.s };
  }
  feet(i) { const p = this.pos(i); return { x: p.x, y: p.y }; }

  // ---- Auslöser
  trigger(i, what, v = 1) {
    const p = this.pl[i];
    if (what === 'cast') p.cast = 1;
    else if (what === 'hurt') p.hurt = Math.max(p.hurt, v);
    else if (what === 'die') p.dead = 0.001;
    else if (what === 'win') p.win = 1;
    else if (what === 'dodge') p.dodge = 1;
  }
  shake(v) { this.shakeV = Math.max(this.shakeV, v); }
  flash(color, v = 0.4) { this.flashColor = color; this.flashV = Math.max(this.flashV, v); }
  slowmo(f = 0.25, t = 0.14) { this.slow = f; this.slowT = t; }
  light(x, y, r, color, life = 0.4, a = 0.6) { this.lights.push({ x, y, r, color, life, max: life, a }); }
  setStatus(i, s) { this.pl[i].st = s; }

  // ---- Zeitschritt
  update(realDt) {
    if (this.slowT > 0) { this.slowT -= realDt; if (this.slowT <= 0) this.slow = 1; }
    const dt = realDt * this.slow;
    this.time += dt;
    this.shakeV *= Math.pow(0.003, realDt); if (this.shakeV < 0.25) this.shakeV = 0;
    this.flashV = Math.max(0, this.flashV - realDt * 2);
    this.pl.forEach((p, i) => {
      p.cast = Math.max(0, p.cast - dt * 2.2); p.hurt = Math.max(0, p.hurt - dt * 3); p.win = p.win > 0 ? Math.min(1, p.win + dt) : 0;
      p.dodge = Math.max(0, p.dodge - dt * 2.5);
      if (p.dead > 0) p.dead = Math.min(1, p.dead + dt * 1.4);
      if (p.emote) { p.emote.t -= dt; if (p.emote.t <= 0) p.emote = null; }
      // Aura-Partikel je Status
      const s = p.st, c = this.chest(i), pos = this.pos(i);
      if (this.fx && p.dead === 0) {
        if (s.burn > 0 && Math.random() < dt * 22) this.fx.flameAura(c.x + rnd(-0.35, 0.35) * pos.s, pos.y - rnd(0, 1.2) * pos.s, pos.s);
        if (s.poison > 0 && Math.random() < dt * 9) this.fx.bubbleAura(c.x + rnd(-0.35, 0.35) * pos.s, pos.y - rnd(0, 0.6) * pos.s, pos.s);
        if (s.chill > 0 && Math.random() < dt * 10) this.fx.frostAura(c.x + rnd(-0.4, 0.4) * pos.s, pos.y - rnd(0, 1.6) * pos.s, pos.s);
        if (s.haste > 0 && Math.random() < dt * 14) this.fx.hasteAura(c.x, pos.y - rnd(0, 1.4) * pos.s, pos.s, i === this.you ? -1 : 1);
      }
    });
    for (const a of this.amb) {
      const T = THEMES[this.theme];
      if (T.amb === 'snow') { a.y += a.v * dt; a.x += Math.sin(this.time + a.ph) * 10 * dt; if (a.y > this.h) { a.y = -4; a.x = Math.random() * this.w; } }
      else if (T.amb === 'ember') { a.y -= a.v * 1.4 * dt; a.x += Math.sin(this.time * 2 + a.ph) * 14 * dt; if (a.y < -4) { a.y = this.h + 4; a.x = Math.random() * this.w; } }
      else { a.y += Math.sin(this.time * 0.7 + a.ph) * 8 * dt; a.x += Math.cos(this.time * 0.5 + a.ph) * 8 * dt; if (a.x < 0) a.x = this.w; if (a.x > this.w) a.x = 0; }
    }
    for (const f of this.fog) { f.x += f.v * dt; if (f.v > 0 && f.x > this.w + 160) f.x = -160; if (f.v < 0 && f.x < -160) f.x = this.w + 160; }
    this.lights = this.lights.filter((l) => (l.life -= dt) > 0);
    if (this.fx) this.fx.update(dt);
  }

  // ---- Zeichnen
  draw() {
    const g = this.ctx, w = this.w, h = this.h, T = THEMES[this.theme], t = this.time;
    if (!w || !this.bg) return;
    g.save();
    if (this.shakeV) g.translate(rnd(-this.shakeV, this.shakeV), rnd(-this.shakeV, this.shakeV));
    g.drawImage(this.bg, -8, -8, w + 16, h + 16);

    // Nebel & Atmosphäre
    for (const f of this.fog) { g.globalAlpha = 0.16; g.drawImage(softSprite(T.fog), f.x - 120 * f.s, f.y - 34 * f.s, 240 * f.s, 68 * f.s); }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'lighter';
    for (const a of this.amb) {
      if (T.amb === 'snow') { g.globalAlpha = 0.7; g.fillStyle = '#fff'; g.beginPath(); g.arc(a.x, a.y, a.s * 0.6, 0, TAU); g.fill(); }
      else { const tw = 0.5 + 0.5 * Math.sin(t * 2 + a.ph); glow(g, a.x, a.y, a.s * (T.amb === 'ember' ? 4 : 5), T.ambColor, 0.35 + 0.5 * tw); }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

    // Runenkreise unter den Zauberern
    for (let i = 0; i < 2; i++) this.drawSigil(g, i, t);

    if (this.fx) this.fx.drawBack(g);

    // Zauberer (hinterer zuerst)
    const order = [1 - this.you, this.you];
    for (const i of order) this.drawWizard(g, i);

    if (this.fx) this.fx.drawFront(g);

    // Lichter
    g.globalCompositeOperation = 'lighter';
    for (const l of this.lights) glow(g, l.x, l.y, l.r, l.color, l.a * (l.life / l.max));
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

    // Vignette
    const vg = g.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,12,.55)');
    g.fillStyle = vg; g.fillRect(-10, -10, w + 20, h + 20);
    g.restore();
    if (this.flashV > 0) { g.globalAlpha = Math.min(0.7, this.flashV); g.fillStyle = this.flashColor; g.fillRect(0, 0, w, h); g.globalAlpha = 1; }
  }

  drawSigil(g, i, t) {
    const p = this.pos(i), me = i === this.you, T = THEMES[this.theme];
    const col = this.pl[i].orb || T.rune, pulse = 0.55 + 0.25 * Math.sin(t * 2 + i) + this.pl[i].cast * 0.6;
    g.save(); g.translate(p.x, p.y + 0.02 * p.s); g.scale(1, 0.3);
    const R = p.s * 1.25;
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(col, 0.55 * pulse); g.lineWidth = 2.2;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
    g.setLineDash([R * 0.12, R * 0.09]); g.lineDashOffset = -t * 20 * (me ? 1 : -1);
    g.strokeStyle = rgba(col, 0.4 * pulse); g.beginPath(); g.arc(0, 0, R * 0.82, 0, TAU); g.stroke(); g.setLineDash([]);
    g.rotate(t * 0.3 * (me ? 1 : -1));
    g.strokeStyle = rgba(col, 0.35 * pulse); g.lineWidth = 1.6;
    g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 5 * 2 - Math.PI / 2, x = Math.cos(a) * R * 0.66, y = Math.sin(a) * R * 0.66; g[k ? 'lineTo' : 'moveTo'](x, y); } g.closePath(); g.stroke();
    g.globalCompositeOperation = 'source-over';
    g.restore();
    const rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(p.x, p.y); g.scale(1, 0.3);
    rg.addColorStop(0, rgba(col, 0.0)); g.fillStyle = g.createRadialGradient(0, 0, 0, 0, 0, R);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, rgba(col, 0.28 * pulse)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.restore();
  }

  drawWizard(g, i) {
    const P = this.pl[i], pos = this.pos(i), s = pos.s, dpr = this.dpr;
    const W = Math.ceil(3.4 * s), H = Math.ceil(3.3 * s);
    const spr = this.sprites[i];
    if (spr.width !== Math.round(W * dpr)) { spr.width = Math.round(W * dpr); spr.height = Math.round(H * dpr); }
    const sg = spr.getContext('2d');
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, spr.width, spr.height);
    sg.setTransform(dpr * s, 0, 0, dpr * s, dpr * W / 2, dpr * H * 0.88);
    drawWizardArt(sg, { skin: P.skin, t: this.time + i * 1.7, cast: P.cast, hurt: P.hurt, dead: P.dead, win: P.win, stun: P.st.stun > 0, orb: P.orb, dodge: P.dodge });
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'source-atop';
    if (P.hurt > 0) { sg.fillStyle = `rgba(255,70,70,${0.55 * P.hurt})`; sg.fillRect(0, 0, spr.width, spr.height); }
    if (P.st.chill > 0) { sg.fillStyle = 'rgba(120,200,255,.32)'; sg.fillRect(0, 0, spr.width, spr.height); }
    if (P.st.poison > 0) { sg.fillStyle = 'rgba(110,255,90,.16)'; sg.fillRect(0, 0, spr.width, spr.height); }
    if (P.st.burn > 0) { sg.fillStyle = `rgba(255,120,40,${0.12 + 0.08 * Math.sin(this.time * 12)})`; sg.fillRect(0, 0, spr.width, spr.height); }
    sg.globalCompositeOperation = 'source-over';

    g.save();
    g.translate(pos.x, pos.y);
    // Schatten
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(0, 0.04 * s, 0.7 * s, 0.17 * s, 0, 0, TAU); g.fill();
    if (i !== this.you) g.scale(-1, 1);
    if (P.st.phase > 0) g.globalAlpha = 0.42;
    if (P.st.haste > 0) { g.globalAlpha *= 0.3; g.drawImage(spr, -W / 2 - 0.22 * s, -H * 0.88, W, H); g.globalAlpha = P.st.phase > 0 ? 0.42 : 1; }
    g.drawImage(spr, -W / 2, -H * 0.88, W, H);
    g.restore();

    const hc = this.head(i), c = this.chest(i), t = this.time;
    // Schild
    const sh = P.st.shield || 0;
    if (sh > 0 && P.dead === 0) {
      const flick = P.st.shT > 0 && P.st.shT < 1.5 ? 0.6 + 0.4 * Math.sin(t * 22) : 1;
      const R = s * 1.45, a = clamp(0.35 + sh / 120, 0.35, 0.9) * flick;
      g.save(); g.translate(c.x, c.y - 0.1 * s);
      const rg = g.createRadialGradient(0, 0, R * 0.55, 0, 0, R);
      rg.addColorStop(0, 'rgba(110,170,255,0)'); rg.addColorStop(0.8, `rgba(110,170,255,${0.22 * a})`); rg.addColorStop(1, `rgba(190,225,255,${0.7 * a})`);
      g.fillStyle = rg; g.beginPath(); g.ellipse(0, 0, R * 0.9, R, 0, 0, TAU); g.fill();
      g.strokeStyle = `rgba(210,235,255,${0.8 * a})`; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, R * 0.9, R, 0, 0, TAU); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${0.7 * a})`; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, R * 0.8, R * 0.9, 0, -2.4 + Math.sin(t) * 0.3, -1.6 + Math.sin(t) * 0.3); g.stroke();
      g.restore();
    }
    // Spiegel
    if (P.st.reflect > 0 && P.dead === 0) {
      g.save(); g.translate(c.x + (i === this.you ? 0.55 : -0.55) * s, c.y); g.globalCompositeOperation = 'lighter';
      const R = s * 0.95;
      g.strokeStyle = 'rgba(235,240,255,.85)'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, R * 0.55, R, 0, 0, TAU); g.stroke();
      const mg = g.createLinearGradient(-R * 0.5, -R, R * 0.5, R); mg.addColorStop(0, 'rgba(200,215,255,.05)'); mg.addColorStop(0.5, 'rgba(255,255,255,.35)'); mg.addColorStop(1, 'rgba(200,215,255,.05)');
      g.fillStyle = mg; g.beginPath(); g.ellipse(0, 0, R * 0.55, R, 0, 0, TAU); g.fill();
      glow(g, Math.sin(t * 3) * R * 0.2, -R * 0.4 + Math.cos(t * 2) * R * 0.2, 14, '#ffffff', 0.7);
      g.restore(); g.globalAlpha = 1;
    }
    // Betäubung: kreisende Sterne
    if (P.st.stun > 0 && P.dead === 0) {
      g.save(); g.fillStyle = '#ffe14d'; g.shadowColor = '#ffe14d'; g.shadowBlur = 8;
      for (let k = 0; k < 3; k++) { const a = t * 4 + k * TAU / 3; this.star(g, hc.x + Math.cos(a) * 0.5 * s, hc.y - 0.62 * s + Math.sin(a) * 0.12 * s, 0.1 * s); }
      g.restore();
    }
    // Emote
    if (P.emote) {
      const e = P.emote, k = clamp(e.t / 0.3), pop = e.t > 1.7 ? easeOut((2 - e.t) / 0.3) : 1;
      g.save(); g.translate(hc.x + 0.1 * s, hc.y - 1.05 * s); g.scale(pop, pop); g.globalAlpha = k;
      g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5;
      const bw = 0.95 * s, bh = 0.8 * s;
      g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, bh * 0.3); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-0.1 * s, bh / 2 - 1); g.lineTo(0, bh / 2 + 0.18 * s); g.lineTo(0.12 * s, bh / 2 - 1); g.fill();
      g.font = `${Math.round(0.55 * s)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(e.glyph, 0, 0);
      g.restore();
    }
  }

  star(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }

  start() {
    if (this.running) return;
    this.running = true;
    let prev = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      this.update(dt); this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop() { this.running = false; }
}

/** Kleines Porträt (Kopf) für die HUD-Leiste */
export function drawAvatar(cv, skin, size = 56) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = cv.height = Math.round(size * dpr);
  const g = cv.getContext('2d');
  const k = size * dpr / 1.5;
  g.setTransform(k, 0, 0, k, size * dpr * 0.36, size * dpr * 1.62);
  drawWizardArt(g, { skin, t: 0, orb: skin.trim });
}
