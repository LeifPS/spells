import { Battle } from './battle.js';
import { Store } from './store.js';
import { App } from './ui.js';

const params = new URLSearchParams(location.hash.slice(1));
const store = new Store();
if (params.has('train') || params.has('dev')) store.d.seen.welcome = true;
const battle = new Battle(document.getElementById('battle'), {});
const app = new App(document.getElementById('app'), store, battle);
window.app = app; window.battle = battle; window.store = store;
import('./spells.js').then((m) => { window.SPELLS = m.SPELLS; });

// Entwickler-Abkürzungen: #train=0..3 startet direkt einen Übungskampf
if (params.has('train')) { store.d.seen.welcome = true; app.root.hidden = true; battle.play(store.battleProfile(), { mode: 'train', level: Number(params.get('train')) || 0, theme: params.get('theme') }); }
