// Synthese-Sound: keine Dateien nötig. Effekte pro Element + sanfte Hintergrundmusik.
let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
let muted = false, volume = 0.7, musicOn = true, musicTimer = null, musicStep = 0, musicMode = 'menu';

function init() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : volume; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(comp);
    musBus = ctx.createGain(); musBus.gain.value = 0.22; musBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}
export function unlock() { const c = init(); if (c && c.state === 'suspended') c.resume(); loadSamples(); ensureMusic(); }
if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, unlock, { passive: true });

const ok = () => ctx && ctx.state !== 'closed' && !muted;

// ------------------------------------------------------------ Samples (ElevenLabs-Dateien, optional)
// public/audio/manifest.json: { "cast_fire": "cast_fire.mp3", "music_battle": { "file": "x.mp3", "gain": 0.8 }, ... }
// Fehlt ein Eintrag oder die Datei, spielt automatisch der eingebaute Synth.
const bufs = {}, gains = {}; let manifest = null, loadStarted = false;
async function loadSamples() {
  if (loadStarted || !ctx) return; loadStarted = true;
  try {
    const r = await fetch('audio/manifest.json', { cache: 'no-cache' }); if (!r.ok) return;
    manifest = await r.json();
  } catch { return; }
  await Promise.all(Object.entries(manifest).map(async ([key, v]) => {
    try {
      const file = typeof v === 'string' ? v : v.file; gains[key] = typeof v === 'object' && v.gain ? v.gain : 1;
      const res = await fetch('audio/' + file); if (!res.ok) return;
      const arr = await res.arrayBuffer();
      bufs[key] = await new Promise((ok2, bad) => ctx.decodeAudioData(arr, ok2, bad));
    } catch { /* Datei kaputt -> Synth */ }
  }));
  ensureMusic();
}
export const hasSample = (k) => !!bufs[k];
function S(key, { vol = 1, rate = 1, vary = 0.04, bus = null } = {}) {
  const b = bufs[key]; if (!b || !ok()) return false;
  const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
  const g = ctx.createGain(); g.gain.value = vol * (gains[key] || 1); src.connect(g); g.connect(bus || sfxBus); src.start();
  return true;
}
// Musik aus Samples (Schleife mit weichen Übergängen)
let cur = null, wantMode = null;
function ensureMusic() {
  if (!ctx || !musicOn || muted) { stopSampleMusic(); return; }
  if (!wantMode) { stopSampleMusic(); return; }
  const key = 'music_' + wantMode, b = bufs[key];
  if (!b) { stopSampleMusic(); return; }
  if (cur && cur.key === key) return;
  stopSampleMusic();
  const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
  const g = ctx.createGain(); g.gain.value = 0.0001; src.connect(g); g.connect(musBusS());
  g.gain.linearRampToValueAtTime((gains[key] || 1), ctx.currentTime + 1.6);
  src.start(); cur = { key, src, g };
}
function stopSampleMusic() {
  if (!cur || !ctx) { cur = null; return; }
  const c = cur; cur = null;
  try { c.g.gain.cancelScheduledValues(ctx.currentTime); c.g.gain.setValueAtTime(c.g.gain.value, ctx.currentTime); c.g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.0); c.src.stop(ctx.currentTime + 1.1); } catch {}
}
let musBusSample = null;
function musBusS() { if (!musBusSample) { musBusSample = ctx.createGain(); musBusSample.gain.value = 0.55; musBusSample.connect(master); } return musBusSample; }
function env(g, t, a, d, peak, end = 0.0001) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }

function tone({ f = 440, f2 = null, type = 'sine', t0 = 0, a = 0.005, d = 0.2, v = 0.2, bus = sfxBus, detune = 0, pan = 0 } = {}) {
  if (!ok()) return;
  const t = ctx.currentTime + t0, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + a + d); o.detune.value = detune;
  env(g, t, a, d, v);
  let n = o; n.connect(g);
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(bus); } else g.connect(bus);
  o.start(t); o.stop(t + a + d + 0.05);
}
function noise({ t0 = 0, a = 0.005, d = 0.3, v = 0.2, f = 1200, f2 = null, q = 1, type = 'bandpass', bus = sfxBus } = {}) {
  if (!ok()) return;
  const t = ctx.currentTime + t0, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + a + d);
  env(g, t, a, d, v); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.05);
}

const FAM = {
  feuerball: 'fire', fackel: 'fire', weltenfeuer: 'fire', funkenschuss: 'spark',
  eissplitter: 'ice', eisstoss: 'ice',
  windstoss: 'wind', klingenhieb: 'blade',
  heilfunke: 'heal', herzkraft: 'heal', himmelstor: 'heal', schicksalsklee: 'heal', manaquelle: 'mana',
  erdbrocken: 'earth', blitz: 'bolt', donnerschlag: 'bolt',
  schlangenbiss: 'poison', giftwolke: 'poison',
  schutzwall: 'shield', spiegel: 'shield', lichtkreuz: 'holy',
  zeitsand: 'time', zeitriss: 'time',
  steinwall: 'earth', pfeilsalve: 'blade', schwaechefluch: 'dark', schattenschritt: 'wind', heilquelle: 'heal', glueckswurf: 'arcane', meteor: 'fire', phoenixnest: 'holy',
  pentagramm: 'dark', seelenraub: 'dark', schwarzesloch: 'dark', labyrinth: 'arcane', sternenbluete: 'arcane',
};

export const sfx = {
  cast(id) {
    if (!ok()) return;
    const fam = FAM[id] || 'arcane';
    if (S('cast_' + fam, { vol: 0.9 })) return;
    switch (fam) {
      case 'fire': noise({ d: 0.5, v: 0.28, f: 500, f2: 1800, q: 0.7 }); tone({ f: 150, f2: 70, type: 'sawtooth', d: 0.4, v: 0.12 }); break;
      case 'spark': noise({ d: 0.12, v: 0.2, f: 3000, q: 2 }); tone({ f: 900, f2: 1600, type: 'square', d: 0.1, v: 0.06 }); break;
      case 'ice': [1320, 1760, 2093].forEach((f, k) => tone({ f, type: 'triangle', t0: k * 0.045, d: 0.25, v: 0.1 })); noise({ d: 0.3, v: 0.08, f: 6000, type: 'highpass' }); break;
      case 'wind': noise({ a: 0.12, d: 0.45, v: 0.28, f: 400, f2: 1800, q: 1.2 }); break;
      case 'blade': noise({ d: 0.18, v: 0.25, f: 2500, f2: 7000, q: 2 }); tone({ f: 2000, f2: 900, type: 'sawtooth', d: 0.12, v: 0.05 }); break;
      case 'heal': [523, 659, 784, 1047].forEach((f, k) => tone({ f, type: 'sine', t0: k * 0.07, d: 0.45, v: 0.13 })); break;
      case 'mana': [392, 523, 659].forEach((f, k) => tone({ f, type: 'sine', t0: k * 0.08, d: 0.5, v: 0.12 })); tone({ f: 100, f2: 200, d: 0.5, v: 0.1 }); break;
      case 'earth': tone({ f: 110, f2: 45, type: 'sine', d: 0.35, v: 0.35 }); noise({ d: 0.3, v: 0.2, f: 300, q: 0.6 }); break;
      case 'bolt': noise({ d: 0.35, v: 0.4, f: 4000, f2: 300, q: 0.6, type: 'lowpass' }); tone({ f: 80, f2: 40, type: 'sawtooth', d: 0.5, v: 0.22 }); break;
      case 'poison': tone({ f: 260, f2: 120, type: 'sawtooth', d: 0.35, v: 0.1 }); noise({ d: 0.35, v: 0.14, f: 900, f2: 300, q: 4 }); break;
      case 'shield': tone({ f: 330, f2: 660, type: 'triangle', d: 0.4, v: 0.16 }); tone({ f: 495, f2: 990, type: 'sine', d: 0.4, v: 0.1 }); break;
      case 'holy': [784, 988, 1175].forEach((f, k) => tone({ f, type: 'sine', t0: k * 0.05, d: 0.6, v: 0.12 })); break;
      case 'time': tone({ f: 600, f2: 150, type: 'sine', d: 0.5, v: 0.14 }); [0, 0.12, 0.24].forEach((t0) => tone({ f: 1500, type: 'square', t0, d: 0.03, v: 0.06 })); break;
      case 'dark': tone({ f: 200, f2: 50, type: 'sawtooth', d: 0.8, v: 0.2 }); noise({ d: 0.8, v: 0.14, f: 200, f2: 900, q: 3 }); break;
      default: [440, 554, 659, 880].forEach((f, k) => tone({ f, type: 'triangle', t0: k * 0.05, d: 0.4, v: 0.1 })); tone({ f: 110, d: 0.5, v: 0.12 });
    }
  },
  hit(amount = 10) {
    if (!ok()) return;
    if (S(amount >= 60 ? 'hit_huge' : amount >= 30 ? 'hit_heavy' : 'hit_light', { vol: 0.9 })) return;
    const big = Math.min(1, amount / 60);
    tone({ f: 170 - big * 60, f2: 50, type: 'sine', d: 0.2 + big * 0.2, v: 0.28 + big * 0.2 });
    noise({ d: 0.12 + big * 0.2, v: 0.2 + big * 0.2, f: 1200 - big * 700, f2: 200, q: 0.8 });
    if (big > 0.6) tone({ f: 60, f2: 30, d: 0.7, v: 0.3, t0: 0.02 });
  },
  block() { if (S('block')) return; tone({ f: 800, f2: 400, type: 'square', d: 0.12, v: 0.1 }); noise({ d: 0.1, v: 0.12, f: 3000, q: 3 }); },
  reflect() { if (S('reflect')) return; tone({ f: 1200, f2: 2400, type: 'triangle', d: 0.25, v: 0.15 }); tone({ f: 2400, f2: 800, type: 'sine', t0: 0.1, d: 0.3, v: 0.1 }); },
  shield() { if (S('shield_up')) return; tone({ f: 440, f2: 880, type: 'triangle', d: 0.3, v: 0.12 }); },
  fizzle() { if (S('fizzle')) return; tone({ f: 260, f2: 90, type: 'sawtooth', d: 0.22, v: 0.1 }); noise({ d: 0.15, v: 0.06, f: 800, q: 1 }); },
  strokeStart() { tone({ f: 600, f2: 700, type: 'sine', d: 0.05, v: 0.04 }); },
  recognized(rarityIdx = 0) { [0, 1, 2].slice(0, 2 + (rarityIdx > 1 ? 1 : 0)).forEach((k) => tone({ f: 660 * Math.pow(1.25, k), type: 'triangle', t0: k * 0.05, d: 0.18, v: 0.1 })); },
  click() { if (S('click', { vary: 0.06 })) return; tone({ f: 520, f2: 420, type: 'triangle', d: 0.07, v: 0.1 }); },
  back() { if (S('back')) return; tone({ f: 420, f2: 320, type: 'triangle', d: 0.08, v: 0.09 }); },
  good() { if (S('good')) return; [523, 659, 784].forEach((f, k) => tone({ f, type: 'triangle', t0: k * 0.07, d: 0.25, v: 0.12 })); },
  bad() { if (S('bad')) return; tone({ f: 200, f2: 120, type: 'sawtooth', d: 0.25, v: 0.1 }); },
  tick() { if (S('tick')) return; tone({ f: 880, type: 'sine', d: 0.07, v: 0.1 }); },
  countdown(n) { if (S(n > 0 ? 'count' : 'go')) return; tone({ f: n > 0 ? 440 : 880, type: 'triangle', d: n > 0 ? 0.18 : 0.45, v: 0.18 }); },
  coin() { if (S('coin', { vary: 0.08 })) return; tone({ f: 1318, type: 'square', d: 0.08, v: 0.06 }); tone({ f: 1760, type: 'square', t0: 0.07, d: 0.18, v: 0.06 }); },
  win() { if (S('win', { vary: 0 })) return; [523, 659, 784, 1047, 1319].forEach((f, k) => tone({ f, type: 'triangle', t0: k * 0.11, d: 0.5, v: 0.14 })); tone({ f: 130, d: 1.0, v: 0.12, type: 'sine' }); },
  lose() { if (S('lose', { vary: 0 })) return; [392, 349, 311, 262].forEach((f, k) => tone({ f, type: 'sawtooth', t0: k * 0.18, d: 0.5, v: 0.08 })); },
  levelUp() { if (S('levelup', { vary: 0 })) return; [392, 494, 587, 784, 988, 1175].forEach((f, k) => tone({ f, type: 'triangle', t0: k * 0.08, d: 0.5, v: 0.12 })); },
  packShake() { if (S('pack_shake')) return; noise({ d: 0.18, v: 0.16, f: 400, q: 1 }); tone({ f: 120, f2: 90, d: 0.18, v: 0.15 }); },
  reveal(rarityIdx = 0) {
    if (S('reveal_' + rarityIdx, { vary: 0 })) return;
    const base = [440, 523, 587, 698, 784][rarityIdx] || 440, n = 2 + rarityIdx;
    for (let k = 0; k < n; k++) tone({ f: base * Math.pow(1.26, k), type: 'triangle', t0: k * 0.07, d: 0.5 + rarityIdx * 0.15, v: 0.12 });
    if (rarityIdx >= 3) { noise({ d: 0.9, v: 0.2, f: 500, f2: 6000, q: 0.6 }); tone({ f: 80, f2: 40, d: 1.2, v: 0.3 }); }
    if (rarityIdx >= 4) [0, 0.15, 0.3].forEach((t0) => tone({ f: 1568, type: 'sine', t0: 0.4 + t0, d: 0.8, v: 0.1 }));
  },
  emote() { if (S('emote')) return; tone({ f: 700, f2: 900, type: 'sine', d: 0.1, v: 0.08 }); },
};

// ------------------------------------------------------------ Musik
const SCALE = [0, 3, 5, 7, 10]; // Moll-Pentatonik
const MODES = {
  menu: { bpm: 70, root: 57, bass: [0, 0, 5, 3], lead: 0.35 },
  battle: { bpm: 108, root: 52, bass: [0, 0, 3, 5, 0, 0, 7, 5], lead: 0.2 },
};
function musicTick() {
  if (!ok() || !musicOn || cur) return;
  const m = MODES[musicMode], sec = 60 / m.bpm / 2, step = musicStep++;
  const bassNote = m.bass[Math.floor(step / 4) % m.bass.length];
  const mt = (n) => 440 * Math.pow(2, (n - 69) / 12);
  if (step % 4 === 0) tone({ f: mt(m.root - 12 + bassNote), type: 'sine', d: sec * 3.6, v: 0.5, bus: musBus, a: 0.03 });
  if (musicMode === 'battle' && step % 2 === 0) tone({ f: mt(m.root - 12 + bassNote), type: 'triangle', d: 0.12, v: 0.25, bus: musBus });
  if (Math.random() < m.lead + (step % 8 === 0 ? 0.4 : 0)) {
    const n = m.root + 12 + SCALE[Math.floor(Math.random() * SCALE.length)] + (Math.random() < 0.25 ? 12 : 0);
    tone({ f: mt(n), type: 'triangle', d: sec * 2.5, v: 0.28, bus: musBus, a: 0.01 });
  }
  if (step % 16 === 8 && musicMode === 'menu') [0, 3, 7].forEach((iv) => tone({ f: mt(m.root + iv), type: 'sine', d: sec * 8, v: 0.18, bus: musBus, a: 0.4 }));
}
export const music = {
  start(mode = 'menu') {
    musicMode = mode; wantMode = mode; ensureMusic();
    if (musicTimer) clearInterval(musicTimer);
    musicStep = 0;
    const m = MODES[mode]; musicTimer = setInterval(musicTick, (60 / m.bpm / 2) * 1000);
  },
  stop() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; wantMode = null; stopSampleMusic(); },
  set on(v) { musicOn = !!v; },
};
export const audio = {
  setMuted(v) { muted = !!v; if (master) master.gain.value = muted ? 0 : volume; ensureMusic(); },
  setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master && !muted) master.gain.value = volume; },
  setMusic(v) { musicOn = !!v; ensureMusic(); },
  get muted() { return muted; },
};
