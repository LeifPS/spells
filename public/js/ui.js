// Menü: Kampf-Startseite, Zauber & Deck, Shop (Pakete, Garderobe), Aufgaben, Mehr, Tutorial.
import { Store, PACKS, RANKS, SKINS, rankOf, levelInfo, deckSlots, levelReward, SKIN_BY_ID, STARTER } from './store.js';
import { SPELLS, SPELL_BY_ID, RARITIES, RARITY_ORDER, LEVEL_COPIES, MAX_LEVEL, levelFor, levelMul, describeParts, roleOf, ROLE_ICON, spellThr } from './spells.js';
import { drawSpellIcon, glow, TAU, clamp, rgba, rnd, easeOut } from './gfx.js';
import { renderBackground, drawWizardArt, drawAvatar, THEME_NAMES } from './scene.js';
import { BOT_LEVELS } from './bot.js';
import { sfx, music, audio, unlock } from './audio.js';

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
    this.build();
    store.onChange(() => this.refreshHeader());
    this.applyAudio();
    this.show('fight');
    if (!store.d.tutorial && !store.d.seen.welcome) setTimeout(() => this.welcome(), 400);
  }
  profile() { return this.store.battleProfile(); }
  toast(t) { const e = document.getElementById('toast'); e.textContent = t; e.className = 'on'; clearTimeout(this._tt); this._tt = setTimeout(() => (e.className = ''), 2800); }
  applyAudio() { const s = this.store.d.settings; audio.setMuted(!s.sound); audio.setVolume(s.volume); audio.setMusic(s.music); music.start('menu'); }

  // ---- Gerüst
  build() {
    const r = this.root; r.innerHTML = '';
    this.hdr = h('header', { class: 'top' });
    this.main = h('main', { class: 'screens' });
    this.nav = h('nav', { class: 'tabs' });
    const tabs = [['fight', '⚔️', 'Kampf'], ['spells', '📖', 'Zauber'], ['shop', '🎁', 'Shop'], ['quests', '🎯', 'Aufgaben'], ['more', '⚙️', 'Mehr']];
    this.tabBtn = {};
    for (const [id, ic, label] of tabs) { const b = h('button', { class: 'tab', onclick: () => { sfx.click(); this.show(id); } }, h('span', { class: 'ti' }, ic), h('small', {}, label), h('i', { class: 'dot' })); this.tabBtn[id] = b; this.nav.append(b); }
    r.append(h('div', { class: 'app' }, this.hdr, this.main, this.nav));
    this.screens = {};
    this.heroCv = h('canvas', { class: 'hero-cv' });
    this.hero = new Hero(this.heroCv, this.store);
    this.refreshHeader();
  }
  refreshHeader() {
    const d = this.store.d, li = levelInfo(d.xp), hdr = this.hdr;
    if (!this.hdrBuilt) {
      this.av = h('canvas', { class: 'hav', width: 44, height: 44 });
      this.hdrName = h('b'); this.hdrLv = h('small'); this.hdrXp = h('i');
      this.coinEl = h('span', { class: 'pill coin' });
      this.sndBtn = h('button', { class: 'pill', onclick: () => { unlock(); const s = this.store.d.settings; s.sound = !s.sound; this.store.save(); this.applyAudio(); sfx.click(); } });
      hdr.append(h('div', { class: 'who', onclick: () => this.show('more') }, this.av, h('div', { class: 'wi' }, this.hdrName, h('div', { class: 'xpb' }, this.hdrXp), this.hdrLv)), h('div', { class: 'pills' }, this.coinEl, this.sndBtn));
      this.hdrBuilt = true;
    }
    this.hdrName.textContent = d.name; this.hdrLv.textContent = `Stufe ${li.lvl} · ${li.into}/${li.need} XP`; this.hdrXp.style.transform = `scaleX(${li.into / li.need})`;
    this.coinEl.textContent = `🪙 ${fmt(d.coins)}`; this.sndBtn.textContent = d.settings.sound ? '🔊' : '🔇';
    const sk = JSON.stringify(this.store.skinData()); if (this._sk !== sk) { this._sk = sk; drawAvatar(this.av, this.store.skinData(), 44); }
    this.tabBtn.quests.classList.toggle('has', this.store.dailyReady() || d.quests.list.some((q) => !q.claimed && this.store.questDone(q)));
    this.tabBtn.shop.classList.toggle('has', d.freePacks > 0);
  }
  refresh() { this.refreshHeader(); this.show(this.tab, true); }
  show(tab, keep) {
    this.tab = tab;
    for (const [id, b] of Object.entries(this.tabBtn)) b.classList.toggle('on', id === tab);
    this.main.innerHTML = ''; this.main.scrollTop = 0;
    this.hero.stop();
    const fn = { fight: (e) => this.sFight(e), spells: (e) => this.sSpells(e), shop: (e) => this.sShop(e), quests: (e) => this.sQuests(e), more: (e) => this.sMore(e) }[tab];
    const el = h('section', { class: 'screen ' + tab }); this.main.append(el); fn(el);
    this.refreshHeader();
  }

  // ---- Modal
  modal(content, { cls = '', close = true } = {}) {
    const ov = h('div', { class: 'modal-ov', onclick: (e) => { if (e.target === ov && close) end(); } });
    const end = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 180); };
    const card = h('div', { class: 'modal ' + cls }, close ? h('button', { class: 'x', onclick: () => { sfx.back(); end(); } }, '✕') : null, content);
    ov.append(card); document.body.append(ov); return { close: end, ov, card };
  }
  confirm(text, yes, label = 'Ja') { const m = this.modal(h('div', { class: 'cf' }, h('p', {}, text), h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Abbrechen'), h('button', { class: 'btn red', onclick: () => { m.close(); yes(); } }, label))), { close: true }); }

  // ============================================================ KAMPF
  sFight(el) {
    const st = this.store, d = st.d, rk = st.rank;
    const rankTxt = rk.next ? `${d.trophies - rk.min} / ${rk.next.min - rk.min} bis ${rk.next.name}` : 'Höchster Rang!';
    const badge = h('div', { class: 'rankcard' }, h('div', { class: 'ri', style: `--c:${rk.color}` }, rk.icon), h('div', { class: 'rt' }, h('b', { style: `color:${rk.color}` }, rk.name), h('div', { class: 'rb' }, h('i', { style: `transform:scaleX(${rk.prog});background:${rk.color}` })), h('small', {}, rankTxt)), h('div', { class: 'tr' }, '🏆 ' + fmt(d.trophies)));
    const hero = h('div', { class: 'hero' }, this.heroCv, badge);
    const deck = h('div', { class: 'deckstrip', onclick: () => { sfx.click(); this.show('spells'); } }, ...d.deck.map((id) => h('div', { class: 'ds', style: `--c:${RARITIES[SPELL_BY_ID[id].rarity].color}` }, icon(SPELL_BY_ID[id], 64))), h('span', { class: 'edit' }, '✎'));
    const go = h('button', { class: 'btn big fightbtn', onclick: () => this.fight() }, h('span', {}, '⚔️ Kämpfen'), h('small', {}, 'Online gegen Spieler'));
    const tr = h('button', { class: 'btn ghost', onclick: () => this.trainMenu() }, '🎯 Training');
    const daily = this.store.dailyReady() ? h('button', { class: 'gift', onclick: () => this.claimDaily() }, h('span', {}, '🎁'), h('div', {}, h('b', {}, 'Tagesgeschenk'), h('small', {}, 'Jetzt abholen!'))) : null;
    const free = d.freePacks > 0 ? h('button', { class: 'gift pack', onclick: () => this.openPack('basic', true) }, h('span', {}, '📦'), h('div', {}, h('b', {}, `${d.freePacks}× Gratis-Paket`), h('small', {}, 'Jetzt öffnen!'))) : null;
    el.append(hero, h('div', { class: 'pad' }, go, h('div', { class: 'row' }, tr, h('button', { class: 'btn ghost', onclick: () => this.show('spells') }, '📖 Deck')), deck, daily, free, this.dailyQuestPeek()));
    this.hero.setDeck(); this.hero.size(); this.hero.start();
  }
  dailyQuestPeek() {
    const qs = this.store.d.quests.list;
    return h('div', { class: 'peek', onclick: () => this.show('quests') }, h('b', {}, '🎯 Tagesaufgaben'), ...qs.map((q) => h('div', { class: 'pq' + (q.claimed ? ' done' : '') }, h('span', {}, q.text), h('em', {}, q.claimed ? '✓' : `${Math.min(q.prog, q.goal)}/${q.goal}`))));
  }
  fight() {
    unlock();
    if (!this.store.deckOk()) return this.toast('Dein Deck braucht mindestens 3 Zauber');
    sfx.click(); this.root.hidden = true; this.hero.stop();
    this.battle.play(this.profile(), { mode: 'online' });
  }
  trainMenu() {
    sfx.click();
    const opts = [[0, '🪵', 'Übungspuppe', 'Greift nicht an – zum Üben der Formen'], [1, '🌱', 'Leicht', 'Wirkt langsam und patzt oft'], [2, '🔥', 'Mittel', 'Nutzt Schilde, Heilung und Kombos'], [3, '💀', 'Schwer', 'Schnell, präzise, gnadenlos']];
    const m = this.modal(h('div', {}, h('h3', {}, 'Training'), h('p', { class: 'mut' }, 'Kein Risiko – etwas Erfahrung, aber keine Trophäen.'), ...opts.map(([lv, ic, name, desc]) => h('button', { class: 'opt', onclick: () => { m.close(); this.startTrain(lv); } }, h('span', { class: 'oi' }, ic), h('div', {}, h('b', {}, name), h('small', {}, desc))))));
  }
  startTrain(level) { unlock(); if (!this.store.deckOk()) return this.toast('Dein Deck braucht mindestens 3 Zauber'); this.root.hidden = true; this.hero.stop(); this.battle.play(this.profile(), { mode: 'train', level }); }
  claimDaily() {
    const r = this.store.claimDaily(); if (!r) return; sfx.coin();
    this.toast(`+${r.coins} 🪙 · Serie ${r.streak}/7${r.pack ? ' · Gratis-Paket!' : ''}`); this.refresh();
  }

  // ---- Ergebnis nach dem Kampf
  renderResult(res, el) {
    const out = this.store.applyResult(res);
    if (out.practice) { el.append(h('p', { class: 'mut' }, 'Übungskampf – keine Belohnung.')); return; }
    const chips = [];
    if (out.trophies) chips.push(h('span', { class: out.trophies > 0 ? 'up' : 'down' }, `🏆 ${out.trophies > 0 ? '+' : ''}${out.trophies}`));
    if (out.coins) chips.push(h('span', { class: 'gold' }, `🪙 +${out.coins}`));
    if (out.xp) chips.push(h('span', {}, `✨ +${out.xp} XP`));
    if (out.pack) chips.push(h('span', { class: 'gold' }, '📦 Gratis-Paket'));
    el.append(h('div', { class: 'rw' }, ...chips));
    for (const u of out.ups) { el.append(h('div', { class: 'lvlup' }, `⭐ Stufe ${u.lvl}! +${u.coins} 🪙${u.pack ? ' · Gratis-Paket' : ''}${u.slot ? ' · neuer Deck-Platz!' : ''}`)); }
    if (out.ups.length) setTimeout(() => sfx.levelUp(), 600);
    if (out.rankUp) el.append(h('div', { class: 'lvlup' }, `${out.rank.icon} Neuer Rang: ${out.rank.name}!`));
    for (const q of out.questsDone) el.append(h('div', { class: 'rw' }, h('span', { class: 'gold' }, `🎯 Aufgabe erledigt: ${q}`)));
    this.refreshHeader();
  }

  // ============================================================ ZAUBER
  sSpells(el) {
    const st = this.store, d = st.d, slots = st.slots;
    const deckRow = h('div', { class: 'deckrow' });
    for (let i = 0; i < 8; i++) {
      const id = d.deck[i];
      if (id) { const sp = SPELL_BY_ID[id]; deckRow.append(h('button', { class: 'dslot', style: `--c:${RARITIES[sp.rarity].color}`, onclick: () => this.detail(id) }, icon(sp, 72), h('small', {}, sp.name))); }
      else if (i < slots) deckRow.append(h('div', { class: 'dslot empty' }, '+'));
      else deckRow.append(h('div', { class: 'dslot lock' }, h('span', {}, '🔒'), h('small', {}, i === 6 ? 'Stufe 5' : 'Stufe 10')));
    }
    const head = h('div', { class: 'deckbox' }, h('div', { class: 'dh' }, h('b', {}, 'Dein Deck'), h('small', {}, `${d.deck.length}/${slots} · Tippe für Details`)), deckRow);
    const filters = [['all', 'Alle'], ['deck', 'Im Deck'], ...RARITY_ORDER.map((r) => [r, rarName(r)])];
    const bar = h('div', { class: 'chips' }, ...filters.map(([k, label]) => h('button', { class: 'chip2' + (this.filter === k ? ' on' : ''), style: RARITIES[k] ? `--c:${RARITIES[k].color}` : '', onclick: () => { sfx.click(); this.filter = k; this.show('spells'); } }, label)));
    const list = SPELLS.filter((s) => this.filter === 'all' || (this.filter === 'deck' ? st.inDeck(s.id) : s.rarity === this.filter));
    const grid = h('div', { class: 'grid' }, ...list.map((sp) => this.card(sp)));
    el.append(h('div', { class: 'pad' }, head, h('div', { class: 'cnt' }, `Gesammelt: ${st.ownedCount()}/${SPELLS.length}`), bar, grid));
  }
  card(sp) {
    const st = this.store, own = st.owned(sp.id), lv = st.spellLevel(sp.id), nx = st.nextCopies(sp.id), c = st.copies(sp.id);
    const prevNeed = lv > 0 ? LEVEL_COPIES[lv - 1] : 0;
    const frac = nx ? (c - prevNeed) / (nx - prevNeed) : 1;
    const b = h('button', { class: 'card' + (own ? '' : ' locked') + (st.inDeck(sp.id) ? ' indeck' : ''), style: `--c:${RARITIES[sp.rarity].color};--g:${sp.color}`, onclick: () => { sfx.click(); this.detail(sp.id); } },
      icon(sp, 112), h('b', {}, own ? sp.name : '???'), own ? h('div', { class: 'cb' }, h('i', { style: `transform:scaleX(${frac})` })) : h('small', {}, rarName(sp.rarity)),
      own ? h('em', { class: 'lvb' }, lv >= MAX_LEVEL ? 'MAX' : `Lv ${lv}`) : null, own ? h('span', { class: 'cc' }, nx ? `${c}/${nx}` : `${c}`) : h('span', { class: 'lk' }, '🔒'), st.inDeck(sp.id) ? h('span', { class: 'dk' }, '✓') : null);
    return b;
  }
  detail(id) {
    const st = this.store, sp = SPELL_BY_ID[id], own = st.owned(id), lv = Math.max(1, st.spellLevel(id)), R = RARITIES[sp.rarity];
    const stars = RARITY_ORDER.indexOf(sp.rarity) + 1;
    const parts = describeParts(sp, lv).map((p) => h('li', {}, h('span', {}, p.i), p.t));
    const nx = st.nextCopies(id), c = st.copies(id);
    const body = h('div', { class: 'det', style: `--c:${R.color};--g:${sp.color}` },
      h('div', { class: 'dt' }, h('div', { class: 'big' }, icon(sp, 200)), h('div', { class: 'dn' }, h('small', { style: `color:${R.color}` }, rarName(sp.rarity).toUpperCase() + ' · ' + ROLE_ICON[roleOf(sp)] + '\uFE0F'), h('h3', {}, sp.name), h('div', { class: 'diff' }, 'Schwierigkeit ', h('b', {}, h('span', {}, '★'.repeat(stars)), h('span', { style: 'opacity:.25' }, '★'.repeat(5 - stars))), h('small', {}, `Genauigkeit ab ${Math.round(spellThr(sp) * 100)} %`)))),
      h('p', { class: 'lore' }, sp.lore),
      h('div', { class: 'stats3' }, h('div', {}, h('b', {}, `💧 ${sp.cost}`), h('small', {}, 'Mana')), h('div', {}, h('b', {}, `⏱ ${sp.cd} s`), h('small', {}, 'Abklingzeit')), h('div', {}, h('b', {}, sp.travel == null ? 'sofort' : `${sp.travel} s`), h('small', {}, 'Flugzeit'))),
      h('ul', { class: 'parts' }, ...parts),
      own ? h('div', { class: 'lvbox' }, h('div', {}, `Stufe ${lv}${lv >= MAX_LEVEL ? ' (MAX)' : ''} · ${c} Kopien`), nx ? h('small', {}, `Noch ${nx - c} Kopie${nx - c === 1 ? '' : 'n'} bis Stufe ${lv + 1} (+7 % Stärke)`) : h('small', {}, 'Höchste Stufe erreicht')) : h('div', { class: 'lvbox' }, h('div', {}, '🔒 Noch nicht freigeschaltet'), h('small', {}, 'Öffne Zauberpakete im Shop, um ihn zu bekommen.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onclick: () => { m.close(); this.practice(id); } }, '🎯 Üben'),
        own ? (st.inDeck(id) ? h('button', { class: 'btn red', onclick: () => { if (!st.removeFromDeck(id)) this.toast('Mindestens 3 Zauber im Deck'); else sfx.back(); m.close(); this.show('spells'); } }, 'Aus Deck') : h('button', { class: 'btn', onclick: () => this.addDeck(id, m) }, 'Ins Deck')) : h('button', { class: 'btn', onclick: () => { m.close(); this.show('shop'); } }, 'Zum Shop')));
    const m = this.modal(body, { cls: 'detm' });
  }
  addDeck(id, m) {
    const st = this.store;
    if (st.addToDeck(id)) { sfx.good(); m.close(); this.show('spells'); return; }
    // Deck voll: Ersatz wählen
    m.close();
    const pick = this.modal(h('div', {}, h('h3', {}, 'Welchen Zauber ersetzen?'), h('div', { class: 'grid small' }, ...st.d.deck.map((rid) => { const sp = SPELL_BY_ID[rid]; return h('button', { class: 'card', style: `--c:${RARITIES[sp.rarity].color}`, onclick: () => { st.addToDeck(id, rid); sfx.good(); pick.close(); this.show('spells'); } }, icon(sp, 80), h('b', {}, sp.name)); }))));
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
    const seg = h('div', { class: 'seg' }, ...[['packs', '🎁 Pakete'], ['skins', '🧙 Garderobe']].map(([k, l]) => h('button', { class: this.shopTab === k ? 'on' : '', onclick: () => { sfx.click(); this.shopTab = k; this.show('shop'); } }, l)));
    const box = h('div', { class: 'pad' }, seg);
    if (this.shopTab === 'packs') {
      if (d.freePacks > 0) box.append(h('button', { class: 'gift pack', onclick: () => this.openPack('basic', true) }, h('span', {}, '📦'), h('div', {}, h('b', {}, `${d.freePacks}× Gratis-Paket`), h('small', {}, 'Tippe zum Öffnen'))));
      for (const P of Object.values(PACKS)) {
        const can = d.coins >= P.price;
        box.append(h('div', { class: 'pack-t ' + P.id, style: `--c:${P.color}` },
          h('div', { class: 'pk', 'aria-hidden': true }, h('span', {}, P.id === 'basic' ? '✨' : '👑')),
          h('div', { class: 'pi' }, h('b', {}, P.name), h('small', {}, `${P.cards} Zauber · mindestens ${P.id === 'basic' ? '1 Seltener' : '1 Epischer'}`), h('button', { class: 'btn' + (can ? '' : ' dis'), onclick: () => can ? this.openPack(P.id, false) : this.toast('Nicht genug Münzen – kämpfe oder erledige Aufgaben'), }, `🪙 ${P.price}`))));
      }
      box.append(h('button', { class: 'linkbtn', onclick: () => this.oddsInfo() }, 'ⓘ Wahrscheinlichkeiten anzeigen'));
      const pity = d.pity; box.append(h('p', { class: 'mut c' }, `Pech-Schutz: garantiert Legendär nach höchstens 35 Paketen ohne (aktuell ${pity.legendary}), Mythisch nach 120 (aktuell ${pity.mythic}).`));
    } else {
      const grid = h('div', { class: 'skins' });
      for (const s of SKINS) {
        const own = st.skinUnlocked(s) || s.how === 'free', avail = st.skinAvailable(s), worn = d.skin === s.id;
        const cv = h('canvas', { width: 80, height: 80 }); drawAvatar(cv, { robe: s.robe, trim: s.trim, hat: s.hat }, 80);
        let act;
        if (worn) act = h('span', { class: 'worn' }, 'Getragen');
        else if (own || avail) act = h('button', { class: 'btn sm', onclick: () => { st.wear(s.id); sfx.good(); this.show('shop'); } }, 'Anziehen');
        else if (s.how === 'coins') act = h('button', { class: 'btn sm' + (d.coins >= s.price ? '' : ' dis'), onclick: () => { if (st.buySkin(s.id)) { st.wear(s.id); sfx.coin(); this.show('shop'); } else this.toast('Nicht genug Münzen'); } }, `🪙 ${s.price}`);
        else act = h('small', { class: 'lockt' }, s.how === 'level' ? `🔒 Stufe ${s.level}` : `🔒 ${s.trophies} 🏆`);
        grid.append(h('div', { class: 'skin' + (worn ? ' worn' : '') }, cv, h('b', {}, s.name), act));
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
    box.append(h('div', { class: 'lvcard' }, h('div', { class: 'lvn' }, li.lvl), h('div', { class: 'lvi' }, h('b', {}, `Stufe ${li.lvl}`), h('div', { class: 'xpb big' }, h('i', { style: `transform:scaleX(${li.into / li.need})` })), h('small', {}, `${li.into}/${li.need} XP · nächste Belohnung: ${levelReward(li.lvl + 1).coins} 🪙${(li.lvl + 1) % 3 === 0 ? ' + Paket' : ''}${nextSlot ? ` · Deck-Platz bei Stufe ${nextSlot}` : ''}`))));
    if (st.dailyReady()) box.append(h('button', { class: 'gift', onclick: () => this.claimDaily() }, h('span', {}, '🎁'), h('div', {}, h('b', {}, 'Tagesgeschenk'), h('small', {}, `Tag ${Math.min(7, d.daily.streak + 1)}/7 – Serie bringt mehr!`))));
    else box.append(h('div', { class: 'gift done' }, h('span', {}, '✅'), h('div', {}, h('b', {}, 'Tagesgeschenk abgeholt'), h('small', {}, `Serie: ${d.daily.streak}/7 · Morgen wieder!`))));
    box.append(h('h4', {}, 'Tagesaufgaben'));
    d.quests.list.forEach((q, i) => {
      const done = st.questDone(q);
      box.append(h('div', { class: 'quest' + (q.claimed ? ' claimed' : '') }, h('div', { class: 'qi' }, h('b', {}, q.text), h('div', { class: 'qb' }, h('i', { style: `transform:scaleX(${q.prog / q.goal})` })), h('small', {}, `${Math.min(q.prog, q.goal)}/${q.goal}`)),
        q.claimed ? h('span', { class: 'ck' }, '✓') : h('button', { class: 'btn sm' + (done ? '' : ' dis'), onclick: () => { if (!done) return; const r = st.claimQuest(i); sfx.coin(); this.toast(`+${r} 🪙`); this.show('quests'); } }, `🪙 ${q.reward}`)));
    });
    box.append(h('h4', {}, 'Ränge'));
    const cur = st.rank.idx;
    box.append(h('div', { class: 'ranks' }, ...RANKS.map((r, i) => h('div', { class: 'rk' + (i === cur ? ' cur' : i < cur ? ' past' : ''), style: `--c:${r.color}` }, h('span', {}, r.icon), h('b', {}, r.name), h('small', {}, `ab ${r.min} 🏆`)))));
    el.append(box);
  }

  // ============================================================ MEHR
  sMore(el) {
    const st = this.store, d = st.d, s = d.settings, box = h('div', { class: 'pad' });
    const nameIn = h('input', { class: 'inp', maxlength: 14, value: d.name, placeholder: 'Dein Name' });
    nameIn.onchange = () => { st.setName(nameIn.value); nameIn.value = st.d.name; this.toast('Name gespeichert'); };
    box.append(h('h4', {}, 'Profil'), h('div', { class: 'card2' }, h('label', {}, 'Name'), nameIn));
    const tot = d.stats.wins + d.stats.losses + d.stats.draws;
    box.append(h('div', { class: 'stg' }, ...[['🏆', d.trophies, 'Trophäen'], ['👑', d.bestTrophies, 'Bestwert'], ['✅', d.stats.wins, 'Siege'], ['📊', tot ? Math.round(100 * d.stats.wins / tot) + ' %' : '–', 'Siegquote'], ['🔥', d.stats.bestStreak, 'Beste Serie'], ['📖', `${st.ownedCount()}/${SPELLS.length}`, 'Zauber'], ['🎁', d.stats.packs, 'Pakete'], ['✨', d.stats.casts, 'Zauber gewirkt']].map(([i, v, l]) => h('div', {}, h('span', {}, i), h('b', {}, v), h('small', {}, l)))));
    box.append(h('h4', {}, 'Einstellungen'));
    const tog = (label, key, after) => h('button', { class: 'tg' + (s[key] ? ' on' : ''), onclick: () => { s[key] = !s[key]; st.save(); this.applyAudio(); sfx.click(); this.show('more'); } }, h('span', {}, label), h('i', {}));
    const vol = h('input', { type: 'range', min: 0, max: 100, value: Math.round(s.volume * 100), class: 'rng', oninput: () => { s.volume = vol.value / 100; audio.setVolume(s.volume); }, onchange: () => { st.save(); sfx.click(); } });
    box.append(h('div', { class: 'card2' }, tog('Soundeffekte', 'sound'), tog('Musik', 'music'), h('div', { class: 'vr' }, h('span', {}, 'Lautstärke'), vol)));
    box.append(h('button', { class: 'btn ghost block', onclick: () => { this.startTutorial(); } }, '🎓 Tutorial wiederholen'));
    box.append(h('button', { class: 'btn ghost block red', onclick: () => this.confirm('Wirklich ALLES löschen? Zauber, Münzen und Fortschritt sind dann weg.', () => { st.reset(); this.hero.size(); this.refresh(); this.toast('Zurückgesetzt'); }, 'Löschen') }, '🗑 Fortschritt zurücksetzen'));
    box.append(h('p', { class: 'mut c' }, 'Spells · Version 2 · Dein Fortschritt liegt lokal in diesem Browser.'));
    el.append(box);
  }

  // ============================================================ TUTORIAL
  welcome() {
    this.store.d.seen.welcome = true; this.store.save();
    const nameIn = h('input', { class: 'inp', maxlength: 14, value: '', placeholder: 'Wie heißt du, Zauberer?' });
    const m = this.modal(h('div', { class: 'welcome' }, h('div', { class: 'wl' }, '🪄'), h('h2', {}, 'Willkommen bei Spells!'), h('p', {}, 'Zeichne Formen auf den Bildschirm – dein Zauber wird sofort erkannt und gewirkt. Sammle Zauber, steige im Rang auf und besiege andere Magier.'), nameIn,
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
      ['Zeichne einen <b>Kreis</b> unten ins Feld – das wirkt den <b>Feuerball</b>.<br><small>Die Form siehst du auch auf dem Symbol links in der Leiste.</small>', 'feuerball'],
      ['Stark! Jeder Zauber kostet <b>💧 Mana</b> und hat eine <b>Abklingzeit</b>. Jetzt ein <b>senkrechter Strich</b> von oben nach unten: <b>Eissplitter</b>.', 'eissplitter'],
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
  let idx = 0;
  const stage = h('div', { class: 'pk-stage' }); ov.append(stage);
  const pack = h('button', { class: 'pk-pack ' + P.id, style: `--c:${P.color}` }, h('span', {}, P.id === 'basic' ? '✨' : '👑'), h('small', {}, 'Tippe zum Öffnen'));
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
      const face = h('div', { class: 'face' }, h('small', { class: 'rr', style: `color:${R.color}` }, R.name.toUpperCase()), icon(sp, 200), h('h3', {}, sp.name), c.isNew ? h('span', { class: 'new' }, 'NEU!') : c.refund ? h('span', { class: 'cp' }, `Max-Stufe: +${c.refund} 🪙`) : h('span', { class: 'cp' }, `Kopie ${c.copies}${c.levelUp ? ' · STUFE ' + c.level + '!' : ''}`));
      const card = h('div', { class: 'pc', style: `--c:${R.color};--g:${sp.color};--i:${i}` }, h('div', { class: 'in' }, h('div', { class: 'back' }, '?'), face));
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
    const grid = h('div', { class: 'pk-sum' }, ...cards.map((c) => { const sp = SPELL_BY_ID[c.id]; return h('div', { class: 'sc', style: `--c:${RARITIES[c.rarity].color}` }, icon(sp, 100), h('b', {}, sp.name), c.isNew ? h('em', {}, 'NEU') : h('small', {}, c.levelUp ? `Stufe ${c.level}!` : `×${c.copies}`)); }));
    const can = app.store.d.coins >= P.price;
    stage.append(h('h2', {}, 'Deine Beute'), grid, total ? h('p', { class: 'mut' }, `+${total} 🪙 Rückerstattung`) : null,
      h('div', { class: 'row' }, can ? h('button', { class: 'btn ghost', onclick: () => { close(); app.openPack(P.id, false); } }, `Nochmal · 🪙 ${P.price}`) : null, h('button', { class: 'btn', onclick: () => { close(); } }, 'Fertig')));
    sfx.good();
  }
  function close() { ov.remove(); done(); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
