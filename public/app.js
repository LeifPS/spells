import { SPELLS, SPELL_BY_ID, RARITIES, RARITY_ORDER, SHAPES, describe } from './spells.js';
import { recognize, templateNormalized } from './recognizer.js';
import { DrawPad } from './pad.js';
import { Arena } from './vfx.js';
import { sfx, unlock, isMuted, setMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const MAX_HP = 200;
const PACK_COST = 60;
const REWARD = { human: { win: 40, draw: 25, lose: 15 }, bot: { win: 30, draw: 20, lose: 10 } };

// ------------------------------------------------------------------ Speicherstand (lokal)
const KEY = 'spells_save_v1';
function fresh() {
  return {
    v: 1, coins: 120, owned: { feuerball: 1, heilfunke: 1 }, pity: 0,
    pid: 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    name: 'Zauberer' + Math.floor(100 + Math.random() * 900), stats: { w: 0, l: 0, d: 0 },
  };
}
function load() {
  try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.v === 1 && o.owned) return o; } catch {}
  return fresh();
}
const S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
const ownedIds = () => Object.keys(S.owned);
save();

// ------------------------------------------------------------------ Hilfen
document.addEventListener('pointerdown', unlock, { passive: true });

function drawShape(cv, key, color, size = 168) {
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const pts = templateNormalized(key);
  const k = size * 0.72, cx = size / 2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = size * 0.08; ctx.lineWidth = size * 0.055;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * k, cx + y * k) : ctx.moveTo(cx + x * k, cx + y * k)));
  ctx.stroke();
  if (!SHAPES[key].closed) {
    ctx.shadowBlur = 0; ctx.fillStyle = '#7dff9c';
    ctx.beginPath(); ctx.arc(cx + pts[0][0] * k, cx + pts[0][1] * k, size * 0.045, 0, 7); ctx.fill();
  }
}

const screens = {};
document.querySelectorAll('.screen').forEach((s) => (screens[s.id] = s));
let current = 'menu';
let matchPad = null, pracPad = null, arena = null;

function show(id) {
  current = id;
  for (const s of Object.values(screens)) s.classList.toggle('active', s.id === id);
  if (pracPad) (id === 'practice' ? pracPad.start() : pracPad.stop());
  if (matchPad) (id === 'match' ? matchPad.start() : matchPad.stop());
  if (arena) (id === 'match' ? arena.start() : arena.stop());
  if (id === 'menu') renderMenu();
  if (id === 'book') renderBook();
  if (id === 'packs') renderPacks();
  requestAnimationFrame(() => { pracPad && pracPad.resize(); matchPad && matchPad.resize(); arena && arena.resize(); });
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { sfx.ok(); show(b.dataset.go); }));

// ------------------------------------------------------------------ Menü
function renderMenu() {
  $('coins').textContent = S.coins;
  $('nameInput').value = S.name;
  $('stats').textContent = `Siege ${S.stats.w} · Niederlagen ${S.stats.l} · Unentschieden ${S.stats.d} · Zauber ${ownedIds().length}/${SPELLS.length}`;
  $('btnMute').textContent = isMuted() ? '🔇' : '🔊';
}
$('nameInput').addEventListener('input', (e) => { S.name = e.target.value.replace(/[<>]/g, '').slice(0, 14); save(); });
$('btnMute').addEventListener('click', () => { setMuted(!isMuted()); renderMenu(); });
$('btnBook').addEventListener('click', () => { sfx.ok(); show('book'); });
$('btnPacks').addEventListener('click', () => { sfx.ok(); show('packs'); });
$('btnFight').addEventListener('click', () => { if (!S.name.trim()) S.name = 'Zauberer'; save(); startQueue(); });

// ------------------------------------------------------------------ Zauberbuch & Üben
function renderBook() {
  const grid = $('bookGrid');
  grid.innerHTML = '';
  const list = [...SPELLS].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  $('bookCount').textContent = `${ownedIds().length}/${SPELLS.length}`;
  for (const sp of list) {
    const r = RARITIES[sp.rarity], has = !!S.owned[sp.id];
    const el = document.createElement('div');
    el.className = 'card' + (has ? '' : ' locked');
    el.style.setProperty('--rc', r.color);
    if (has) {
      const cv = document.createElement('canvas');
      drawShape(cv, sp.shape, sp.color);
      el.append(cv);
      el.insertAdjacentHTML('beforeend', `<div class="nm">${sp.name}</div><div class="rar">${r.name}</div><div class="ds">${describe(sp)}</div><div class="ds">Mind. ${Math.round(r.thr * 100)}% Genauigkeit · tippen zum Üben</div>`);
      el.addEventListener('click', () => { sfx.ok(); openPractice(sp); });
    } else {
      el.insertAdjacentHTML('beforeend', `<div class="q">?</div><div class="nm">Gesperrt</div><div class="rar">${r.name}</div><div class="ds">In Zauberpaketen finden</div>`);
    }
    grid.append(el);
  }
}

let pracSpell = null, pracHelp = true;
function ensurePracPad() {
  if (pracPad) return;
  pracPad = new DrawPad($('pracCv'), {
    onStroke(pts) {
      const r = recognize(pts, [pracSpell.id]);
      const mine = r.all.find((x) => x.id === pracSpell.id);
      const thr = RARITIES[pracSpell.rarity].thr;
      const pct = Math.round((mine ? mine.score : 0) * 100);
      const el = $('pracResult');
      if (r.ok && r.id === pracSpell.id) {
        el.textContent = `✔ Gelungen – ${pct}% (nötig ${Math.round(thr * 100)}%)`; el.style.color = '#7dff9c'; sfx.ok();
        return { ok: true, color: pracSpell.color, label: `${pct}%` };
      }
      const other = r.best && r.best.id !== pracSpell.id ? SPELL_BY_ID[r.best.id].name : null;
      el.textContent = `✖ ${pct}% (nötig ${Math.round(thr * 100)}%)` + (other ? ` – sah aus wie ${other}` : '');
      el.style.color = '#ff8a8a'; sfx.fail();
      return { ok: false, color: '#ff6b6b', label: `${pct}%` };
    },
  });
  pracPad.hint = 'Zeichne die Form nach';
}
function openPractice(sp) {
  ensurePracPad();
  pracSpell = sp;
  $('pracTitle').textContent = sp.name;
  $('pracInfo').innerHTML = `<b style="color:${RARITIES[sp.rarity].color}">${RARITIES[sp.rarity].name}</b> · ${describe(sp)}<br>Ein Strich, Größe & Startpunkt egal – nur die Form zählt.`;
  $('pracResult').textContent = '';
  pracPad.color = sp.color;
  pracPad.clear();
  applyHelp();
  show('practice');
}
function applyHelp() {
  pracPad.setGhost(pracHelp ? templateNormalized(pracSpell.shape) : null, SHAPES[pracSpell.shape].closed);
  $('pracHelp').textContent = 'Hilfe: ' + (pracHelp ? 'an' : 'aus');
}
$('pracHelp').addEventListener('click', () => { pracHelp = !pracHelp; applyHelp(); });

// ------------------------------------------------------------------ Pakete
function rollRarity(force) {
  const keys = force ? RARITY_ORDER.slice(1) : RARITY_ORDER;
  const total = keys.reduce((a, k) => a + RARITIES[k].weight, 0);
  let x = Math.random() * total;
  for (const k of keys) { x -= RARITIES[k].weight; if (x <= 0) return k; }
  return keys[0];
}
function renderPacks() {
  $('coins2').textContent = S.coins;
  const total = RARITY_ORDER.reduce((a, k) => a + RARITIES[k].weight, 0);
  $('odds').innerHTML = RARITY_ORDER.map((k) => `<b style="--rc:${RARITIES[k].color};color:${RARITIES[k].color}">${RARITIES[k].name}</b> ${+(RARITIES[k].weight / total * 100).toFixed(1)}%`).join(' · ')
    + '<br>Doppelte Zauber geben Münzen zurück. Alle 8 Pakete mindestens ein seltener Zauber.';
  $('btnOpen').disabled = S.coins < PACK_COST || packBusy;
  $('btnOpen').textContent = S.coins < PACK_COST ? `Zu wenig Münzen (${PACK_COST} 🪙)` : `Öffnen – ${PACK_COST} 🪙`;
}
let packBusy = false;
$('btnOpen').addEventListener('click', () => {
  if (packBusy || S.coins < PACK_COST) return;
  packBusy = true;
  S.coins -= PACK_COST;
  const rar = rollRarity(S.pity >= 7);
  S.pity = RARITY_ORDER.indexOf(rar) >= 1 ? 0 : S.pity + 1;
  const pool = SPELLS.filter((s) => s.rarity === rar);
  const sp = pool[Math.floor(Math.random() * pool.length)];
  const isNew = !S.owned[sp.id];
  S.owned[sp.id] = (S.owned[sp.id] || 0) + 1;
  if (!isNew) S.coins += RARITIES[rar].refund;
  save();
  const card = $('packCard');
  card.className = 'packCard shake';
  card.innerHTML = '<div class="packBack">🎁</div>';
  $('packInfo').textContent = 'Es knistert …';
  $('btnOpen').disabled = true;
  $('coins2').textContent = S.coins;
  sfx.pack(RARITY_ORDER.indexOf(rar));
  setTimeout(() => {
    card.className = 'packCard reveal';
    card.style.setProperty('--rc', RARITIES[rar].color);
    card.innerHTML = '';
    const cv = document.createElement('canvas');
    drawShape(cv, sp.shape, sp.color, 260);
    card.append(cv);
    card.insertAdjacentHTML('beforeend', `<div class="nm">${sp.name}</div><div class="rar">${RARITIES[rar].name}</div>${isNew ? '<div class="new">✨ NEU!</div>' : ''}`);
    $('packInfo').textContent = isNew ? describe(sp) : `Schon vorhanden – du bekommst ${RARITIES[rar].refund} 🪙 zurück.`;
    packBusy = false;
    $('coins2').textContent = S.coins;
    renderPacks();
  }, 1200);
});

// ------------------------------------------------------------------ Netzwerk & Kampf
const wsUrl = (p) => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${p}`;
let lobbyWS = null, matchWS = null, M = null;
let queueGoing = false;

function startQueue() {
  queueGoing = true;
  $('queueText').textContent = 'Suche Gegner …';
  $('queueSub').textContent = 'Wenn niemand gefunden wird, tritt ein Übungsgegner an.';
  show('queue');
  let ws;
  try { ws = lobbyWS = new WebSocket(wsUrl('/ws/lobby')); } catch { return queueFail(); }
  let matched = false;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'queue', pid: S.pid, name: S.name }));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'match' && queueGoing) {
      matched = true; queueGoing = false;
      $('queueText').textContent = m.bot ? 'Übungsgegner gefunden!' : 'Gegner gefunden!';
      ws.close();
      joinMatch(m.matchId, m.bot);
    }
  };
  ws.onclose = () => { if (!matched && queueGoing) queueFail(); };
  ws.onerror = () => {};
}
function queueFail() {
  queueGoing = false;
  $('queueText').textContent = 'Keine Verbindung';
  $('queueSub').textContent = 'Der Server ist gerade nicht erreichbar. Bitte später nochmal versuchen.';
}
$('btnCancel').addEventListener('click', () => {
  queueGoing = false;
  try { lobbyWS && lobbyWS.send(JSON.stringify({ t: 'cancel' })); lobbyWS && lobbyWS.close(); } catch {}
  show('menu');
});

function joinMatch(matchId, bot) {
  M = { you: 0, names: ['', ''], hp: [MAX_HP, MAX_HP], round: 0, drawMs: 10000, endsAt: 0, phase: 'wait', pick: null, locked: false, over: false, bot };
  const ws = matchWS = new WebSocket(wsUrl('/ws/match/' + matchId));
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', pid: S.pid, name: S.name, owned: ownedIds(), bot }));
  ws.onmessage = (e) => onMatchMsg(JSON.parse(e.data));
  ws.onclose = () => { if (M && M.ws === ws && !M.over) finishMatch(null, 'error'); };
  M.ws = ws;
}
const sendM = (o) => { try { M.ws.send(JSON.stringify(o)); } catch {} };

function ensureMatchUI() {
  if (arena) return;
  arena = new Arena($('arenaCv'));
  matchPad = new DrawPad($('padCv'), {
    onStroke(pts) {
      if (!M || M.phase !== 'draw' || M.locked) return;
      const r = recognize(pts, ownedIds());
      if (r.ok) {
        const sp = SPELL_BY_ID[r.id];
        M.pick = { id: r.id, acc: r.score };
        sendM({ t: 'pick', id: r.id, acc: r.score });
        $('btnLock').disabled = false;
        matchPad.hint = `Bereit: ${sp.name} – zeichne neu zum Ändern`;
        sfx.ok();
        return { ok: true, color: sp.color, label: `${sp.name} ${Math.round(r.score * 100)}%` };
      }
      sfx.fail();
      const label = r.reason === 'locked' ? 'Noch nicht freigeschaltet' : r.reason === 'short' ? 'Zu kurz' : r.reason === 'ambiguous' ? 'Unklar – sauberer zeichnen' : 'Nicht erkannt';
      return { ok: false, color: '#ff6b6b', label: M.pick ? `${label} (${SPELL_BY_ID[M.pick.id].name} bleibt)` : label };
    },
  });
  // Zeitleiste
  const tick = () => {
    if (current === 'match' && M && M.phase === 'draw') {
      const rem = Math.max(0, M.endsAt - performance.now());
      $('timerFill').style.width = (rem / M.drawMs) * 100 + '%';
      $('timerFill').classList.toggle('low', rem < 3000);
      if (rem <= 0 && matchPad.enabled) { matchPad.enabled = false; matchPad.disabledText = 'Zeit abgelaufen'; $('btnLock').disabled = true; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

$('btnLock').addEventListener('click', () => {
  if (!M || M.phase !== 'draw' || M.locked || !M.pick) return;
  M.locked = true;
  sendM({ t: 'lock' });
  matchPad.enabled = false; matchPad.disabledText = 'Warte auf Gegner …';
  $('btnLock').disabled = true; $('btnLock').textContent = '✔ Bereit';
  sfx.ok();
});

function banner(text) {
  const b = $('banner');
  b.textContent = text;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

const who = (p) => (p === M.you ? 'You' : 'Opp');
function setBar(p, hp, shield) {
  const k = who(p);
  if (hp != null) {
    M.hp[p] = hp;
    $('hp' + k).style.width = (Math.max(0, hp) / MAX_HP) * 100 + '%';
    $('hpTxt' + k).textContent = Math.max(0, hp) + (shield > 0 ? ` (+${shield})` : '');
    if (hp <= 0) arena.dead[p] = true;
  }
  if (shield != null) {
    arena.st[p].shield = shield;
    $('sh' + k).style.width = Math.min(100, (shield / MAX_HP) * 100) + '%';
    $('hpTxt' + k).textContent = Math.max(0, M.hp[p]) + (shield > 0 ? ` (+${shield})` : '');
  }
}
function setStatus(p, s) {
  arena.st[p].burn = s.burn; arena.st[p].poison = s.poison; arena.st[p].chill = s.chill;
  $('st' + who(p)).textContent = (s.burn ? '🔥' : '') + (s.poison ? '☠️' : '') + (s.chill ? '❄️' : '');
}

function buildChips() {
  const box = $('chips');
  box.innerHTML = '';
  const list = SPELLS.filter((s) => S.owned[s.id]).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  for (const sp of list) {
    const c = document.createElement('div');
    c.className = 'chip';
    c.style.setProperty('--rc', RARITIES[sp.rarity].color);
    const cv = document.createElement('canvas');
    drawShape(cv, sp.shape, sp.color, 68);
    c.append(cv);
    c.insertAdjacentHTML('beforeend', `<span>${sp.name}</span>`);
    box.append(c);
  }
}

function onMatchMsg(m) {
  if (!M) return;
  switch (m.t) {
    case 'start': {
      ensureMatchUI();
      M.you = m.you; M.names = m.names; M.drawMs = m.drawMs; M.hp = [MAX_HP, MAX_HP];
      arena.reset(m.you);
      $('nmYou').textContent = m.names[m.you];
      $('nmOpp').textContent = m.names[1 - m.you];
      for (const p of [0, 1]) { setBar(p, MAX_HP, 0); setStatus(p, {}); }
      $('hudOpp').classList.remove('ready');
      buildChips();
      matchPad.clear(); matchPad.enabled = false; matchPad.disabledText = '';
      $('roundNo').textContent = 'Los geht’s';
      $('timerFill').style.width = '100%';
      show('match');
      banner(`${m.names[m.you]} ⚔ ${m.names[1 - m.you]}`);
      break;
    }
    case 'round': {
      M.phase = 'draw'; M.round = m.n; M.endsAt = performance.now() + m.ms;
      M.pick = null; M.locked = false;
      matchPad.clear(); matchPad.enabled = true; matchPad.disabledText = '';
      matchPad.hint = 'Zeichne einen Zauber!';
      $('btnLock').disabled = true; $('btnLock').textContent = '⚡ Zaubern';
      $('hudOpp').classList.remove('ready');
      $('roundNo').textContent = `Runde ${m.n}`;
      banner(`Runde ${m.n}`);
      break;
    }
    case 'ready': $('hudOpp').classList.add('ready'); break;
    case 'resolve': playResolve(m); break;
    case 'end': M.over = true; setTimeout(() => finishMatch(m.winner, m.reason), 400); break;
  }
}

function playResolve(m) {
  M.phase = 'resolve';
  matchPad.enabled = false; matchPad.disabledText = '';
  matchPad.clear(); matchPad.hint = '';
  $('btnLock').disabled = true;
  $('timerFill').style.width = '0%';
  let impact = 0;
  for (const e of m.events) {
    if (e.k !== 'cast') continue;
    if (!e.id) { arena.float(e.p, 'Verpufft!', '#b0b0c0', 24); sfx.fail(); continue; }
    const sp = SPELL_BY_ID[e.id];
    arena.float(e.p, sp.name, sp.color, 20, true);
    impact = Math.max(impact, arena.cast(e.p, sp));
  }
  const base = impact + 150;
  let dotN = 0;
  const ICON = { burn: '🔥 Brennen', poison: '☠ Gift', chill: '❄ Frost' };
  for (const e of m.events) {
    if (e.k === 'cast') continue;
    let at = base;
    if (e.k === 'status') at = base + 450;
    if (e.k === 'dot') at = base + 1000 + 650 * dotN++;
    arena.later(at, () => {
      if (e.k === 'dmg') {
        arena.hitFx(e.p, e.amount, e.absorbed, SPELL_BY_ID[e.id].color);
        setBar(e.p, e.hp, e.shield);
      } else if (e.k === 'heal') { arena.healFx(e.p, e.amount, e.drain); setBar(e.p, e.hp, null); }
      else if (e.k === 'shield') { arena.shieldFx(e.p, e.amount); sfx.shield(); setBar(e.p, null, e.total); }
      else if (e.k === 'cleanse') arena.float(e.p, '✨ Gereinigt', '#fff', 24);
      else if (e.k === 'status') arena.float(e.p, ICON[e.type], '#fff', 20);
      else if (e.k === 'dot') { arena.dotFx(e.p, e.type, e.amount, e.absorbed); setBar(e.p, e.hp, e.shield); }
    });
  }
  arena.later(base + 1000 + 650 * dotN + 100, () => {
    m.state.forEach((s, p) => { setBar(p, s.hp, s.shield); setStatus(p, s); });
  });
}

function finishMatch(winner, reason) {
  if (!M) return;
  const bot = M.bot, me = M.you;
  const wasOver = M.over;
  M.over = true;
  try { M.ws && M.ws.close(); } catch {}
  if (reason === 'error' && !wasOver) {
    $('endTitle').textContent = 'Verbindung weg';
    $('endSub').textContent = 'Das Gefecht wurde unterbrochen.';
    $('endCoins').textContent = '';
    $('end').classList.add('active');
    M = null;
    return;
  }
  const res = winner === -1 ? 'draw' : winner === me ? 'win' : 'lose';
  const coins = REWARD[bot ? 'bot' : 'human'][res];
  S.coins += coins;
  S.stats[res === 'win' ? 'w' : res === 'lose' ? 'l' : 'd']++;
  save();
  $('endTitle').textContent = { win: 'Sieg!', lose: 'Niederlage', draw: 'Unentschieden' }[res];
  $('endSub').textContent = reason === 'left' ? 'Dein Gegner hat das Gefecht verlassen.' : reason === 'ko' && res !== 'draw' ? 'K.o.!' : 'Nach der letzten Runde entschieden.';
  $('endCoins').textContent = `+${coins} 🪙` + (bot ? '  (Übungsgegner)' : '');
  (res === 'win' ? sfx.win : sfx.lose)();
  $('end').classList.add('active');
  M = null;
}
$('btnEndMenu').addEventListener('click', () => { $('end').classList.remove('active'); show('menu'); });
$('btnEndAgain').addEventListener('click', () => { $('end').classList.remove('active'); startQueue(); });

show('menu');
