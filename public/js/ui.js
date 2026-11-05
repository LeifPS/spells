// Menü: Kampf-Startseite, Zauber & Deck, Shop (Pakete, Garderobe), Aufgaben, Mehr, Tutorial.
import { Store, PACKS, RANKS, SKINS, rankOf, levelInfo, deckSlots, levelReward, SKIN_BY_ID, STARTER } from './store.js';
import { SPELLS, SPELL_BY_ID, RARITIES, RARITY_ORDER, LEVEL_COPIES, MAX_LEVEL, levelFor, levelMul, describeParts, roleOf, ROLE_ICON, spellThr } from './spells.js';
import { drawSpellIcon, glow, TAU, clamp, rgba, rnd, easeOut } from './gfx.js';
import { renderBackground, drawWizardArt, drawAvatar, THEME_NAMES } from './scene.js';
import { BOT_LEVELS } from './bot.js';
import { FLOORS, MODS, towerOpts } from './tower.js';
import { sfx, music, audio, unlock } from './audio.js';
import { ico, rich, nameIco, rankBadge } from './icons.js';

// ------------------------------------------------------------ kleine DOM-Helfer
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') typeof v === 'string' ? (e.style.cssText = v) : Object.assign(e.style, v);
    else if (k.startsWith('on')) e[k] = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const icon = (sp, size = 96, opts) => { const c = document.createElement('canvas'); drawSpellIcon(c, sp, size, opts); return c; };
const rarName = (r) => RARITIES[r].name;
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ------------------------------------------------------------ Held auf der Startseite
class Hero {
  constructor(cv, store) { this.cv = cv; this.store = store; this.t = 0; this.run = false; this.motes = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), v: rnd(0.01, 0.04), ph: Math.random() * 9, s: rnd(1.5, 4) })); this.icons = []; this.size(); this.ro = new ResizeObserver(() => this.size()); this.ro.observe(cv); }
  size() {
    const r = this.cv.getBoundingClientRect(); if (!r.width || !r.height) return;
    this.dpr = Math.min(devicePixelRatio || 1, 2); this.w = r.width; this.h = r.height;
    this.cv.width = r.width * this.dpr; this.cv.height = r.height * this.dpr; this.g = this.cv.getContext('2d'); this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.theme = THEME_NAMES[this.store.rank.idx % THEME_NAMES.length]; this.bg = renderBackground(this.theme, this.w, this.h, this.dpr);
  }
  setDeck() { this.icons = this.store.d.deck.slice(0, 6).map((id) => icon(SPELL_BY_ID[id], 64, { bg: false, ring: false })); this.cols = this.store.d.deck.slice(0, 6).map((id) => SPELL_BY_ID[id].color); }
  start() { if (this.run) return; this.run = true; this.setDeck(); let prev = performance.now(); const loop = (now) => { if (!this.run) return; const dt = Math.min(0.05, (now - prev) / 1000); prev = now; this.t += dt; if (this.cv.offsetParent) this.draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  stop() { this.run = false; }
  draw() {
    const g = this.g, w = this.w, hh = this.h, t = this.t; if (!g || !this.bg) return;
    g.clearRect(0, 0, w, hh); g.drawImage(this.bg, 0, 0, w, hh);
    g.globalCompositeOperation = 'lighter';
    for (const m of this.motes) { m.y -= m.v * 0.016; if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); } glow(g, m.x * w + Math.sin(t + m.ph) * 10, m.y * hh, m.s * 3, '#ffe6a0', 0.3 + 0.4 * Math.sin(t * 2 + m.ph) ** 2); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const s = Math.min(hh * 0.3, w * 0.28), x = w / 2, y = hh * 0.9;
    // Runenkreis
    g.save(); g.translate(x, y); g.scale(1, 0.26); g.globalCompositeOperation = 'lighter'; const col = this.cols && this.cols[Math.floor(t / 2) % this.cols.length] || '#7fe8ff';
    g.strokeStyle = rgba(col, 0.6); g.lineWidth = 3; g.beginPath(); g.arc(0, 0, s * 1.5, 0, TAU); g.stroke(); g.setLineDash([14, 10]); g.lineDashOffset = -t * 30; g.strokeStyle = rgba(col, 0.4); g.beginPath(); g.arc(0, 0, s * 1.2, 0, TAU); g.stroke(); g.restore();
    // Zauberer
    const cast = Math.max(0, 1 - ((t % 4.5) / 0.7));
    g.save(); g.translate(x, y); g.scale(s, s); drawWizardArt(g, { skin: this.store.skinData(), t, cast, orb: col }); g.restore();
    // kreisende Runen
    const n = this.icons.length;
    g.globalCompositeOperation = 'lighter';
    this.icons.forEach((ic, i) => {
      const a = t * 0.5 + (i / n) * TAU, rx = Math.min(w * 0.4, s * 2.3), ry = s * 0.5, px = x + Math.cos(a) * rx, py = y - s * 1.3 + Math.sin(a) * ry, depth = (Math.sin(a) + 1) / 2, sz = (26 + 18 * depth) * Math.min(1.4, s / 80);
      glow(g, px, py, sz * 0.9, this.cols[i], 0.4 + 0.3 * depth); g.globalAlpha = 0.55 + 0.45 * depth; g.drawImage(ic, px - sz / 2, py - sz / 2, sz, sz); g.globalAlpha = 1;
    });
    g.globalCompositeOperation = 'source-over';
    const vg = g.createLinearGradient(0, hh * 0.6, 0, hh); vg.addColorStop(0, 'rgba(7,5,22,0)'); vg.addColorStop(1, 'rgba(7,5,22,.9)'); g.fillStyle = vg; g.fillRect(0, hh * 0.6, w, hh * 0.4);
  }
}

// Münzregen bei Belohnungen
function coinFall(n = 14) {
  const box = h('div', { class: 'coinfall' });
  for (let i = 0; i < n; i++) { const c = ico('coin'); c.style.left = Math.random() * 96 + '%'; c.style.setProperty('--d', 1.1 + Math.random() * 0.9 + 's'); c.style.setProperty('--w', Math.random() * 0.5 + 's'); box.append(c); }
  document.body.append(box); setTimeout(() => box.remove(), 2800);
}

// ------------------------------------------------------------ App
export class App {
  constructor(root, store, battle) {
    this.root = root; this.store = store; this.battle = battle; this.tab = 'fight'; this.filter = 'all';
    battle.hooks.profile = () => this.profile();
    battle.hooks.onExit = (res) => { this.root.hidden = false; this.hero.start(); this.refresh(); if (res && res.cancelled) return; };
    battle.hooks.onResult = (res, el) => this.renderResult(res, el);
    battle.hooks.onStart = (m, b) => { if (b.mode === 'tutorial') this.tutStart(b); };
    battle.hooks.onEvent = (e, b) => { if (b.mode === 'tutorial') this.tutEvent(e, b); };
    battle.hooks.toast = (t) => this.toast(t);
    battle.hooks.settings = () => this.store.d.settings;
    this.build();
    store.onChange(() => this.refreshHeader());
    this.applyAudio();
    this.show('fight');
    if (!store.d.tutorial && !store.d.seen.welcome) setTimeout(() => this.welcome(), 400);
  }
  profile() { return this.store.battleProfile(); }
  toast(t) { const e = document.getElementById('toast'); e.replaceChildren(rich(t)); e.className = 'on'; clearTimeout(this._tt); this._tt = setTimeout(() => (e.className = ''), 2800); }
  applyAudio() { const s = this.store.d.settings; audio.setMuted(!s.sound); audio.setVolume(s.volume); audio.setMusic(s.music); music.start('menu'); }

  // ---- Gerüst
  build() {
    const r = this.root; r.innerHTML = '';
    this.hdr = h('header', { class: 'top' });
    this.main = h('main', { class: 'screens' });
    const tabs = [['fight', 'wands', 'Kampf'], ['spells', 'book', 'Zauber'], ['shop', 'gem', 'Shop'], ['quests', 'scroll', 'Aufgaben'], ['more', 'sliders', 'Mehr']];
    this.tabIds = tabs.map((t) => t[0]); this.tabBtn = {};
    this.orb = h('div', { class: 'orb' }, h('i'));
    this.nav = h('nav', { class: 'dock' }, h('div', { class: 'bg pn' }), this.orb);
    for (const [id, ic, label] of tabs) { const b = h('button', { class: 'tab', 'aria-label': label, onclick: () => { sfx.click(); this.show(id); } }, h('span', { class: 'ti' }, ico(ic)), h('small', {}, label), h('i', { class: 'dot' })); this.tabBtn[id] = b; this.nav.append(b); }
    r.append(h('div', { class: 'app' }, this.hdr, this.main, this.nav));
    this.heroCv = h('canvas', { class: 'hero-cv' });
    this.hero = new Hero(this.heroCv, this.store);
    this.refreshHeader();
  }
  refreshHeader() {
    const d = this.store.d, li = levelInfo(d.xp), hdr = this.hdr;
    if (!this.hdrBuilt) {
      this.av = h('canvas', { class: 'hav', width: 80, height: 80 });
      this.hdrName = h('b'); this.hdrLv = h('small'); this.lvlEl = h('b', { class: 'lvl' });
      const svg = h('span', { html: '<svg class="avring" viewBox="0 0 52 52"><circle class="trk" cx="26" cy="26" r="21"/><circle class="prg" cx="26" cy="26" r="21"/></svg>' });
      this.prg = svg.querySelector('.prg'); this.prg.style.strokeDashoffset = 131.95;
      this.coinEl = h('div', { class: 'cur pn' }, ico('coin'), h('span'));
      this.sndBtn = h('button', { class: 'iconbtn pn', 'aria-label': 'Ton', onclick: () => { unlock(); const s = this.store.d.settings; s.sound = !s.sound; this.store.save(); this.applyAudio(); sfx.click(); } });
      hdr.append(h('div', { class: 'who', onclick: () => this.show('more') }, h('div', { class: 'avwrap' }, svg.firstChild, this.av, this.lvlEl), h('div', { class: 'wi' }, this.hdrName, this.hdrLv)), h('div', { class: 'pills' }, this.coinEl, this.sndBtn));
      this.hdrBuilt = true; this._coins = d.coins;
    }
    this.hdrName.textContent = d.name; this.lvlEl.textContent = li.lvl; this.hdrLv.textContent = `${this.store.rank.name} · ${li.into}/${li.need} XP`;
    this.prg.style.strokeDashoffset = (131.95 * (1 - li.into / li.need)).toFixed(1);
    const span = this.coinEl.querySelector('span'); span.textContent = fmt(d.coins);
    if (d.coins > this._coins) { this.coinEl.classList.remove('bump'); void this.coinEl.offsetWidth; this.coinEl.classList.add('bump'); } this._coins = d.coins;
    this.sndBtn.replaceChildren(ico(d.settings.sound ? 'sound' : 'mute'));
    const sk = JSON.stringify(this.store.skinData()); if (this._sk !== sk) { this._sk = sk; drawAvatar(this.av, this.store.skinData(), 80); }
    this.tabBtn.quests.classList.toggle('has', this.store.dailyReady() || d.quests.list.some((q) => !q.claimed && this.store.questDone(q)));
    this.tabBtn.shop.classList.toggle('has', d.freePacks > 0);
  }
  refresh() { this.refreshHeader(); this.show(this.tab, true); }
  show(tab, keep) {
    this.tab = tab;
    for (const [id, b] of Object.entries(this.tabBtn)) b.classList.toggle('on', id === tab);
    this.orb.style.transform = `translateX(${this.tabIds.indexOf(tab) * 100}%)`;
    this.main.innerHTML = ''; this.main.scrollTop = 0;
    this.hero.stop();
    const fn = { fight: (e) => this.sFight(e), spells: (e) => this.sSpells(e), shop: (e) => this.sShop(e), quests: (e) => this.sQuests(e), more: (e) => this.sMore(e) }[tab];
    const el = h('section', { class: 'screen ' + tab }); this.main.append(el); fn(el);
    this.refreshHeader();
  }

  // ---- Modal (Bottom-Sheet)
  modal(content, { cls = '', close = true } = {}) {
    const ov = h('div', { class: 'modal-ov', onclick: (e) => { if (e.target === ov && close) end(); } });
    const end = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 200); };
    const card = h('div', { class: 'modal ' + cls }, close ? h('button', { class: 'x', 'aria-label': 'Schließen', onclick: () => { sfx.back(); end(); } }, ico('close')) : null, content);
    ov.append(card); document.body.append(ov); return { close: end, ov, card };
  }
  confirm(text, yes, label = 'Ja') { const m = this.modal(h('div', { class: 'cf' }, h('p', {}, text), h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Abbrechen'), h('button', { class: 'btn red', onclick: () => { m.close(); yes(); } }, label))), { close: true }); }

  // ============================================================ KAMPF
  sFight(el) {
    const st = this.store, d = st.d, rk = st.rank;
    const rankTxt = rk.next ? `${d.trophies - rk.min} / ${rk.next.min - rk.min} bis ${rk.next.name}` : 'Höchster Rang!';
    const rankplate = h('div', { class: 'rankplate pn' }, rankBadge(rk.idx, rk.color, 46), h('div', { class: 'rt' }, h('b', { style: `color:${rk.color}` }, rk.name), h('div', { class: 'rb' }, h('i', { style: `transform:scaleX(${rk.prog});background:${rk.color}` })), h('small', {}, rankTxt)), h('div', { class: 'tr' }, ico('trophy'), fmt(d.trophies)));
    const hero = h('div', { class: 'hero' }, this.heroCv, rankplate);
    const runes = h('span', { html: '<svg class="runes" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" stroke-dasharray="1.5 6.2"/><circle cx="50" cy="50" r="39" stroke-dasharray="16 5" stroke-opacity=".6"/></svg>' }).firstChild;
    const portal = h('button', { class: 'portal', 'aria-label': 'Kämpfen', onclick: () => this.fight(portal) }, h('i', { class: 'ring' }), h('i', { class: 'core' }, h('i', { class: 'swirl' })), runes, h('span', { class: 'pt' }, ico('wands'), h('b', {}, 'KÄMPFEN'), h('small', {}, 'Online-Duell')));
    const left = h('button', { class: 'sidebtn pn left', onclick: () => { sfx.click(); this.show('spells'); } }, ico('book'), 'Deck', h('small', {}, `${d.deck.length}/${st.slots} Zauber`));
    const right = h('button', { class: 'sidebtn pn right', onclick: () => this.modesMenu() }, ico('target'), 'Modi', h('small', {}, 'Training & mehr'));
    const row = h('div', { class: 'portalrow' }, left, portal, right);
    const strip = h('div', { class: 'zl', onclick: () => { sfx.click(); this.show('spells'); } }, ...d.deck.map((id) => h('div', { class: 'zs', style: `--c:${RARITIES[SPELL_BY_ID[id].rarity].color}` }, icon(SPELL_BY_ID[id], 64))));
    const gifts = [];
    if (st.dailyReady()) gifts.push(h('button', { class: 'gift pn', onclick: () => this.claimDaily() }, ico('gift'), h('div', {}, h('b', {}, 'Tagesgeschenk'), h('small', {}, 'Jetzt abholen!'))));
    if (d.freePacks > 0) gifts.push(h('button', { class: 'gift pack pn', onclick: () => this.openPack('basic', true) }, ico('pack'), h('div', {}, h('b', {}, `${d.freePacks}× Gratis-Paket`), h('small', {}, 'Jetzt öffnen!'))));
    el.append(hero, row, h('div', { class: 'pad' }, strip, gifts.length ? h('div', { class: 'gifts' }, ...gifts) : null, this.dailyQuestPeek()));
    this.hero.setDeck(); this.hero.size(); this.hero.start();
  }
  dailyQuestPeek() {
    const qs = this.store.d.quests.list;
    return h('div', { class: 'peek pn', onclick: () => this.show('quests') }, h('b', {}, ico('scroll'), 'Tagesaufgaben'), ...qs.map((q) => h('div', { class: 'pq' + (q.claimed ? ' done' : '') }, h('span', {}, q.text), h('em', {}, q.claimed ? ico('check') : `${Math.min(q.prog, q.goal)}/${q.goal}`))));
  }
  fight(btn) {
    unlock();
    if (!this.store.deckOk()) return this.toast('Dein Deck braucht mindestens 3 Zauber');
    sfx.click(); if (btn) btn.classList.add('go');
    setTimeout(() => { if (btn) btn.classList.remove('go'); this.root.hidden = true; this.hero.stop(); this.battle.play(this.profile(), { mode: 'online' }); }, btn ? 420 : 0);
  }
  modesMenu() {
    sfx.click();
    const m = this.modal(h('div', {}, h('h3', {}, 'Modi'), h('p', { class: 'mut' }, 'Wähle, wie du spielen möchtest.'),
      h('button', { class: 'opt pn', onclick: () => { m.close(); this.towerMenu(); } }, h('span', { class: 'oi' }, ico('tower')), h('div', {}, h('b', {}, 'Zauberturm'), h('small', {}, `10 Etagen mit wilden Regeln · bisher Etage ${this.store.d.tower.best}/10`))),
      h('button', { class: 'opt pn', onclick: () => { m.close(); this.friendMenu(); } }, h('span', { class: 'oi' }, ico('people')), h('div', {}, h('b', {}, 'Freunde-Raum'), h('small', {}, 'Mit einem Code gegen Familie & Freunde – ohne Trophäen'))),
      h('button', { class: 'opt pn', onclick: () => { m.close(); this.trainMenu(); } }, h('span', { class: 'oi' }, ico('target')), h('div', {}, h('b', {}, 'Training'), h('small', {}, 'Gegen Bots üben – ohne Risiko'))),
    ));
  }
  // ---- Zauberturm
  towerMenu() {
    sfx.click();
    const best = this.store.d.tower.best || 0;
    const rows = [...FLOORS].reverse().map((f) => {
      const cleared = f.n <= best, open = f.n <= best + 1, md = MODS[f.mod] || MODS.none;
      return h('button', { class: 'floor pn' + (cleared ? ' done' : '') + (f.n === best + 1 ? ' next' : '') + (open ? '' : ' lockd') + (f.boss ? ' boss' : ''), onclick: () => { if (!open) return this.toast(`Bezwinge zuerst Etage ${f.n - 1}`); m.close(); this.startTower(f); } },
        h('span', { class: 'fn' }, cleared ? ico('check') : open ? String(f.n) : ico('lock')),
        h('div', { class: 'fi' }, h('b', {}, f.name), h('small', {}, `${f.guard} · `, h('em', {}, md.name)), h('small', { class: 'fr' }, md.desc)),
        h('span', { class: 'frw' }, ico('coin'), String(f.reward.coins), f.reward.pack ? ico('pack') : null));
    });
    const m = this.modal(h('div', { class: 'tower' }, h('h3', {}, 'Zauberturm'), h('p', { class: 'mut' }, 'Steige Etage für Etage nach oben. Jede Etage hat eine eigene Regel – und auf Etage 5 und 10 wartet ein Boss. Belohnungen gibt es für die erste Bezwingung.'), h('div', { class: 'floors' }, ...rows)));
  }
  startTower(f) {
    unlock(); if (!this.store.deckOk()) return this.toast('Dein Deck braucht mindestens 3 Zauber');
    this.root.hidden = true; this.hero.stop(); this.battle.play(this.profile(), towerOpts(f));
  }
  // ---- Freunde-Raum
  friendMenu() {
    sfx.click();
    const alpha = 'ABCDEGHJKLMNPQRSTUVWXYZ23456789';
    const gen = (fair) => (fair ? 'F' : alpha[Math.floor(Math.random() * alpha.length)]) + Array.from({ length: 3 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
    let fair = false;
    const fairBtn = h('button', { class: 'tg', onclick: () => { fair = !fair; fairBtn.classList.toggle('on', fair); sfx.click(); } }, h('span', {}, 'Fairer Kampf (beide mit Starter-Deck)'), h('i'));
    const inp = h('input', { class: 'inp code-in', maxlength: 8, placeholder: 'CODE', autocapitalize: 'characters', autocomplete: 'off' });
    const m = this.modal(h('div', {}, h('h3', {}, 'Freunde-Raum'), h('p', { class: 'mut' }, 'Einer erstellt einen Raum und schickt den Code (oder Link), der andere gibt ihn ein. Es gibt keine Trophäen – nur Spaß.'),
      h('div', { class: 'card2 pn' }, fairBtn, h('button', { class: 'btn block', onclick: () => { const code = gen(fair); m.close(); this.shareRoom(code); } }, ico('plus'), 'Raum erstellen')),
      h('h4', {}, 'Oder beitreten'), h('div', { class: 'row' }, inp, h('button', { class: 'btn ghost', onclick: () => { const code = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length < 3) return this.toast('Bitte einen Code eingeben'); m.close(); this.startFriend(code); } }, 'Beitreten'))));
  }
  shareRoom(code) {
    const link = `${location.origin}/#room=${code}`;
    const m = this.modal(h('div', { class: 'c' }, h('h3', {}, 'Dein Raum'), h('div', { class: 'bigcode' }, code), h('p', { class: 'mut' }, code[0] === 'F' ? 'Fairer Kampf: beide spielen mit dem Starter-Deck.' : 'Jeder spielt mit seinem eigenen Deck.'),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: async () => { try { await navigator.clipboard.writeText(link); this.toast('Link kopiert!'); } catch { this.toast(link); } } }, 'Link kopieren'), h('button', { class: 'btn', onclick: () => { m.close(); this.startFriend(code); } }, 'Los – warten'))));
  }
  startFriend(code) {
    unlock(); const prof = this.profile();
    if (code[0] === 'F') { prof.deck = STARTER.slice(); prof.levels = Object.fromEntries(STARTER.map((i) => [i, 1])); }
    else if (!this.store.deckOk()) return this.toast('Dein Deck braucht mindestens 3 Zauber');
    this.root.hidden = true; this.hero.stop(); this.battle.play(prof, { mode: 'friend', room: code });
  }
  trainMenu() {
    sfx.click();
    const opts = [[0, 'target', 'Übungspuppe', 'Greift nicht an – zum Üben der Formen'], [1, 'sprout', 'Leicht', 'Wirkt langsam und patzt oft'], [2, 'flame', 'Mittel', 'Nutzt Schilde, Heilung und Kombos'], [3, 'skull', 'Schwer', 'Schnell, präzise, gnadenlos']];
    const m = this.modal(h('div', {}, h('h3', {}, 'Training'), h('p', { class: 'mut' }, 'Kein Risiko – etwas Erfahrung, aber keine Trophäen.'), ...opts.map(([lv, ic, name, desc]) => h('button', { class: 'opt pn', onclick: () => { m.close(); this.startTrain(lv); } }, h('span', { class: 'oi' }, ico(ic)), h('div', {}, h('b', {}, name), h('small', {}, desc))))));
  }
  startTrain(level) { unlock(); if (!this.store.deckOk()) return this.toast('Dein Deck braucht mindestens 3 Zauber'); this.root.hidden = true; this.hero.stop(); this.battle.play(this.profile(), { mode: 'train', level }); }
  claimDaily() {
    const r = this.store.claimDaily(); if (!r) return; sfx.coin(); coinFall(12);
    this.toast(`+${r.coins} {coin} · Serie ${r.streak}/7${r.pack ? ' · Gratis-Paket!' : ''}`); this.refresh();
  }

  // ---- Ergebnis nach dem Kampf
  renderResult(res, el) {
    const out = this.store.applyResult(res);
    if (out.practice) { el.append(h('p', { class: 'mut' }, res.mode === 'friend' ? 'Freundschaftskampf – keine Trophäen, nur Ehre!' : 'Übungskampf – keine Belohnung.')); return; }
    if (out.firstClear) el.append(h('div', { class: 'lvlup' }, ico('tower'), ` Etage ${res.floor} bezwungen!`));
    const chips = [];
    if (out.trophies) chips.push(h('span', { class: out.trophies > 0 ? 'up' : 'down' }, rich(`{trophy} ${out.trophies > 0 ? '+' : ''}${out.trophies}`)));
    if (out.coins) chips.push(h('span', { class: 'gold' }, rich(`{coin} +${out.coins}`)));
    if (out.xp) chips.push(h('span', {}, rich(`{star} +${out.xp} XP`)));
    if (out.pack) chips.push(h('span', { class: 'gold' }, rich('{pack} Gratis-Paket')));
    el.append(h('div', { class: 'rw' }, ...chips));
    if (out.coins > 0) setTimeout(() => coinFall(Math.min(24, 6 + Math.round(out.coins / 6))), 500);
    for (const u of out.ups) { el.append(h('div', { class: 'lvlup' }, rich(`{star} Stufe ${u.lvl}! +${u.coins} {coin}${u.pack ? ' · Gratis-Paket' : ''}${u.slot ? ' · neuer Deck-Platz!' : ''}`))); }
    if (out.ups.length) setTimeout(() => sfx.levelUp(), 600);
    if (out.rankUp) el.append(h('div', { class: 'lvlup' }, rankBadge(out.rank.idx, out.rank.color, 30), ` Neuer Rang: ${out.rank.name}!`));
    for (const q of out.questsDone) el.append(h('div', { class: 'rw' }, h('span', { class: 'gold' }, rich(`{scroll} Aufgabe erledigt: ${q}`))));
    this.refreshHeader();
  }

  // ============================================================ ZAUBER
  sSpells(el) {
    const st = this.store, d = st.d, slots = st.slots;
    const deckRow = h('div', { class: 'deckrow' });
    for (let i = 0; i < 8; i++) {
      const id = d.deck[i];
      if (id) { const sp = SPELL_BY_ID[id]; deckRow.append(h('button', { class: 'dslot pn', style: `--c:${RARITIES[sp.rarity].color}`, onclick: () => this.detail(id) }, icon(sp, 72), h('small', {}, sp.name))); }
      else if (i < slots) deckRow.append(h('div', { class: 'dslot pn empty' }, ico('plus')));
      else deckRow.append(h('div', { class: 'dslot pn lock' }, ico('lock'), h('small', {}, i === 6 ? 'Stufe 5' : 'Stufe 10')));
    }
    const head = h('div', { class: 'deckbox pn' }, h('div', { class: 'dh' }, h('b', {}, 'Dein Deck'), h('small', {}, `${d.deck.length}/${slots} · Tippe für Details`)), deckRow);
    const filters = [['all', 'Alle'], ['deck', 'Im Deck'], ...RARITY_ORDER.map((r) => [r, rarName(r)])];
    const bar = h('div', { class: 'chips' }, ...filters.map(([k, label]) => h('button', { class: 'chip2' + (this.filter === k ? ' on' : ''), style: RARITIES[k] ? `--c:${RARITIES[k].color}` : '', onclick: () => { sfx.click(); this.filter = k; this.show('spells'); } }, label)));
    const list = SPELLS.filter((s) => this.filter === 'all' || (this.filter === 'deck' ? st.inDeck(s.id) : s.rarity === this.filter));
    const grid = h('div', { class: 'grid' }, ...list.map((sp) => this.card(sp)));
    el.append(h('div', { class: 'pad' }, head, h('div', { class: 'cnt' }, `Gesammelt: ${st.ownedCount()}/${SPELLS.length}`), bar, grid));
  }
  card(sp) {
    const st = this.store, own = st.owned(sp.id), lv = st.spellLevel(sp.id), nx = st.nextCopies(sp.id), c = st.copies(sp.id);
    const gems = h('div', { class: 'gems' }, ...Array.from({ length: RARITY_ORDER.indexOf(sp.rarity) + 1 }, () => h('i')));
    const pips = h('div', { class: 'cb' }, ...Array.from({ length: MAX_LEVEL }, (_, i) => h('i', { class: i < lv ? 'f' : '' })));
    return h('button', { class: `card pn r-${sp.rarity}` + (own ? '' : ' locked') + (st.inDeck(sp.id) ? ' indeck' : ''), style: `--c:${RARITIES[sp.rarity].color};--g:${sp.color}`, onclick: () => { sfx.click(); this.detail(sp.id); } },
      gems, h('div', { class: 'art' }, icon(sp, 112)), h('b', {}, own ? sp.name : '???'), own ? pips : h('small', {}, rarName(sp.rarity)),
      own ? h('em', { class: 'lvb' }, lv >= MAX_LEVEL ? 'MAX' : `Lv ${lv}`) : null, own ? h('span', { class: 'cc' }, nx ? `${c}/${nx}` : `${c}`) : h('span', { class: 'lk' }, ico('lock')), st.inDeck(sp.id) ? h('span', { class: 'dk' }, ico('check')) : null);
  }
  detail(id) {
    const st = this.store, sp = SPELL_BY_ID[id], own = st.owned(id), lv = Math.max(1, st.spellLevel(id)), R = RARITIES[sp.rarity];
    const stars = RARITY_ORDER.indexOf(sp.rarity) + 1;
    const parts = describeParts(sp, lv).map((p) => h('li', {}, nameIco(p.i), p.t));
    const nx = st.nextCopies(id), c = st.copies(id);
    const body = h('div', { class: 'det', style: `--c:${R.color};--g:${sp.color}` },
      h('div', { class: 'dt' }, h('div', { class: 'big pn' }, icon(sp, 200)), h('div', { class: 'dn' }, h('small', { style: `color:${R.color}` }, rarName(sp.rarity).toUpperCase() + ' · ', nameIco(ROLE_ICON[roleOf(sp)])), h('h3', {}, sp.name), h('div', { class: 'diff' }, 'Schwierigkeit ', h('b', {}, h('span', { class: 'stars' }, ...Array.from({ length: 5 }, (_, k) => ico('star', k < stars ? '' : 'dim')))), h('small', {}, `Genauigkeit ab ${Math.round(spellThr(sp) * 100)} %`)))),
      h('p', { class: 'lore' }, sp.lore),
      h('div', { class: 'stats3' }, h('div', { class: 'pn' }, h('b', {}, ico('drop'), sp.cost), h('small', {}, 'Mana')), h('div', { class: 'pn' }, h('b', {}, ico('clock'), `${sp.cd} s`), h('small', {}, 'Abklingzeit')), h('div', { class: 'pn' }, h('b', {}, ico('wind'), sp.travel == null ? 'sofort' : `${sp.travel} s`), h('small', {}, 'Flugzeit'))),
      h('ul', { class: 'parts' }, ...parts),
      own ? h('div', { class: 'lvbox' }, h('div', {}, `Stufe ${lv}${lv >= MAX_LEVEL ? ' (MAX)' : ''} · ${c} Kopien`), nx ? h('small', {}, `Noch ${nx - c} Kopie${nx - c === 1 ? '' : 'n'} bis Stufe ${lv + 1} (+7 % Stärke)`) : h('small', {}, 'Höchste Stufe erreicht')) : h('div', { class: 'lvbox' }, h('div', {}, ico('lock'), ' Noch nicht freigeschaltet'), h('small', {}, 'Öffne Zauberpakete im Shop, um ihn zu bekommen.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onclick: () => { m.close(); this.practice(id); } }, ico('target'), 'Üben'),
        own ? (st.inDeck(id) ? h('button', { class: 'btn red', onclick: () => { if (!st.removeFromDeck(id)) this.toast('Mindestens 3 Zauber im Deck'); else sfx.back(); m.close(); this.show('spells'); } }, 'Aus Deck') : h('button', { class: 'btn', onclick: () => this.addDeck(id, m) }, 'Ins Deck')) : h('button', { class: 'btn', onclick: () => { m.close(); this.show('shop'); } }, 'Zum Shop')));
    const m = this.modal(body, { cls: 'detm' });
  }
  addDeck(id, m) {
    const st = this.store;
    if (st.addToDeck(id)) { sfx.good(); m.close(); this.show('spells'); return; }
    // Deck voll: Ersatz wählen
    m.close();
    const pick = this.modal(h('div', {}, h('h3', {}, 'Welchen Zauber ersetzen?'), h('div', { class: 'grid small' }, ...st.d.deck.map((rid) => { const sp = SPELL_BY_ID[rid]; return h('button', { class: `card pn r-${sp.rarity}`, style: `--c:${RARITIES[sp.rarity].color};--g:${sp.color}`, onclick: () => { st.addToDeck(id, rid); sfx.good(); pick.close(); this.show('spells'); } }, h('div', { class: 'art' }, icon(sp, 80)), h('b', {}, sp.name)); }))));
  }
  practice(id) {
    unlock(); const st = this.store, own = st.owned(id), sp = SPELL_BY_ID[id];
    const prof = { ...this.profile(), deck: [id, ...st.d.deck.filter((x) => x !== id).slice(0, 2)], };
    prof.levels = Object.fromEntries(prof.deck.map((x) => [x, Math.max(1, st.spellLevel(x))]));
    this.root.hidden = true; this.hero.stop();
    this.battle.play(prof, { mode: 'practice', level: 0, ghost: id });
    if (!own) this.toast('Probemodus: Du kannst die Form schon üben');
  }

  // ============================================================ SHOP
  sShop(el) {
    const st = this.store, d = st.d;
    this.shopTab = this.shopTab || 'packs';
    const seg = h('div', { class: 'seg' }, ...[['packs', 'gift', 'Pakete'], ['skins', 'crown', 'Garderobe']].map(([k, ic, l]) => h('button', { class: this.shopTab === k ? 'on' : '', onclick: () => { sfx.click(); this.shopTab = k; this.show('shop'); } }, ico(ic), l)));
    const box = h('div', { class: 'pad' }, seg);
    if (this.shopTab === 'packs') {
      if (d.freePacks > 0) box.append(h('button', { class: 'gift pack pn', onclick: () => this.openPack('basic', true) }, ico('pack'), h('div', {}, h('b', {}, `${d.freePacks}× Gratis-Paket`), h('small', {}, 'Tippe zum Öffnen'))));
      for (const P of Object.values(PACKS)) {
        const can = d.coins >= P.price;
        box.append(h('div', { class: 'pack-t pn ' + P.id, style: `--c:${P.color}` },
          h('div', { class: 'pk', 'aria-hidden': true }, ico(P.id === 'basic' ? 'sparkle' : 'crown')),
          h('div', { class: 'pi' }, h('b', {}, P.name), h('small', {}, `${P.cards} Zauber · mindestens ${P.id === 'basic' ? '1 Seltener' : '1 Epischer'}`), h('button', { class: 'btn price' + (can ? '' : ' dis'), onclick: () => can ? this.openPack(P.id, false) : this.toast('Nicht genug Münzen – kämpfe oder erledige Aufgaben') }, ico('coin'), P.price))));
      }
      box.append(h('button', { class: 'linkbtn', onclick: () => this.oddsInfo() }, ico('info'), 'Wahrscheinlichkeiten anzeigen'));
      const pity = d.pity; box.append(h('p', { class: 'mut c' }, `Pech-Schutz: garantiert Legendär nach höchstens 35 Paketen ohne (aktuell ${pity.legendary}), Mythisch nach 120 (aktuell ${pity.mythic}).`));
    } else {
      const grid = h('div', { class: 'skins' });
      for (const s of SKINS) {
        const own = st.skinUnlocked(s) || s.how === 'free', avail = st.skinAvailable(s), worn = d.skin === s.id;
        const cv = h('canvas', { width: 84, height: 84 }); drawAvatar(cv, { robe: s.robe, trim: s.trim, hat: s.hat }, 84);
        let act;
        if (worn) act = h('span', { class: 'worn' }, ico('check'), 'Getragen');
        else if (own || avail) act = h('button', { class: 'btn sm', onclick: () => { st.wear(s.id); sfx.good(); this.show('shop'); } }, 'Anziehen');
        else if (s.how === 'coins') act = h('button', { class: 'btn sm price' + (d.coins >= s.price ? '' : ' dis'), onclick: () => { if (st.buySkin(s.id)) { st.wear(s.id); sfx.coin(); this.show('shop'); } else this.toast('Nicht genug Münzen'); } }, ico('coin'), s.price);
        else act = h('small', { class: 'lockt' }, ico('lock'), s.how === 'level' ? `Stufe ${s.level}` : h('span', {}, s.trophies, ' ', ico('trophy')));
        grid.append(h('div', { class: 'skin pn' + (worn ? ' worn' : '') }, cv, h('b', {}, s.name), act));
      }
      box.append(grid);
    }
    el.append(box);
  }
  oddsInfo() {
    const names = RARITY_ORDER.map(rarName);
    const rows = (odds) => { const t = odds.reduce((a, b) => a + b, 0); return odds.map((o, i) => h('tr', {}, h('td', { style: `color:${RARITIES[RARITY_ORDER[i]].color}` }, names[i]), h('td', {}, o ? (100 * o / t).toFixed(o / t < 0.01 ? 2 : 1) + ' %' : '–'))); };
    this.modal(h('div', { class: 'odds' }, h('h3', {}, 'Wahrscheinlichkeiten'),
      ...Object.values(PACKS).map((P) => h('div', {}, h('b', {}, P.name), h('small', { class: 'mut' }, ` · je Karte (außer der letzten)`), h('table', {}, ...rows(P.odds)), h('small', { class: 'mut' }, 'Letzte Karte:'), h('table', {}, ...rows(P.lastOdds)))),
      h('p', { class: 'mut' }, 'Neue Zauber werden etwas bevorzugt. Doppelte Karten erhöhen die Stufe des Zaubers (1, 2, 4, 8, 16, 32 Kopien). Über Stufe 6 gibt es Münzen zurück.')));
  }
  openPack(type, free) {
    unlock();
    const st = this.store, P = PACKS[type];
    if (!free && st.d.coins < P.price) return this.toast('Nicht genug Münzen');
    const cards = st.openPack(type, free); if (!cards) return this.toast('Paket nicht verfügbar');
    this.refreshHeader();
    packFlow(this, P, cards, () => this.refresh());
  }

  // ============================================================ AUFGABEN
  sQuests(el) {
    const st = this.store, d = st.d; st.ensureQuests();
    const li = levelInfo(d.xp), box = h('div', { class: 'pad' });
    const nextSlot = li.lvl < 5 ? 5 : li.lvl < 10 ? 10 : null;
    box.append(h('div', { class: 'lvcard pn' }, h('div', { class: 'lvn' }, li.lvl), h('div', { class: 'lvi' }, h('b', {}, `Stufe ${li.lvl}`), h('div', { class: 'xpb' }, h('i', { style: `transform:scaleX(${li.into / li.need})` })), h('small', {}, rich(`${li.into}/${li.need} XP · nächste Belohnung: ${levelReward(li.lvl + 1).coins} {coin}${(li.lvl + 1) % 3 === 0 ? ' + Paket' : ''}${nextSlot ? ` · Deck-Platz bei Stufe ${nextSlot}` : ''}`)))));
    if (st.dailyReady()) box.append(h('button', { class: 'gift pn', onclick: () => this.claimDaily() }, ico('gift'), h('div', {}, h('b', {}, 'Tagesgeschenk'), h('small', {}, `Tag ${Math.min(7, d.daily.streak + 1)}/7 – Serie bringt mehr!`))));
    else box.append(h('div', { class: 'gift done pn' }, ico('check'), h('div', {}, h('b', {}, 'Tagesgeschenk abgeholt'), h('small', {}, `Serie: ${d.daily.streak}/7 · Morgen wieder!`))));
    box.append(h('h4', {}, 'Tagesaufgaben'));
    d.quests.list.forEach((q, i) => {
      const done = st.questDone(q);
      box.append(h('div', { class: 'quest pn' + (q.claimed ? ' claimed' : '') }, h('div', { class: 'qi' }, h('b', {}, q.text), h('div', { class: 'qb' }, h('i', { style: `transform:scaleX(${q.prog / q.goal})` })), h('small', {}, `${Math.min(q.prog, q.goal)}/${q.goal}`)),
        q.claimed ? h('span', { class: 'ck' }, ico('check')) : h('button', { class: 'btn sm price' + (done ? ' shine' : ' dis'), onclick: () => { if (!done) return; const r = st.claimQuest(i); sfx.coin(); coinFall(8); this.toast(`+${r} {coin}`); this.show('quests'); } }, ico('coin'), q.reward)));
    });
    box.append(h('h4', {}, 'Ränge'));
    const cur = st.rank.idx;
    box.append(h('div', { class: 'ranks' }, ...RANKS.map((r, i) => h('div', { class: 'rk pn' + (i === cur ? ' cur' : i < cur ? ' past' : ''), style: `--c:${r.color}` }, rankBadge(i, r.color, 34), h('b', {}, r.name), h('small', {}, `ab ${r.min}`, ico('trophy'))))));
    el.append(box);
  }

  // ============================================================ MEHR
  sMore(el) {
    const st = this.store, d = st.d, s = d.settings, box = h('div', { class: 'pad' });
    const nameIn = h('input', { class: 'inp', maxlength: 14, value: d.name, placeholder: 'Dein Name' });
    nameIn.onchange = () => { st.setName(nameIn.value); nameIn.value = st.d.name; this.toast('Name gespeichert'); };
    box.append(h('h4', {}, 'Profil'), h('div', { class: 'card2 pn' }, h('label', {}, 'Name'), nameIn));
    const tot = d.stats.wins + d.stats.losses + d.stats.draws;
    box.append(h('div', { class: 'stg' }, ...[['trophy', d.trophies, 'Trophäen'], ['crown', d.bestTrophies, 'Bestwert'], ['check', d.stats.wins, 'Siege'], ['bolt', tot ? Math.round(100 * d.stats.wins / tot) + ' %' : '–', 'Siegquote'], ['flame', d.stats.bestStreak, 'Beste Serie'], ['book', `${st.ownedCount()}/${SPELLS.length}`, 'Zauber'], ['pack', d.stats.packs, 'Pakete'], ['sparkle', d.stats.casts, 'Zauber gewirkt']].map(([i, v, l]) => h('div', { class: 'pn' }, ico(i), h('b', {}, v), h('small', {}, l)))));
    box.append(h('h4', {}, 'Einstellungen'));
    const tog = (label, key) => h('button', { class: 'tg' + (s[key] ? ' on' : ''), onclick: () => { s[key] = !s[key]; st.save(); this.applyAudio(); sfx.click(); this.show('more'); } }, h('span', {}, label), h('i'));
    const vol = h('input', { type: 'range', min: 0, max: 100, value: Math.round(s.volume * 100), class: 'rng', oninput: () => { s.volume = vol.value / 100; audio.setVolume(s.volume); }, onchange: () => { st.save(); sfx.click(); } });
    box.append(h('div', { class: 'card2 pn' }, tog('Soundeffekte', 'sound'), tog('Musik', 'music'), h('div', { class: 'vr' }, h('span', {}, 'Lautstärke'), vol), tog('Vibration', 'vibe'), tog('Weniger Effekte (für ältere Handys)', 'fxLow')));
    box.append(h('button', { class: 'btn ghost block', onclick: () => this.startTutorial() }, ico('graduation'), 'Tutorial wiederholen'));
    box.append(h('h4', {}, 'Fortschritt sichern'), h('div', { class: 'row' },
      h('button', { class: 'btn ghost sm', onclick: () => this.exportDlg() }, 'Code anzeigen'), h('button', { class: 'btn ghost sm', onclick: () => this.importDlg() }, 'Code einlesen')),
      h('p', { class: 'mut' }, 'Der Spielstand liegt nur in diesem Browser. Mit dem Code kannst du ihn sichern oder auf ein anderes Gerät mitnehmen.'));
    box.append(h('button', { class: 'btn ghost block red', onclick: () => this.confirm('Wirklich ALLES löschen? Zauber, Münzen und Fortschritt sind dann weg.', () => { st.reset(); this.hero.size(); this.refresh(); this.toast('Zurückgesetzt'); }, 'Löschen') }, ico('trash'), 'Fortschritt zurücksetzen'));
    box.append(h('p', { class: 'mut c' }, 'Spells · Version 3'));
    el.append(box);
  }
  exportDlg() {
    const code = this.store.exportCode();
    const m = this.modal(h('div', {}, h('h3', {}, 'Dein Fortschritts-Code'), h('p', { class: 'mut' }, 'Kopiere den Text und bewahre ihn sicher auf.'), h('div', { class: 'code' }, code),
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(code); this.toast('Kopiert!'); } catch { this.toast('Bitte den Text von Hand markieren'); } } }, 'Kopieren'))));
  }
  importDlg() {
    const ta = h('textarea', { class: 'inp', rows: 4, placeholder: 'Code hier einfügen (SP2-…)' });
    const m = this.modal(h('div', {}, h('h3', {}, 'Code einlesen'), h('p', { class: 'mut' }, 'Achtung: Dein aktueller Fortschritt wird ersetzt.'), ta,
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: () => { if (this.store.importCode(ta.value)) { m.close(); this.toast('Fortschritt geladen!'); this.hero.size(); this.refresh(); } else this.toast('Dieser Code ist ungültig'); } }, 'Laden'))));
  }

  // ============================================================ TUTORIAL
  welcome() {
    this.store.d.seen.welcome = true; this.store.save();
    const nameIn = h('input', { class: 'inp', maxlength: 14, value: '', placeholder: 'Wie heißt du, Zauberer?' });
    const m = this.modal(h('div', { class: 'welcome' }, h('div', { class: 'wl' }, ico('wands')), h('h2', {}, 'Willkommen bei Spells!'), h('p', {}, 'Zeichne Formen auf den Bildschirm – dein Zauber wird sofort erkannt und gewirkt. Sammle Zauber, steige im Rang auf und besiege andere Magier.'), nameIn,
      h('button', { class: 'btn big', onclick: () => { if (nameIn.value.trim()) this.store.setName(nameIn.value); m.close(); this.startTutorial(); } }, 'Los geht\'s – kurzes Tutorial'), h('button', { class: 'linkbtn', onclick: () => { if (nameIn.value.trim()) this.store.setName(nameIn.value); m.close(); } }, 'Überspringen')), { close: false });
  }
  startTutorial() {
    unlock(); this.tut = { step: 0 };
    const prof = this.profile(); prof.deck = STARTER.slice(); prof.levels = Object.fromEntries(STARTER.map((i) => [i, 1]));
    this.root.hidden = true; this.hero.stop();
    this.battle.play(prof, { mode: 'tutorial', level: 0, theme: 'wald' });
  }
  tutStart(b) {
    this.tut = { step: 0 };
    this.tutSet(b, 0);
  }
  tutSet(b, step) {
    this.tut.step = step;
    const skip = () => { b.coach(null); this.tut.step = 9; };
    const T = [
      ['Zeichne einen <b>Kreis</b> irgendwo auf den Bildschirm – das wirkt den <b>Feuerball</b>.<br><small>Die Form siehst du auch auf dem Symbol unten in der Leiste.</small>', 'feuerball'],
      ['Stark! Jeder Zauber kostet <b>Mana</b> und hat eine <b>Abklingzeit</b>. Jetzt ein <b>senkrechter Strich</b> von oben nach unten: <b>Eissplitter</b>.', 'eissplitter'],
      ['Klasse! Tippe auf ein Symbol in der Leiste, um dir die Form <b>einblenden</b> zu lassen. Besiege nun die Übungspuppe – beide dürfen jederzeit zeichnen!', null],
    ][step];
    if (!T) return;
    b.coach(T[0], { skip }); if (T[1]) { b.toggleGhostTo(T[1]); } else b.toggleGhostTo(null);
  }
  tutEvent(e, b) {
    if (e.k !== 'cast' || e.p !== b.you || this.tut.step > 2) return;
    const need = ['feuerball', 'eissplitter'][this.tut.step];
    if (need && e.id === need) { sfx.good(); this.tutSet(b, this.tut.step + 1); }
    else if (this.tut.step === 2) { b.coach(null); this.tut.step = 3; }
  }
}

// ------------------------------------------------------------ Paket-Öffnung
function packFlow(app, P, cards, done) {
  const ov = h('div', { class: 'pk-ov' });
  document.body.append(ov);
  const maxR = Math.max(...cards.map((c) => RARITY_ORDER.indexOf(c.rarity)));
  const stage = h('div', { class: 'pk-stage' }); ov.append(stage);
  const pack = h('button', { class: 'pk-pack ' + P.id, style: `--c:${P.color}` }, ico(P.id === 'basic' ? 'sparkle' : 'crown'), h('small', {}, 'Tippe zum Öffnen'));
  stage.append(pack);
  let opened = false;
  pack.onclick = async () => {
    if (opened) return; opened = true; unlock();
    for (let i = 0; i < 3; i++) { pack.classList.remove('shake'); void pack.offsetWidth; pack.classList.add('shake'); sfx.packShake(); await sleep(260); }
    pack.classList.add('burst'); ov.style.setProperty('--flash', RARITIES[RARITY_ORDER[maxR]].color); ov.classList.add('flash'); sfx.reveal(maxR >= 3 ? 2 : 0);
    await sleep(380); pack.remove(); showCards();
  };
  function showCards() {
    stage.innerHTML = '';
    const hold = h('div', { class: 'pk-cards' }), info = h('div', { class: 'pk-info' }, 'Tippe, um die Karten aufzudecken');
    stage.append(hold, info);
    const els = cards.map((c, i) => {
      const sp = SPELL_BY_ID[c.id], R = RARITIES[c.rarity];
      const face = h('div', { class: 'face' }, h('small', { class: 'rr', style: `color:${R.color}` }, R.name.toUpperCase()), icon(sp, 200), h('h3', {}, sp.name), c.isNew ? h('span', { class: 'new' }, 'NEU!') : c.refund ? h('span', { class: 'cp' }, rich(`Max-Stufe: +${c.refund} {coin}`)) : h('span', { class: 'cp' }, `Kopie ${c.copies}${c.levelUp ? ' · STUFE ' + c.level + '!' : ''}`));
      const card = h('div', { class: 'pc', style: `--c:${R.color};--g:${sp.color};--i:${i}` }, h('div', { class: 'in' }, h('div', { class: 'back' }, ico('sparkle')), face));
      hold.append(card); return card;
    });
    let cur = -1;
    const reveal = async () => {
      if (cur >= 0 && cur < cards.length) els[cur].classList.add('gone');
      cur++;
      if (cur >= cards.length) { summary(); return; }
      const c = cards[cur], el = els[cur], ri = RARITY_ORDER.indexOf(c.rarity);
      el.classList.add('flip'); sfx.reveal(ri);
      if (ri >= 2) { ov.style.setProperty('--flash', RARITIES[c.rarity].color); ov.classList.remove('flash'); void ov.offsetWidth; ov.classList.add('flash'); }
      if (ri >= 3) { ov.classList.add('rays'); document.body.classList.add('quake'); setTimeout(() => document.body.classList.remove('quake'), 500); } else ov.classList.remove('rays');
      info.textContent = cur < cards.length - 1 ? 'Weiter tippen …' : 'Tippen für die Übersicht';
    };
    stage.onclick = reveal;
  }
  function summary() {
    stage.onclick = null; ov.classList.remove('rays');
    stage.innerHTML = '';
    const total = cards.filter((c) => c.refund).reduce((a, c) => a + c.refund, 0);
    const grid = h('div', { class: 'pk-sum' }, ...cards.map((c) => { const sp = SPELL_BY_ID[c.id]; return h('div', { class: 'sc pn', style: `--c:${RARITIES[c.rarity].color}` }, icon(sp, 100), h('b', {}, sp.name), c.isNew ? h('em', {}, 'NEU') : h('small', {}, c.levelUp ? `Stufe ${c.level}!` : `×${c.copies}`)); }));
    const can = app.store.d.coins >= P.price;
    stage.append(h('h2', {}, 'Deine Beute'), grid, total ? h('p', { class: 'mut' }, rich(`+${total} {coin} Rückerstattung`)) : null,
      h('div', { class: 'row' }, can ? h('button', { class: 'btn ghost price', onclick: () => { close(); app.openPack(P.id, false); } }, 'Nochmal ', ico('coin'), P.price) : null, h('button', { class: 'btn', onclick: () => { close(); } }, 'Fertig')));
    sfx.good();
  }
  function close() { ov.remove(); done(); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
