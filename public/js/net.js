// Zwei Quellen mit gleicher Schnittstelle: NetSource (online) und LocalSource (offline gegen Bot / Training).
import { Duel } from './sim.js';
import { SPELL_BY_ID, RARITY_ORDER } from './spells.js';
import { makeBot, botStep, botDeck, botLevels, BOT_LEVELS } from './bot.js';

const THEMES = ['wald', 'vulkan', 'eis', 'tempel'];
const BOT_NAMES = ['Irrlicht', 'Funkenfee', 'Nebelhexe', 'Mondmagier', 'Kristallgeist', 'Aschenzwerg', 'Sternenwirt', 'Donnerkater'];
const BOT_SKINS = [
  { robe: '#c0392b', trim: '#ffd86b', hat: 0 }, { robe: '#16a085', trim: '#f1f5a8', hat: 1 },
  { robe: '#8e44ad', trim: '#ffd86b', hat: 2 }, { robe: '#2c6fd1', trim: '#e8f0ff', hat: 0 },
];
const STEP = 0.05;

class Source {
  constructor() { this.h = () => {}; this.closed = false; }
  on(h) { this.h = h; return this; }
  emit(m) { if (!this.closed) this.h(m); }
}

export class LocalSource extends Source {
  /** profile: {name, skin, trophies, deck, levels}; opts: {level 0..3, theme, countdown} */
  constructor(profile, opts = {}) {
    super();
    this.profile = profile; this.opts = opts; this.timers = [];
  }
  start() {
    const pr = this.profile, o = this.opts, level = o.level ?? 1;
    const maxRar = Math.max(...pr.deck.map((id) => RARITY_ORDER.indexOf(SPELL_BY_ID[id].rarity)));
    const bdeck = o.botDeck || botDeck(level === 0 ? Math.min(1, maxRar) : maxRar, level);
    const bot = { name: o.botName || (level === 0 ? 'Übungspuppe' : BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]), skin: o.botSkin || (() => { const c = BOT_SKINS.filter((k) => k.robe !== pr.skin.robe); return c[Math.floor(Math.random() * c.length)]; })(), trophies: pr.trophies, deck: bdeck, levels: botLevels(bdeck, level), bot: true };
    const me = { name: pr.name, skin: pr.skin, trophies: pr.trophies, deck: pr.deck, levels: pr.levels, bot: false };
    this.you = o.you ?? (Math.random() < 0.5 ? 0 : 1);
    const list = this.you === 0 ? [me, bot] : [bot, me];
    this.duel = new Duel({ decks: list.map((p) => p.deck), levels: list.map((p) => p.levels) });
    this.bot = makeBot(level); this.botIdx = 1 - this.you;
    const cd = o.countdown ?? 3.2;
    this.emit({ t: 'start', you: this.you, players: list.map((p) => ({ name: p.name, skin: p.skin, trophies: p.trophies, bot: p.bot, deck: p.deck })), theme: o.theme || THEMES[Math.floor(Math.random() * THEMES.length)], countdown: cd, levels: list.map((p) => p.levels), local: true, level });
    this.phase = 'count';
    this.timers.push(setTimeout(() => this.go(), cd * 1000));
  }
  go() {
    if (this.closed || this.phase !== 'count') return;
    this.phase = 'play'; this.last = performance.now(); this.acc = 0; this.n = 0;
    this.emit({ t: 'go' });
    this.loop = setInterval(() => this.tick(), 50);
  }
  tick() {
    const now = performance.now();
    this.acc += Math.min(0.25, (now - this.last) / 1000); this.last = now;
    while (this.acc >= STEP && !this.duel.over) {
      this.acc -= STEP;
      if (!this.opts.noBot) botStep(this.duel, this.botIdx, this.bot, STEP);
      this.duel.step(STEP);
      if (++this.n % 4 === 0) this.emit({ t: 'snap', s: this.duel.snapshot() });
    }
    this.flush();
    if (this.duel.over) this.finish(this.duel.winner, this.duel.reason);
  }
  flush() {
    const ev = this.duel.drain().filter((e) => e.k !== 'fizzle' || e.p === this.you);
    if (ev.length) this.emit({ t: 'ev', ev });
  }
  cast(id, acc) { if (this.phase !== 'play') return; this.duel.cast(this.you, String(id), Number(acc)); this.flush(); }
  emote(n) { this.emit({ t: 'emote', p: this.you, n }); setTimeout(() => this.emit({ t: 'emote', p: this.botIdx, n: [1, 0, 3, 2, 4][n % 5] }), 900); }
  quit() { if (this.phase === 'play' || this.phase === 'count') this.finish(1 - this.you, 'quit'); }
  finish(winner, reason) {
    if (this.phase === 'over') return;
    const was = this.phase === 'play'; this.phase = 'over';
    clearInterval(this.loop);
    if (was) this.flush();
    const stats = this.duel.p.map((p) => ({ dmg: Math.round(p.stats.dmg), heal: Math.round(p.stats.heal), casts: p.stats.casts, acc: p.stats.casts ? Math.round((p.stats.accSum / p.stats.casts) * 100) : 0, hp: Math.round(p.hp) }));
    this.emit({ t: 'end', winner, reason, stats, time: Math.round(this.duel.t) });
  }
  close() { this.closed = true; clearInterval(this.loop); this.timers.forEach(clearTimeout); }
}

export class NetSource extends Source {
  constructor(profile) { super(); this.profile = profile; this.lobby = null; this.match = null; this.timers = []; this.fellBack = false; }
  wsUrl(path) { return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`; }
  start() {
    this.emit({ t: 'status', text: 'Verbinde …' });
    let opened = false;
    try { this.lobby = new WebSocket(this.wsUrl('/ws/lobby')); } catch { return this.fallback('Keine Verbindung'); }
    const to = setTimeout(() => { if (!opened) this.fallback('Server antwortet nicht'); }, 6000);
    this.timers.push(to);
    this.lobby.onopen = () => {
      opened = true; clearTimeout(to);
      const pr = this.profile;
      this.lobby.send(JSON.stringify({ t: 'queue', pid: pr.pid, name: pr.name, trophies: pr.trophies }));
    };
    this.lobby.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'queued') this.emit({ t: 'status', text: 'Suche Gegner …', queued: true });
      else if (m.t === 'match') { try { this.lobby.close(); } catch {} this.joinMatch(m.matchId, m.bot); }
    };
    this.lobby.onerror = () => { if (!this.match && !this.fellBack) this.fallback('Keine Verbindung'); };
    this.lobby.onclose = () => { if (!this.match && !this.closed && !this.cancelled && !this.fellBack && opened) this.fallback('Verbindung getrennt'); };
  }
  joinMatch(id, bot) {
    this.emit({ t: 'status', text: bot ? 'Gegner gefunden!' : 'Gegner gefunden!', found: true });
    const pr = this.profile;
    const ws = this.match = new WebSocket(this.wsUrl('/ws/match/' + id));
    this.gotStart = false;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name: pr.name, trophies: pr.trophies, deck: pr.deck, levels: pr.levels, skin: pr.skin, bot: !!bot }));
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.t === 'start') this.gotStart = true; if (m.t === 'end') this.ended = true; this.emit(m); };
    ws.onclose = () => { if (!this.ended && !this.closed) this.emit({ t: 'disconnected', started: this.gotStart }); };
    ws.onerror = () => {};
  }
  fallback(why) {
    if (this.fellBack || this.closed) return;
    this.fellBack = true;
    this.cancel(true);
    this.emit({ t: 'offline', why });
  }
  send(o) { if (this.match && this.match.readyState === 1) this.match.send(JSON.stringify(o)); }
  cast(id, acc) { this.send({ t: 'cast', id, acc }); }
  emote(n) { this.send({ t: 'emote', n }); }
  quit() { this.send({ t: 'quit' }); }
  cancel(silent) {
    this.cancelled = true;
    if (this.lobby && this.lobby.readyState === 1) try { this.lobby.send(JSON.stringify({ t: 'cancel' })); } catch {}
    try { this.lobby && this.lobby.close(); } catch {}
    if (!silent) this.closed = true;
  }
  close() { this.closed = true; this.timers.forEach(clearTimeout); try { this.lobby && this.lobby.close(); } catch {} try { this.match && this.match.close(); } catch {} }
}
export { BOT_LEVELS };
