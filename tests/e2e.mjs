// Ende-zu-Ende gegen laufenden Server: node tests/e2e.mjs [http://127.0.0.1:8787]
const base = (process.argv[2] || 'http://127.0.0.1:8787').replace('http', 'ws');
const OWN = ['feuerball', 'heilfunke', 'blitz', 'windstoss'];
const ws = (p) => new Promise((res, rej) => { const w = new WebSocket(base + p); w.onopen = () => res(w); w.onerror = () => rej(new Error('ws ' + p)); });
const log = (...a) => console.log(new Date().toISOString().slice(14, 23), ...a);

async function player(name, pid, forceHuman) {
  const lobby = await ws('/ws/lobby');
  const m = await new Promise((res) => { lobby.onmessage = (e) => { const d = JSON.parse(e.data); if (d.t === 'match') res(d); }; lobby.send(JSON.stringify({ t: 'queue', pid, name })); });
  log(name, 'Match', m.bot ? '(Bot)' : '(Mensch)');
  const w = await ws('/ws/match/' + m.matchId);
  const st = { name, rounds: 0, resolves: 0, end: null, you: null, hpLast: null, events: new Set(), bot: m.bot };
  await new Promise((done) => {
    w.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.t === 'start') { st.you = d.you; log(name, 'start you=', d.you, d.names); }
      if (d.t === 'round') {
        st.rounds++;
        const id = OWN[Math.floor(Math.random() * OWN.length)];
        w.send(JSON.stringify({ t: 'pick', id, acc: 0.9 }));
        setTimeout(() => w.send(JSON.stringify({ t: 'lock' })), 200);
      }
      if (d.t === 'resolve') { st.resolves++; st.hpLast = d.state.map((s) => s.hp); d.events.forEach((x) => st.events.add(x.k)); }
      if (d.t === 'end') { st.end = d; log(name, 'ENDE', JSON.stringify(d)); done(); }
    };
    w.onclose = () => { if (!st.end) { log(name, 'Verbindung zu'); done(); } };
    w.send(JSON.stringify({ t: 'hello', pid, name, owned: OWN, bot: m.bot }));
  });
  return st;
}

const mode = process.argv[3] || 'bot';
if (mode === 'bot') {
  const s = await player('Solo', 'e2e-solo-' + Date.now());
  console.log(JSON.stringify({ ok: !!s.end && s.resolves > 0, bot: s.bot, rounds: s.rounds, resolves: s.resolves, hp: s.hpLast, events: [...s.events] }));
} else {
  const [a, b] = await Promise.all([player('Anna', 'e2e-a-' + Date.now()), player('Ben', 'e2e-b-' + Date.now())]);
  console.log(JSON.stringify({ ok: !!a.end && !!b.end && !a.bot && a.end.winner === b.end.winner, winner: a.end?.winner, youA: a.you, youB: b.you, rounds: a.rounds }));
}
process.exit(0);
