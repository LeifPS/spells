// Kampf-Controller: HUD, Deck-Leiste, Zeichenfeld, Ereignisse -> Szene/Effekte/Sound.
import { Scene, drawAvatar } from './scene.js';
import { FX } from './fx.js';
import { DrawPad } from './pad.js';
import { recognize } from './recog.js';
import { SPELLS, SPELL_BY_ID, RARITIES, RARITY_ORDER, spellThr, levelMul } from './spells.js';
import { drawSpellIcon, clamp } from './gfx.js';
import { sfx, music } from './audio.js';
import { CFG } from './sim.js';
import { LocalSource, NetSource } from './net.js';

const EMOTES = ['👍', '😂', '😮', '😡', '👏', '🔥'];
const STATUS_ICONS = { burn: '🔥', poison: '☠️', chill: '❄️', stun: '💫', reflect: '🪞', phase: '👻', haste: '⚡' };
const FIZZLE = { acc: 'Zu ungenau', gcd: 'Noch nicht bereit', cd: 'Noch nicht bereit', mana: 'Zu wenig Mana', stun: 'Betäubt!', deck: 'Nicht im Deck', over: '' };
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Battle {
  constructor(root, hooks = {}) {
    this.root = root; this.hooks = hooks;
    this.phase = 'idle'; this.src = null; this.you = 0;
    root.innerHTML = `
<div class="b-arena">
  <canvas class="b-scene"></canvas>
  <div class="b-hud">
    <div class="b-side me"><canvas class="b-av" width="56" height="56"></canvas><div class="b-info"><div class="b-name"></div><div class="b-hp"><i class="g"></i><i class="f"></i><i class="sh"></i><b></b></div><div class="b-st"></div></div></div>
    <div class="b-mid"><div class="b-timer">2:30</div><div class="b-sd">SUDDEN DEATH</div></div>
    <div class="b-side foe"><div class="b-info"><div class="b-name"></div><div class="b-hp"><i class="g"></i><i class="f"></i><i class="sh"></i><b></b></div><div class="b-mn"><i></i></div><div class="b-st"></div></div><canvas class="b-av" width="56" height="56"></canvas></div>
  </div>
  <div class="b-callout"></div>
  <div class="b-hurt"></div>
  <div class="b-tools"><button class="b-btn b-emo" aria-label="Emotes">😊</button><button class="b-btn b-quit" aria-label="Aufgeben">🏳</button></div>
  <div class="b-emotes" hidden></div>
  <div class="b-over b-queue" hidden><div class="b-card"><div class="b-spin"></div><h2>Suche Gegner …</h2><p class="b-qs">Verbinde …</p><p class="b-qt"></p><button class="b-big ghost b-qcancel">Abbrechen</button></div></div>
  <div class="b-over b-count" hidden><div class="b-vs"><div class="b-vp"><canvas width="96" height="96"></canvas><b></b><small></small></div><div class="b-vsx">VS</div><div class="b-vp"><canvas width="96" height="96"></canvas><b></b><small></small></div></div><div class="b-cdn">3</div></div>
  <div class="b-over b-result" hidden><div class="b-card res"><h1></h1><p class="b-why"></p><div class="b-stats"></div><div class="b-extra"></div><div class="b-rbtns"></div></div></div>
</div>
<div class="b-panel">
  <div class="b-deck"></div>
  <div class="b-manar"><div class="b-mbar"><i class="pre"></i><i class="fill"></i><b></b><span>💧</span></div></div>
  <div class="b-padw"><canvas class="b-pad"></canvas><div class="b-hint">Zeichne einen Zauber</div></div>
</div>`;
    const q = (s) => root.querySelector(s);
    this.el = {
      scene: q('.b-scene'), pad: q('.b-pad'), deck: q('.b-deck'), timer: q('.b-timer'), sd: q('.b-sd'), callout: q('.b-callout'), hurt: q('.b-hurt'),
      me: q('.b-side.me'), foe: q('.b-side.foe'), mbar: q('.b-mbar'), emotes: q('.b-emotes'), queue: q('.b-queue'), count: q('.b-count'), result: q('.b-result'), hint: q('.b-hint'),
    };
    this.scene = new Scene(this.el.scene);
    this.fx = new FX(this.scene);
    this.pad = new DrawPad(this.el.pad, { onStroke: (pts) => this.onStroke(pts), onStart: () => { this.el.hint.classList.add('hide'); } });
    this.pad.enabled = false;
    this.pad.run();
    this.buildEmotes();
    q('.b-emo').onclick = () => { sfx.click(); this.el.emotes.hidden = !this.el.emotes.hidden; };
    q('.b-quit').onclick = (e) => this.surrender(e.currentTarget);
    q('.b-qcancel').onclick = () => this.cancelQueue();
    window.addEventListener('keydown', (e) => {
      if (this.root.hidden || this.phase !== 'play') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 8 && this.deckIds[n - 1]) this.toggleGhost(this.deckIds[n - 1]);
    });
    this.raf = null; this.last = 0;
    this.st = [this.blank(), this.blank()];
    this.deckIds = [];
  }

  blank() { return { hp: 200, hpShow: 200, hpGhost: 200, mana: 100, shield: 0, shT: 0, gcd: 0, cds: {}, stun: 0, chill: 0, haste: 0, burn: 0, poison: 0, reflect: 0, phase: 0 }; }

  // ------------------------------------------------------------ Anzeigen / Steuerung
  show() { this.root.hidden = false; this.scene.resize(); this.pad.resize(); if (!this.raf) { this.last = performance.now(); const loop = (now) => { const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.tick(dt); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); } }
  hide() { this.root.hidden = true; if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }

  /** mode: 'online' | 'train' ; profile: {pid,name,trophies,deck,levels,skin} */
  play(profile, { mode = 'online', level = 1, theme = null, noBot = false } = {}) {
    this.profile = profile; this.mode = mode; this.level = level; this.opts = { mode, level, theme, noBot };
    if (this.src) this.src.close();
    this.show();
    this.resetUi();
    music.start('menu');
    if (mode === 'online') {
      this.phase = 'queue'; this.queueT = 0;
      this.el.queue.hidden = false; this.el.queue.querySelector('.b-qs').textContent = 'Verbinde …';
      this.src = new NetSource(profile);
    } else {
      this.phase = 'wait';
      this.src = new LocalSource(profile, { level, theme, noBot, countdown: mode === 'tutorial' ? 2 : 3.2 });
    }
    this.src.on((m) => this.msg(m));
    this.src.start();
  }

  resetUi() {
    this.st = [this.blank(), this.blank()];
    this.fx.clear(); this.pad.enabled = false; this.pad.setGhost(null);
    for (const k of ['queue', 'count', 'result', 'emotes']) this.el[k].hidden = true;
    this.el.hint.classList.remove('hide');
    this.el.timer.textContent = fmtTime(CFG.duration); this.el.sd.classList.remove('on'); this.el.timer.classList.remove('danger');
    this.el.callout.innerHTML = ''; this.ghostId = null; this.opt = {}; this.matchT = 0; this.snapAt = 0; this.over = false;
    this.root.querySelector('.b-quit').classList.remove('arm');
  }

  cancelQueue() {
    sfx.back();
    if (this.src && this.src.cancel) this.src.cancel();
    if (this.src) this.src.close();
    this.src = null; this.phase = 'idle';
    this.hide(); music.start('menu');
    if (this.hooks.onExit) this.hooks.onExit({ cancelled: true });
  }

  surrender(btn) {
    if (this.phase !== 'play' && this.phase !== 'count') return;
    if (!btn.classList.contains('arm')) { btn.classList.add('arm'); btn.textContent = 'Aufgeben?'; setTimeout(() => { btn.classList.remove('arm'); btn.textContent = '🏳'; }, 2500); sfx.click(); return; }
    btn.classList.remove('arm'); btn.textContent = '🏳';
    this.src.quit();
  }

  buildEmotes() {
    this.el.emotes.innerHTML = '';
    EMOTES.forEach((g, n) => {
      const b = document.createElement('button'); b.textContent = g;
      b.onclick = () => { if (this.phase !== 'play' && this.phase !== 'count') return; this.src.emote(n); this.el.emotes.hidden = true; };
      this.el.emotes.appendChild(b);
    });
  }

  // ------------------------------------------------------------ Nachrichten
  msg(m) {
    switch (m.t) {
      case 'status': this.el.queue.querySelector('.b-qs').textContent = m.text; break;
      case 'offline': {
        if (this.phase !== 'queue') break;
        if (this.hooks.toast) this.hooks.toast(`${m.why} – Übungskampf gegen Bot`);
        const t = this.profile.trophies;
        this.src.close();
        this.mode = 'offline'; this.phase = 'wait'; this.el.queue.hidden = true;
        this.src = new LocalSource(this.profile, { level: t < 300 ? 1 : t < 900 ? 2 : 3 });
        this.src.on((x) => this.msg(x)); this.src.start();
        break;
      }
      case 'start': this.onStart(m); break;
      case 'go': this.onGo(); break;
      case 'snap': this.onSnap(m.s); break;
      case 'ev': for (const e of m.ev) this.onEvent(e); break;
      case 'emote': { const P = this.scene.pl[m.p]; if (P) { P.emote = { glyph: EMOTES[m.n] || '👍', t: 2.4 }; sfx.emote(); } break; }
      case 'end': this.onEnd(m); break;
      case 'disconnected': if (this.phase === 'play' || this.phase === 'count') this.onEnd({ winner: 1 - this.you, reason: 'disconnect', stats: [], time: Math.round(this.matchT) }); else if (this.phase === 'queue') { this.msg({ t: 'offline', why: 'Verbindung getrennt' }); } break;
      default: break;
    }
  }

  onStart(m) {
    this.phase = 'count'; this.you = m.you; this.players = m.players; this.levels = m.levels; this.cdLeft = m.countdown; this.lastCdN = 99; this.local = !!m.local;
    this.el.queue.hidden = true;
    this.scene.reset(m.you, m.players); this.scene.setTheme(m.theme); this.fx.clear();
    this.st = [this.blank(), this.blank()];
    const me = m.players[m.you], foe = m.players[1 - m.you];
    drawAvatar(this.el.me.querySelector('.b-av'), me.skin, 56); drawAvatar(this.el.foe.querySelector('.b-av'), foe.skin, 56);
    this.el.me.querySelector('.b-name').textContent = me.name; this.el.foe.querySelector('.b-name').textContent = foe.name + (foe.bot ? ' 🤖' : '');
    const vp = this.el.count.querySelectorAll('.b-vp');
    [me, foe].forEach((p, k) => { drawAvatar(vp[k].querySelector('canvas'), p.skin, 96); vp[k].querySelector('b').textContent = p.name + (p.bot ? ' 🤖' : ''); vp[k].querySelector('small').textContent = `🏆 ${p.trophies}`; });
    this.buildDeck(me.deck, m.levels[m.you]);
    this.el.count.hidden = false;
    this.pad.enabled = false; this.pad.setGhost(null); this.ghostId = null;
    this.opt = {};
    music.start('menu');
  }

  onGo() {
    this.phase = 'play'; this.pad.enabled = true;
    this.el.count.querySelector('.b-cdn').textContent = 'LOS!';
    sfx.countdown(0);
    setTimeout(() => { if (this.phase === 'play') this.el.count.hidden = true; }, 500);
    music.start('battle');
  }

  onSnap(s) {
    this.matchT = s.t; this.snapAt = performance.now();
    s.p.forEach((p, i) => {
      const st = this.st[i], now = performance.now();
      st.hp = p.hp; st.mana = p.mana; st.shield = p.shield; st.shT = p.shT;
      st.stun = p.stun; st.chill = p.chill; st.haste = p.haste; st.burn = p.burn; st.poison = p.poison; st.reflect = p.reflect; st.phase = p.phase;
      if (i === this.you) {
        // eigene, noch nicht bestätigte Eingaben nicht überschreiben
        const o = this.opt;
        st.gcd = Math.max(p.gcd, o.gcdUntil > now ? Math.max(0, o.gcd0 - (now - o.t0) / 1000) : 0);
        st.cds = { ...p.cds };
        for (const id in o.cds || {}) if (o.cds[id].until > now) st.cds[id] = Math.max(st.cds[id] || 0, o.cds[id].cd0 - (now - o.cds[id].t0) / 1000);
        if (o.mana && o.mana.until > now) st.mana = Math.min(st.mana, o.mana.v);
      }
      this.scene.setStatus(i, p);
    });
    this.renderStatuses();
  }

  setHp(i, hp) { this.st[i].hp = hp; }

  onEvent(e) {
    const fx = this.fx, sc = this.scene, me = this.you;
    switch (e.k) {
      case 'cast': {
        fx.cast(e);
        const sp = SPELL_BY_ID[e.id];
        if (e.p === me) { delete this.opt.pending; }
        else this.callout(sp, e);
        break;
      }
      case 'fizzle': if (e.p === me) { const t = FIZZLE[e.why]; if (t) this.pad.say(t, '#ff8a8a'); sfx.fizzle(); this.opt = {}; } break;
      case 'hit': {
        this.setHp(e.p, e.hp); this.st[e.p].shield = e.shield; fx.hit(e);
        if (e.p === me && e.amount > 0) this.hurtFlash(e.amount);
        break;
      }
      case 'dot': this.setHp(e.p, e.hp); this.st[e.p].shield = e.shield; fx.dot(e); break;
      case 'heal': this.setHp(e.p, e.hp); fx.heal(e); break;
      case 'shield': this.st[e.p].shield = e.total ?? 0; fx.shield(e); break;
      case 'mana': fx.mana(e); break;
      case 'status': fx.status(e); break;
      case 'cleanse': fx.cleanse(e); sfx.good(); break;
      case 'evade': fx.evade(e); break;
      case 'reflect': fx.reflect(e); break;
      default: break;
    }
  }

  callout(sp, e) {
    const d = document.createElement('div');
    d.className = 'b-co'; d.style.setProperty('--c', RARITIES[sp.rarity].color);
    const c = document.createElement('canvas'); drawSpellIcon(c, sp, 64, { bg: false, ring: false });
    d.appendChild(c);
    const t = document.createElement('span'); t.textContent = sp.name; d.appendChild(t);
    this.el.callout.appendChild(d);
    setTimeout(() => d.classList.add('out'), 1100); setTimeout(() => d.remove(), 1500);
    while (this.el.callout.children.length > 3) this.el.callout.firstChild.remove();
  }

  hurtFlash(amount) {
    const h = this.el.hurt; h.style.opacity = String(clamp(0.25 + amount / 70, 0.25, 0.9));
    h.classList.remove('on'); void h.offsetWidth; h.classList.add('on');
  }

  // ------------------------------------------------------------ Eingabe / Erkennung
  deckSpecs() { return this.deckIds.map((id) => ({ id, shape: SPELL_BY_ID[id].shape, thr: spellThr(SPELL_BY_ID[id]) })); }
  otherSpecs() { return SPELLS.filter((s) => !this.deckIds.includes(s.id)).map((s) => ({ id: s.id, shape: s.shape, thr: spellThr(s) })); }

  onStroke(pts) {
    if (this.phase !== 'play') return null;
    const r = recognize(pts, this.deckSpecs(), this.otherSpecs());
    if (!r.ok) {
      if (r.reason === 'short' || r.reason === 'empty') return { ok: null };
      sfx.bad();
      if (r.reason === 'low') {
        const b = r.best, sp = SPELL_BY_ID[b.id], close = b.score >= b.thr - 0.12;
        this.pad.say('Nicht erkannt', '#ff9a9a', close ? `${sp.name}: ${Math.round(b.score * 100)} % (nötig ${Math.round(b.thr * 100)} %)` : '');
        return { ok: false, color: '#ff7a7a' };
      }
      if (r.reason === 'ambiguous') { this.pad.say('Unklar – deutlicher zeichnen', '#ffd36a'); return { ok: false, color: '#ffd36a' }; }
      if (r.reason === 'notInDeck') { this.pad.say('Nicht im Deck', '#ffb86a', SPELL_BY_ID[r.other].name); return { ok: false, color: '#ffb86a' }; }
      return { ok: false, color: '#ff7a7a' };
    }
    const sp = SPELL_BY_ID[r.id], s = this.st[this.you], tol = CFG.tol;
    const block = (t) => { this.pad.say(t, '#ff9a9a', sp.name); sfx.fizzle(); return { ok: false, color: '#ff7a7a' }; };
    if (s.stun > 0) return block('Betäubt!');
    if (s.mana < sp.cost - 0.01) return block('Zu wenig Mana');
    if ((s.cds[r.id] || 0) > tol) return block(`${sp.name} lädt noch`);
    if (s.gcd > tol) return block('Noch nicht bereit');
    // optimistisch: Abklingzeiten sofort starten (Server bestätigt gleich)
    const now = performance.now();
    this.opt = this.opt || {};
    this.opt.gcdUntil = now + 600; this.opt.gcd0 = CFG.gcd; this.opt.t0 = now;
    (this.opt.cds = this.opt.cds || {})[r.id] = { until: now + 600, cd0: sp.cd, t0: now };
    this.opt.mana = { until: now + 600, v: s.mana - sp.cost };
    s.gcd = CFG.gcd; s.cds[r.id] = sp.cd; s.mana -= sp.cost;
    this.src.cast(r.id, Math.round(r.score * 1000) / 1000);
    sfx.recognized(RARITY_ORDER.indexOf(sp.rarity));
    return { ok: true, color: sp.color, msg: sp.name };
  }

  toggleGhost(id) {
    sfx.click();
    this.ghostId = this.ghostId === id ? null : id;
    const sp = this.ghostId && SPELL_BY_ID[this.ghostId];
    this.pad.setGhost(sp ? sp.shape : null, sp ? sp.color : null);
    this.el.deck.querySelectorAll('.slot').forEach((b) => b.classList.toggle('sel', b.dataset.id === this.ghostId));
  }

  // ------------------------------------------------------------ Deck-Leiste
  buildDeck(ids, levels) {
    this.deckIds = ids.slice();
    const box = this.el.deck; box.innerHTML = ''; box.dataset.n = String(ids.length);
    this.slots = {};
    ids.forEach((id, k) => {
      const sp = SPELL_BY_ID[id];
      const b = document.createElement('button'); b.className = 'slot'; b.dataset.id = id; b.style.setProperty('--c', RARITIES[sp.rarity].color); b.style.setProperty('--g', sp.color);
      const cv = document.createElement('canvas'); drawSpellIcon(cv, sp, 96);
      b.innerHTML = `<span class="k">${k + 1}</span><span class="cost">${sp.cost}</span><span class="lv">${levels && levels[id] > 1 ? 'Lv' + levels[id] : ''}</span><i class="cdo"></i><em class="cdt"></em><small>${sp.name}</small>`;
      b.prepend(cv);
      b.onclick = () => this.toggleGhost(id);
      box.appendChild(b);
      this.slots[id] = { b, cdo: b.querySelector('.cdo'), cdt: b.querySelector('.cdt'), last: '' };
    });
  }

  renderStatuses() {
    for (const i of [0, 1]) {
      const st = this.st[i], root = i === this.you ? this.el.me : this.el.foe, box = root.querySelector('.b-st');
      const parts = [];
      for (const k of Object.keys(STATUS_ICONS)) if (st[k] > 0) parts.push(`<span class="chip">${STATUS_ICONS[k]}<small>${Math.ceil(st[k])}</small></span>`);
      if (st.shield > 0) parts.push(`<span class="chip sh">🛡<small>${Math.round(st.shield)}</small></span>`);
      const html = parts.join('');
      if (box._h !== html) { box.innerHTML = html; box._h = html; }
    }
  }

  // ------------------------------------------------------------ Frame
  tick(dt) {
    // Countdown
    if (this.phase === 'count') {
      this.cdLeft = Math.max(0, this.cdLeft - dt);
      const n = Math.ceil(this.cdLeft - 0.2);
      if (n !== this.lastCdN && n >= 1) { this.lastCdN = n; this.el.count.querySelector('.b-cdn').textContent = String(n); sfx.countdown(n); const c = this.el.count.querySelector('.b-cdn'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    }
    if (this.phase === 'queue') {
      this.queueT = (this.queueT || 0) + dt;
      this.el.queue.querySelector('.b-qt').textContent = `${Math.floor(this.queueT)} s`;
    }
    const playing = this.phase === 'play';
    if (playing) {
      this.matchT += dt;
      for (const i of [0, 1]) {
        const s = this.st[i];
        const reg = CFG.regen * (s.chill > 0 ? CFG.chillRegen : 1) * (s.haste > 0 ? CFG.hasteRegen : 1);
        s.mana = Math.min(CFG.maxMana, s.mana + reg * dt);
        s.gcd = Math.max(0, s.gcd - dt);
        for (const id in s.cds) s.cds[id] = Math.max(0, s.cds[id] - dt);
        for (const k of ['stun', 'chill', 'haste', 'reflect', 'phase', 'burn', 'poison']) s[k] = Math.max(0, s[k] - dt);
        if (s.shT > 0) s.shT -= dt;
      }
    }
    // HP-Anzeige weich
    for (const i of [0, 1]) {
      const s = this.st[i];
      s.hpShow += (s.hp - s.hpShow) * Math.min(1, dt * 14);
      if (s.hpGhost > s.hpShow) s.hpGhost = Math.max(s.hpShow, s.hpGhost - dt * 60); else s.hpGhost = s.hpShow;
    }
    this.renderHud();
    this.scene.update(dt); this.scene.draw();
  }

  renderHud() {
    const set = (root, s) => {
      const hp = root.querySelector('.b-hp');
      hp.querySelector('.f').style.transform = `scaleX(${clamp(s.hpShow / CFG.maxHp)})`;
      hp.querySelector('.g').style.transform = `scaleX(${clamp(s.hpGhost / CFG.maxHp)})`;
      const sh = hp.querySelector('.sh'); sh.style.transform = `scaleX(${clamp(s.shield / 100)})`; sh.style.opacity = s.shield > 0 ? 1 : 0;
      hp.querySelector('b').textContent = String(Math.max(0, Math.round(s.hp)));
      hp.classList.toggle('low', s.hp < 60);
    };
    set(this.el.me, this.st[this.you]); set(this.el.foe, this.st[1 - this.you]);
    this.el.foe.querySelector('.b-mn i').style.transform = `scaleX(${clamp(this.st[1 - this.you].mana / CFG.maxMana)})`;
    const me = this.st[this.you], mb = this.el.mbar;
    mb.querySelector('.fill').style.transform = `scaleX(${clamp(me.mana / CFG.maxMana)})`;
    mb.querySelector('b').textContent = String(Math.floor(me.mana));
    if (this.phase === 'play') {
      const left = Math.max(0, CFG.duration - this.matchT);
      this.el.timer.textContent = fmtTime(left);
      const sd = this.matchT > CFG.suddenAt;
      this.el.sd.classList.toggle('on', sd); this.el.timer.classList.toggle('danger', sd || left < 15);
    }
    // Slots
    const playing = this.phase === 'play';
    for (const id of this.deckIds) {
      const o = this.slots[id], sp = SPELL_BY_ID[id];
      const cd = me.cds[id] || 0, g = me.gcd, rem = Math.max(cd, g);
      const frac = clamp(Math.max(cd / sp.cd, g / CFG.gcd));
      const ready = playing && rem <= CFG.tol && me.mana >= sp.cost && me.stun <= 0;
      const key = `${frac.toFixed(2)}|${ready}|${me.mana >= sp.cost}|${cd > g ? Math.ceil(cd) : 0}`;
      if (o.last === key) continue; o.last = key;
      o.cdo.style.transform = `scaleY(${frac})`;
      o.cdt.textContent = cd > g + 0.2 && cd > 0.3 ? cd.toFixed(cd < 10 ? 1 : 0) : '';
      o.b.classList.toggle('ready', ready);
      o.b.classList.toggle('nomana', me.mana < sp.cost);
    }
  }

  // ------------------------------------------------------------ Ende
  onEnd(m) {
    if (this.over) return; this.over = true;
    const win = m.winner === this.you, draw = m.winner === -1 || m.winner == null;
    this.phase = 'over'; this.pad.enabled = false;
    if (!draw) { this.scene.trigger(1 - m.winner, 'die'); this.scene.trigger(m.winner, 'win'); }
    this.scene.slowmo(0.35, 0.8); this.scene.shake(14);
    const stats = m.stats || [];
    const res = { won: win && !draw, draw, lost: !win && !draw, reason: m.reason, time: m.time, you: this.you, mode: this.mode, stats: stats[this.you] || null, foeStats: stats[1 - this.you] || null, opponent: this.players ? this.players[1 - this.you] : null, level: this.level };
    music.stop();
    setTimeout(() => this.showResult(res), 1500);
  }

  showResult(res) {
    const el = this.el.result, card = el.querySelector('.res');
    card.className = 'b-card res ' + (res.draw ? 'draw' : res.won ? 'win' : 'lose');
    card.querySelector('h1').textContent = res.draw ? 'Unentschieden' : res.won ? 'Sieg!' : 'Niederlage';
    const why = { ko: res.won ? 'Gegner besiegt' : 'Du wurdest besiegt', time: 'Zeit abgelaufen – mehr Leben gewinnt', quit: res.won ? 'Gegner hat aufgegeben' : 'Du hast aufgegeben', left: 'Gegner hat den Kampf verlassen', disconnect: 'Verbindung verloren' }[res.reason] || '';
    card.querySelector('.b-why').textContent = why;
    const s = res.stats;
    card.querySelector('.b-stats').innerHTML = s ? `<div><b>${s.dmg}</b><small>Schaden</small></div><div><b>${s.heal}</b><small>Heilung</small></div><div><b>${s.casts}</b><small>Zauber</small></div><div><b>${s.acc}%</b><small>Genauigkeit</small></div><div><b>${fmtTime(res.time)}</b><small>Dauer</small></div>` : '';
    const extra = card.querySelector('.b-extra'); extra.innerHTML = '';
    if (this.hooks.onResult) { try { this.hooks.onResult(res, extra); } catch (e) { console.error(e); } }
    const bt = card.querySelector('.b-rbtns'); bt.innerHTML = '';
    const again = document.createElement('button'); again.className = 'b-big'; again.textContent = 'Nochmal';
    again.onclick = () => { sfx.click(); this.play(this.hooks.profile ? this.hooks.profile() : this.profile, this.opts); };
    const menu = document.createElement('button'); menu.className = 'b-big ghost'; menu.textContent = 'Menü';
    menu.onclick = () => { sfx.back(); this.hide(); music.start('menu'); if (this.hooks.onExit) this.hooks.onExit(res); };
    bt.append(again, menu);
    el.hidden = false;
    (res.won ? sfx.win : res.draw ? sfx.good : sfx.lose)();
  }
}
