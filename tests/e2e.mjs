// Ende-zu-Ende gegen einen laufenden Server (Echtzeit-Protokoll).
// node tests/e2e.mjs [http://127.0.0.1:8787] [bot|duo]
const base = (process.argv[2] || 'http://127.0.0.1:8787').replace('http', 'ws');
const mode = process.argv[3] || 'bot';
const DECK = ['feuerball', 'eissplitter', 'windstoss', 'klingenhieb', 'heilfunke', 'funkenschuss'];
const ws = (p) => new Promise((res, rej) => { const w = new WebSocket(base + p); w.onopen = () => res(w); w.onerror = () => rej(new Error('ws ' + p)); });
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(5), ...a);
const T0 = Date.now();

async function player(name, pid) {
  const lobby = await ws('/ws/lobby');
  const m = await new Promise((res) => { lobby.onmessage = (e) => { const d = JSON.parse(e.data); if (d.t === 'match') res(d); }; lobby.send(JSON.stringify({ t: 'queue', pid, name, trophies: 100 })); });
  log(name, 'Match gefunden', m.bot ? '(Bot)' : '(Mensch)');
  const w = await ws('/ws/match/' + m.matchId);
  const st = { name, bot: m.bot, casts: 0, evs: new Set(), snaps: 0, end: null, started: false, fizzles: {} };
  let you = 0, timer = null;
  await new Promise((done) => {
    w.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.t === 'start') { you = d.you; log(name, 'start, ich =', d.you, d.players.map((p) => p.name).join(' vs '), 'Thema', d.theme); }
      if (d.t === 'go') {
        st.started = true;
        timer = setInterval(() => { const id = DECK[Math.floor(Math.random() * DECK.length)]; w.send(JSON.stringify({ t: 'cast', id, acc: 0.9 })); st.casts++; }, 700);
      }
      if (d.t === 'snap') st.snaps++;
      if (d.t === 'ev') d.ev.forEach((x) => { st.evs.add(x.k); if (x.k === 'fizzle') st.fizzles[x.why] = (st.fizzles[x.why] || 0) + 1; });
      if (d.t === 'end') { st.end = d; clearInterval(timer); log(name, 'ENDE', JSON.stringify(d)); done(); }
    };
    w.onclose = () => { if (!st.end) { clearInterval(timer); log(name, 'Verbindung zu'); done(); } };
    w.send(JSON.stringify({ t: 'hello', pid, name, trophies: 100, deck: DECK, levels: {}, skin: { robe: '#2c6fd1', trim: '#ffd86b', hat: 1 }, bot: m.bot }));
  });
  return st;
}
const sum = (s) => ({ ok: !!s.end && s.started, bot: s.bot, casts: s.casts, snaps: s.snaps, events: [...s.evs].sort(), fizzles: s.fizzles, reason: s.end && s.end.reason, winner: s.end && s.end.winner });
if (mode === 'bot') console.log(JSON.stringify(sum(await player('Solo', 'e2e-solo-' + Date.now()))));
else {
  const [a, b] = await Promise.all([player('Anna', 'e2e-a-' + Date.now()), player('Ben', 'e2e-b-' + Date.now())]);
  console.log(JSON.stringify({ A: sum(a), B: sum(b), konsistent: a.end?.winner === b.end?.winner && !a.bot }));
}
process.exit(0);
