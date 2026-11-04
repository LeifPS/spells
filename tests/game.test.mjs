import assert from 'node:assert/strict';
import { newPlayer, resolveRound, outcome, validatePlay, powerFactor, MAX_HP } from '../src/game.js';
const play = (id, acc = 0.9) => validatePlay({ id, acc }, null);
const fresh = () => [newPlayer(), newPlayer()];

// Gültigkeit
assert.equal(validatePlay({ id: 'weltenfeuer', acc: 0.5 }, null), null, 'zu ungenau -> verpufft');
assert.equal(validatePlay({ id: 'blitz', acc: 0.9 }, ['feuerball']), null, 'nicht freigeschaltet');
assert.equal(validatePlay({ id: 'nix', acc: 0.9 }, null), null);
assert.ok(powerFactor(0.6, 0.6) === 0.7 && powerFactor(1, 0.6) > 1.14);

// Feuerball: Schaden + Brennen, gleichzeitig
let P = fresh();
let ev = resolveRound(P, [play('feuerball'), play('feuerball')]);
assert.ok(P[0].hp < MAX_HP && P[1].hp < MAX_HP && P[0].hp === P[1].hp);
assert.ok(ev.some((e) => e.k === 'dot'));

// Schild absorbiert
P = fresh();
resolveRound(P, [play('schutzwall'), play('blitz')]);
assert.ok(P[0].hp > MAX_HP - 42, 'Schild hat gewirkt');

// Gift ignoriert Schild
P = fresh();
resolveRound(P, [play('schutzwall', 1), play('giftwolke', 1)]);
assert.ok(P[0].hp < MAX_HP, 'Gift durch Schild');

// Heilung nicht über Max
P = fresh();
resolveRound(P, [play('heilfunke'), null]);
assert.equal(P[0].hp, MAX_HP);

// Frost senkt nächsten Schaden, einmalig
P = fresh();
resolveRound(P, [play('eissplitter', 1), null]);
assert.ok(P[1].chill);
const before = P[0].hp;
resolveRound(P, [null, play('windstoss', 1)]);
const chilled = before - P[0].hp;
assert.ok(chilled < 26 * 1.15 * 0.7, 'gedämpft: ' + chilled);
assert.equal(P[1].chill, false);

// Lebensraub
P = fresh(); P[0].hp = 100;
resolveRound(P, [play('seelenraub', 1), null]);
assert.ok(P[0].hp > 100);

// Ausgang
P = fresh(); P[1].hp = 5;
resolveRound(P, [play('windstoss'), null]);
assert.equal(outcome(P, 3), 0);
P = fresh(); P[0].hp = 0; P[1].hp = 0;
assert.equal(outcome(P, 3), -1);
P = fresh(); P[0].hp = 120;
assert.equal(outcome(P, 14), 1);
console.log('Spiellogik: alle Tests bestanden');
