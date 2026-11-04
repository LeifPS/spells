// Kleine synthetische Sounds (kein Download nötig).
let ac = null;
let muted = false;
try { muted = localStorage.getItem('spells_mute') === '1'; } catch {}

export function unlock() {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch {}
}
export const isMuted = () => muted;
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem('spells_mute', v ? '1' : '0'); } catch {}
}

function tone(f0, f1, dur, type = 'sine', gain = 0.15, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, f0, f1, gain = 0.2, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(ac.destination);
  s.start(t);
}

export const sfx = {
  cast(kind) { // "suw"
    noise(0.45, 400, 2400, 0.22);
    tone(300, 900, 0.3, 'triangle', 0.06);
    if (kind === 'big') tone(110, 55, 0.7, 'sawtooth', 0.08, 0.1);
  },
  hit(big) {
    noise(big ? 0.45 : 0.25, 900, 120, big ? 0.35 : 0.22);
    tone(big ? 90 : 140, 45, big ? 0.5 : 0.28, 'sine', 0.3);
  },
  heal() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.25, 'sine', 0.09, i * 0.07)); },
  shield() { tone(200, 700, 0.35, 'triangle', 0.1); noise(0.3, 1200, 3000, 0.08); },
  fail() { tone(200, 90, 0.3, 'sawtooth', 0.07); },
  ok() { tone(660, 990, 0.14, 'triangle', 0.1); },
  tick() { tone(900, 900, 0.05, 'square', 0.04); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.12, i * 0.12)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.98, 0.35, 'sawtooth', 0.08, i * 0.18)); },
  pack(level) {
    noise(0.8, 200, 3000, 0.2);
    [0, 1, 2, 3, 4].slice(0, level + 2).forEach((_, i) => tone(400 * 1.25 ** i, 400 * 1.25 ** i, 0.4, 'triangle', 0.1, 0.5 + i * 0.1));
  },
};
