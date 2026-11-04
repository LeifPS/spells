import { Battle } from './battle.js';
import { SPELLS } from './spells.js';

const params = new URLSearchParams(location.hash.slice(1));
const profile = {
  pid: 'dev' + Math.random().toString(36).slice(2, 8), name: 'Leif', trophies: 100,
  deck: (params.get('deck') || 'feuerball,eissplitter,windstoss,klingenhieb,heilfunke,erdbrocken').split(','),
  levels: {}, skin: { robe: '#2c6fd1', trim: '#ffd86b', hat: 0 },
};
const toast = (t) => { const e = document.getElementById('toast'); e.textContent = t; e.className = 'on'; setTimeout(() => (e.className = ''), 2600); };
const battle = new Battle(document.getElementById('battle'), { toast, profile: () => profile, onExit: () => { document.getElementById('app').innerHTML = '<button class="b-big" id="go" style="margin:40px auto;width:240px">Training</button>'; document.getElementById('go').onclick = () => battle.play(profile, { mode: 'train', level: 1 }); } });
window.battle = battle; window.profile = profile; window.SPELLS = SPELLS;
if (params.has('train')) battle.play(profile, { mode: 'train', level: Number(params.get('train')) || 0, theme: params.get('theme') });
else battle.play(profile, { mode: 'online' });
