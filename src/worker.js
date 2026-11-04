// Cloudflare Worker: statische Dateien (public/) + Matchmaking (Lobby) + Kampfräume (Match).
import { SPELLS, RARITY_ORDER, SPELL_BY_ID, RARITIES } from '../public/spells.js';
import { newPlayer, snapshot, resolveRound, outcome, validatePlay, MAX_HP } from './game.js';

const DRAW_MS = 10000; // Zeichenzeit pro Runde
const GRACE_MS = 600; // Puffer für Netzwerk-Latenz, damit niemand wegen Ping benachteiligt wird
const RESOLVE_MS = 4200; // Anzeigedauer der Auflösung
const BOT_WAIT_MS = 8000; // so lange wird auf einen echten Gegner gewartet
const BOT_NAMES = ['Irrlicht', 'Funkenfee', 'Nebelhexe', 'Mondmagier', 'Kristallgeist', 'Aschenzwerg'];

const send = (ws, o) => {
  try { ws.send(JSON.stringify(o)); } catch { /* Socket weg */ }
};
const clean = (s, n = 16) => String(s ?? '').replace(/[<>\n\r]/g, '').slice(0, n).trim();

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
    return env.ASSETS.fetch(req);
  },
};

function acceptSocket() {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  return { client, server };
}

// ---------------------------------------------------------------- Lobby
export class Lobby {
  constructor(state, env) {
    this.env = env;
    this.waiting = []; // { ws, pid, name, timer }
  }

  async fetch() {
    const { client, server } = acceptSocket();
    let me = null;
    server.addEventListener('message', (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'queue' && !me) {
        me = { ws: server, pid: clean(m.pid, 40), name: clean(m.name) || 'Zauberer', timer: null };
        this.enqueue(me);
      } else if (m.t === 'cancel') {
        this.remove(me);
        try { server.close(1000, 'cancel'); } catch {}
      }
    });
    const gone = () => this.remove(me);
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  remove(p) {
    if (!p) return;
    clearTimeout(p.timer);
    this.waiting = this.waiting.filter((w) => w !== p);
  }

  enqueue(p) {
    // gleiche Spieler-ID nicht mit sich selbst paaren (z. B. zwei Tabs)
    const opp = this.waiting.find((w) => w.pid !== p.pid);
    if (opp) {
      this.remove(opp);
      const matchId = this.env.MATCH.newUniqueId().toString();
      send(opp.ws, { t: 'match', matchId, bot: false });
      send(p.ws, { t: 'match', matchId, bot: false });
      return;
    }
    this.waiting.push(p);
    send(p.ws, { t: 'queued' });
    p.timer = setTimeout(() => {
      if (!this.waiting.includes(p)) return;
      this.remove(p);
      send(p.ws, { t: 'match', matchId: this.env.MATCH.newUniqueId().toString(), bot: true });
    }, BOT_WAIT_MS);
  }
}

// ---------------------------------------------------------------- Match
export class Match {
  constructor(state, env) {
    this.humans = []; // { ws, pid, name, owned, pick, locked, idx, bot:false }
    this.players = null;
    this.G = null;
    this.round = 0;
    this.phase = 'wait';
    this.botMode = false;
    this.timers = {};
    this.waitTimer = null;
  }

  async fetch() {
    const { client, server } = acceptSocket();
    const h = { ws: server, joined: false, owned: [], pick: null, locked: false, bot: false, name: '?' };
    server.addEventListener('message', (e) => this.onMessage(h, e.data));
    const gone = () => this.onLeave(h);
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(h, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'hello' && !h.joined && this.phase === 'wait' && this.humans.length < 2) {
      h.joined = true;
      h.name = clean(m.name) || 'Zauberer';
      h.owned = Array.isArray(m.owned) ? m.owned.filter((id) => SPELL_BY_ID[id]).slice(0, 50) : [];
      if (!h.owned.length) h.owned = ['feuerball'];
      this.humans.push(h);
      if (m.bot) this.botMode = true;
      if (this.humans.length === 2) this.begin();
      else if (this.botMode) this.begin();
      else this.waitTimer = setTimeout(() => { this.botMode = true; this.begin(); }, 12000);
    } else if (!h.joined || this.phase !== 'draw') {
      return;
    } else if (m.t === 'pick' && !h.locked) {
      h.pick = { id: m.id, acc: Number(m.acc) };
    } else if (m.t === 'lock' && !h.locked && h.pick) {
      h.locked = true;
      const other = this.players && this.players.find((p) => p !== h && !p.bot);
      if (other) send(other.ws, { t: 'ready' });
      this.checkAllLocked();
    }
  }

  onLeave(h) {
    if (!h.joined || this.phase === 'over') return;
    this.humans = this.humans.filter((x) => x !== h);
    if (this.phase === 'wait') { clearTimeout(this.waitTimer); return; }
    const stay = this.players.find((p) => !p.bot && p !== h);
    this.end(stay ? stay.idx : -1, 'left');
  }

  begin() {
    clearTimeout(this.waitTimer);
    if (this.phase !== 'wait') return;
    this.phase = 'starting';
    const h0 = this.humans[0];
    const players = [h0];
    if (this.humans.length === 2) players.push(this.humans[1]);
    else {
      // Bot-Gegner: Zauberauswahl passend zur Stärke des Menschen (fair, nicht übermächtig)
      const best = Math.max(...h0.owned.map((id) => RARITY_ORDER.indexOf(SPELL_BY_ID[id].rarity)));
      const pool = SPELLS.filter((s) => RARITY_ORDER.indexOf(s.rarity) <= best);
      players.push({
        bot: true, name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ' (Bot)',
        pool, pick: null, locked: false, ws: null, owned: null,
      });
    }
    if (Math.random() < 0.5) players.reverse();
    players.forEach((p, i) => { p.idx = i; });
    this.players = players;
    this.G = [newPlayer(), newPlayer()];
    for (const p of players) {
      if (p.bot) continue;
      send(p.ws, { t: 'start', you: p.idx, names: players.map((x) => x.name), hp: MAX_HP, drawMs: DRAW_MS });
    }
    this.timers.next = setTimeout(() => this.nextRound(), 2200);
  }

  nextRound() {
    this.round += 1;
    this.phase = 'draw';
    for (const p of this.players) { p.pick = null; p.locked = false; }
    for (const p of this.players) if (!p.bot) send(p.ws, { t: 'round', n: this.round, ms: DRAW_MS });
    this.timers.draw = setTimeout(() => this.resolve(), DRAW_MS + GRACE_MS);
    const bot = this.players.find((p) => p.bot);
    if (bot) {
      this.timers.bot = setTimeout(() => this.botPlay(bot), 2500 + Math.random() * 5500);
    }
  }

  botPlay(bot) {
    if (this.phase !== 'draw') return;
    const me = this.G[bot.idx];
    const heals = bot.pool.filter((s) => s.fx.heal || s.fx.shield);
    const attacks = bot.pool.filter((s) => s.fx.dmg);
    let sp;
    if (me.hp < 90 && heals.length && Math.random() < 0.55) sp = heals[Math.floor(Math.random() * heals.length)];
    else sp = (attacks.length ? attacks : bot.pool)[Math.floor(Math.random() * (attacks.length || bot.pool.length))];
    const thr = RARITIES[sp.rarity].thr;
    const acc = Math.min(0.97, thr + 0.04 + Math.random() * (0.93 - thr));
    bot.pick = { id: sp.id, acc };
    bot.locked = true;
    const human = this.players.find((p) => !p.bot);
    if (human) send(human.ws, { t: 'ready' });
    this.checkAllLocked();
  }

  checkAllLocked() {
    if (this.phase === 'draw' && this.players.every((p) => p.locked)) this.resolve();
  }

  resolve() {
    if (this.phase !== 'draw') return;
    this.phase = 'resolve';
    clearTimeout(this.timers.draw);
    clearTimeout(this.timers.bot);
    const plays = this.players.map((p) => validatePlay(p.pick, p.bot ? null : p.owned));
    const events = resolveRound(this.G, plays);
    const res = outcome(this.G, this.round);
    const msg = {
      t: 'resolve', n: this.round, events, state: this.G.map(snapshot),
    };
    for (const p of this.players) if (!p.bot) send(p.ws, msg);
    if (res !== null) this.timers.over = setTimeout(() => this.end(res, 'ko'), RESOLVE_MS - 600);
    else this.timers.next = setTimeout(() => this.nextRound(), RESOLVE_MS);
  }

  end(winner, reason) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    Object.values(this.timers).forEach(clearTimeout);
    clearTimeout(this.waitTimer);
    const hp = this.G ? this.G.map((g) => g.hp) : [0, 0];
    for (const p of this.players || []) if (!p.bot) send(p.ws, { t: 'end', winner, reason, hp });
    setTimeout(() => {
      for (const p of this.players || []) if (!p.bot) try { p.ws.close(1000, 'fertig'); } catch {}
    }, 1500);
  }
}
