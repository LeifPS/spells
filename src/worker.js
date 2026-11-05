// Cloudflare Worker: statische Dateien (public/) + Matchmaking (Lobby-DO) + Echtzeit-Kampf (Match-DO).
import { Duel } from '../public/js/sim.js';
import { SPELL_BY_ID, RARITY_ORDER, MAX_LEVEL } from '../public/js/spells.js';
import { makeBot, botStep, botDeck, botLevels } from '../public/js/bot.js';

const STEP = 0.05; // Simulationsschritt (s)
const COUNTDOWN_MS = 3200;
const BOT_WAIT_S = 9; // so lange wird nach einem Menschen gesucht
const THEMES = ['wald', 'vulkan', 'eis', 'tempel'];
const BOT_NAMES = ['Irrlicht', 'Funkenfee', 'Nebelhexe', 'Mondmagier', 'Kristallgeist', 'Aschenzwerg', 'Sternenwirt', 'Donnerkater'];
const BOT_SKINS = [
  { robe: '#c0392b', trim: '#ffd86b', hat: 0 }, { robe: '#16a085', trim: '#f1f5a8', hat: 1 },
  { robe: '#8e44ad', trim: '#ffd86b', hat: 2 }, { robe: '#2c6fd1', trim: '#e8f0ff', hat: 0 },
];

const send = (ws, o) => { try { ws.send(JSON.stringify(o)); } catch { /* Socket weg */ } };
const clean = (s, n = 14) => String(s ?? '').replace(/[<>\n\r]/g, '').slice(0, n).trim();
const hex = (c, d) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : d);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws/lobby') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket erwartet', { status: 426 });
      return env.LOBBY.get(env.LOBBY.idFromName('main')).fetch(req);
    }
    if (url.pathname.startsWith('/ws/match/')) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket erwartet', { status: 426 });
      let id;
      try { id = env.MATCH.idFromString(url.pathname.split('/')[3] || ''); } catch { return new Response('Ungültiger Raum', { status: 400 }); }
      return env.MATCH.get(id).fetch(req);
    }
    if (url.pathname === '/api/ping') return new Response('ok');
    return env.ASSETS.fetch(req);
  },
};

function acceptSocket() {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  return { client, server };
}

// ================================================================ Lobby
export class Lobby {
  constructor(state, env) {
    this.env = env;
    this.waiting = []; // { ws, pid, name, trophies, since }
    this.rooms = new Map(); // Code -> { ws, pid, since }  (Freunde-Räume)
    this.timer = null;
  }

  async fetch() {
    const { client, server } = acceptSocket();
    let me = null;
    server.addEventListener('message', (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'queue' && !me) {
        me = { ws: server, pid: clean(m.pid, 40), name: clean(m.name) || 'Zauberer', trophies: Math.max(0, Math.min(9999, Number(m.trophies) || 0)), since: Date.now() };
        this.waiting.push(me);
        send(server, { t: 'queued' });
        this.pairUp();
        this.ensureTimer();
      } else if (m.t === 'room' && !me) {
        const code = clean(m.code, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (code.length < 3) { try { server.close(1000, 'code'); } catch {} return; }
        me = { ws: server, pid: clean(m.pid, 40), name: clean(m.name) || 'Zauberer', room: code, since: Date.now() };
        const other = this.rooms.get(code);
        if (other && other.pid !== me.pid) {
          this.rooms.delete(code);
          const matchId = this.env.MATCH.newUniqueId().toString();
          send(other.ws, { t: 'match', matchId, bot: false, friend: true });
          send(server, { t: 'match', matchId, bot: false, friend: true });
        } else if (other) { send(server, { t: 'roomfull' }); } // gleicher Spieler zweimal
        else { this.rooms.set(code, me); send(server, { t: 'queued', room: true }); setTimeout(() => { if (this.rooms.get(code) === me) { this.rooms.delete(code); try { me.ws.close(1000, 'timeout'); } catch {} } }, 10 * 60 * 1000); }
      } else if (m.t === 'cancel') { this.remove(me); try { server.close(1000, 'cancel'); } catch {} }
    });
    const gone = () => this.remove(me);
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  remove(p) {
    if (!p) return;
    if (p.room && this.rooms.get(p.room) === p) this.rooms.delete(p.room);
    this.waiting = this.waiting.filter((w) => w !== p);
    if (!this.waiting.length && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this.pairUp(), 1000);
  }

  pairUp() {
    const now = Date.now();
    // Menschen paaren: je länger man wartet, desto größer der erlaubte Trophäen-Abstand
    for (let i = 0; i < this.waiting.length; i++) {
      for (let j = i + 1; j < this.waiting.length; j++) {
        const a = this.waiting[i], b = this.waiting[j];
        if (a.pid === b.pid) continue;
        const wait = Math.min(now - a.since, now - b.since) / 1000;
        if (Math.abs(a.trophies - b.trophies) <= 150 + 80 * wait) {
          this.remove(a); this.remove(b);
          const matchId = this.env.MATCH.newUniqueId().toString();
          send(a.ws, { t: 'match', matchId, bot: false });
          send(b.ws, { t: 'match', matchId, bot: false });
          return this.pairUp();
        }
      }
    }
    // Niemand gefunden: Bot-Gegner
    for (const p of [...this.waiting]) {
      if ((now - p.since) / 1000 >= BOT_WAIT_S) {
        this.remove(p);
        send(p.ws, { t: 'match', matchId: this.env.MATCH.newUniqueId().toString(), bot: true });
      }
    }
  }
}

// ================================================================ Match
export class Match {
  constructor(state, env) {
    this.humans = [];
    this.players = null; // [{ ws|null, bot, name, skin, trophies }]
    this.duel = null;
    this.phase = 'wait';
    this.botMode = false;
    this.bots = [];
    this.timers = [];
    this.last = 0; this.acc = 0; this.snapN = 0;
  }

  async fetch() {
    const { client, server } = acceptSocket();
    const h = { ws: server, joined: false };
    server.addEventListener('message', (e) => this.onMessage(h, e.data));
    const gone = () => this.onLeave(h);
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  later(ms, fn) { const t = setTimeout(fn, ms); this.timers.push(t); return t; }

  onMessage(h, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'hello' && !h.joined && this.phase === 'wait' && this.humans.length < 2) {
      const deck = [...new Set(Array.isArray(m.deck) ? m.deck : [])].filter((id) => SPELL_BY_ID[id]).slice(0, 8);
      if (!deck.length) deck.push('feuerball');
      const levels = {};
      for (const id of deck) levels[id] = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number((m.levels || {})[id]) || 1)));
      Object.assign(h, {
        joined: true, name: clean(m.name) || 'Zauberer', deck, levels,
        trophies: Math.max(0, Math.min(9999, Number(m.trophies) || 0)),
        skin: { robe: hex(m.skin && m.skin.robe, '#2c6fd1'), trim: hex(m.skin && m.skin.trim, '#ffd86b'), hat: Math.max(0, Math.min(5, Number(m.skin && m.skin.hat) || 0)) },
        bot: false,
      });
      this.humans.push(h);
      if (m.bot) this.botMode = true;
      if (this.humans.length === 2 || this.botMode) this.begin();
      else this.later(12000, () => { if (this.phase === 'wait') { this.botMode = true; this.begin(); } });
      return;
    }
    if (!h.joined || !this.players) return;
    const idx = this.players.indexOf(h);
    if (idx < 0) return;
    if (m.t === 'cast' && this.phase === 'play') {
      this.duel.cast(idx, String(m.id), Number(m.acc));
      this.flush();
    } else if (m.t === 'emote') {
      const now = Date.now();
      if (now - (h.lastEmote || 0) < 1500) return;
      h.lastEmote = now;
      this.broadcast({ t: 'emote', p: idx, n: Math.max(0, Math.min(5, Math.floor(Number(m.n) || 0))) });
    } else if (m.t === 'quit' && (this.phase === 'play' || this.phase === 'count')) {
      this.endMatch(1 - idx, 'quit');
    }
  }

  onLeave(h) {
    if (!h.joined || this.phase === 'over') return;
    this.humans = this.humans.filter((x) => x !== h);
    if (this.phase === 'wait') return;
    const idx = this.players ? this.players.indexOf(h) : -1;
    if (idx >= 0) this.endMatch(1 - idx, 'left');
  }

  broadcast(o) { for (const p of this.players || []) if (!p.bot) send(p.ws, o); }

  begin() {
    if (this.phase !== 'wait') return;
    this.phase = 'count';
    const h0 = this.humans[0];
    const list = [h0];
    if (this.humans.length === 2) list.push(this.humans[1]);
    else {
      const maxRar = Math.max(...h0.deck.map((id) => RARITY_ORDER.indexOf(SPELL_BY_ID[id].rarity)));
      const lvl = h0.trophies < 300 ? 1 : h0.trophies < 900 ? 2 : 3;
      const deck = botDeck(maxRar, lvl);
      list.push({ bot: true, ws: null, joined: true, name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], deck, levels: botLevels(deck, lvl), trophies: Math.max(0, h0.trophies + Math.round((Math.random() - 0.5) * 120)), skin: (() => { const c = BOT_SKINS.filter((k) => k.robe !== h0.skin.robe); return c[Math.floor(Math.random() * c.length)]; })(), botLevel: lvl });
    }
    if (Math.random() < 0.5) list.reverse();
    this.players = list;
    this.duel = new Duel({ decks: list.map((p) => p.deck), levels: list.map((p) => p.levels) });
    this.bots = list.map((p, i) => (p.bot ? makeBot(p.botLevel) : null));
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const info = list.map((p) => ({ name: p.name, skin: p.skin, trophies: p.trophies, bot: !!p.bot, deck: p.deck }));
    list.forEach((p, i) => { if (!p.bot) send(p.ws, { t: 'start', you: i, players: info, theme, countdown: COUNTDOWN_MS / 1000, levels: list.map((x) => x.levels) }); });
    this.later(COUNTDOWN_MS, () => this.go());
  }

  go() {
    if (this.phase !== 'count') return;
    this.phase = 'play';
    this.last = Date.now();
    this.loop = setInterval(() => this.tick(), 50);
    this.timers.push(this.loop);
    this.broadcast({ t: 'go' });
  }

  tick() {
    if (this.phase !== 'play') return;
    const now = Date.now();
    this.acc += Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    while (this.acc >= STEP && !this.duel.over) {
      this.acc -= STEP;
      this.bots.forEach((b, i) => { if (b) botStep(this.duel, i, b, STEP); });
      this.duel.step(STEP);
      if (++this.snapN % 4 === 0) this.broadcast({ t: 'snap', s: this.duel.snapshot() });
    }
    this.flush();
    if (this.duel.over) this.endMatch(this.duel.winner, this.duel.reason);
  }

  flush() {
    const ev = this.duel.drain();
    if (!ev.length) return;
    this.players.forEach((p, i) => {
      if (p.bot) return;
      const mine = ev.filter((e) => e.k !== 'fizzle' || e.p === i);
      if (mine.length) send(p.ws, { t: 'ev', ev: mine });
    });
  }

  endMatch(winner, reason) {
    if (this.phase === 'over') return;
    const wasPlaying = this.phase === 'play';
    this.phase = 'over';
    this.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    if (wasPlaying) this.flush();
    const stats = this.duel ? this.duel.p.map((p) => ({ dmg: Math.round(p.stats.dmg), heal: Math.round(p.stats.heal), casts: p.stats.casts, acc: p.stats.casts ? Math.round((p.stats.accSum / p.stats.casts) * 100) : 0, hp: Math.round(p.hp) })) : [];
    this.broadcast({ t: 'end', winner, reason, stats, time: this.duel ? Math.round(this.duel.t) : 0 });
    setTimeout(() => { for (const p of this.players || []) if (!p.bot) try { p.ws.close(1000, 'fertig'); } catch {} }, 1500);
  }
}
