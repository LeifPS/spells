// Reine Spiellogik (ohne Cloudflare-Abhängigkeiten, daher einzeln testbar).
import { SPELL_BY_ID, RARITIES } from '../public/spells.js';

export const MAX_HP = 200;
export const MAX_ROUNDS = 14;
export const CHILL_FACTOR = 0.65;

export function newPlayer() {
  return { hp: MAX_HP, shield: 0, shieldT: 0, burn: null, poison: null, chill: false };
}

export function snapshot(P) {
  return {
    hp: P.hp,
    shield: P.shield,
    burn: !!P.burn,
    poison: !!P.poison,
    chill: P.chill,
  };
}

// Genauigkeit -> Stärke-Faktor 0.70 .. 1.15 (schwellenbasiert, damit fair über alle Seltenheiten)
export function powerFactor(acc, thr) {
  const n = Math.min(1, Math.max(0, (acc - thr) / (0.95 - thr)));
  return 0.7 + 0.45 * n;
}

// Prüft einen Zug. owned = erlaubte IDs oder null (Bot).
export function validatePlay(pick, owned) {
  if (!pick || typeof pick.id !== 'string') return null;
  const sp = SPELL_BY_ID[pick.id];
  if (!sp) return null;
  if (owned && !owned.includes(sp.id)) return null;
  const acc = Math.min(1, Number(pick.acc));
  const thr = RARITIES[sp.rarity].thr;
  if (!(acc >= thr - 0.005)) return null;
  return { id: sp.id, acc: Math.max(acc, thr), m: powerFactor(acc, thr) };
}

function applyDamage(P, amount, pierce) {
  let absorbed = 0;
  if (!pierce && P.shield > 0) {
    absorbed = Math.min(P.shield, amount);
    P.shield -= absorbed;
  }
  const dealt = amount - absorbed;
  P.hp = Math.max(0, P.hp - dealt);
  return { dealt, absorbed };
}

/** Löst eine Runde auf. P = [Spieler0, Spieler1], plays = [play|null, play|null]. Gibt Events zurück. */
export function resolveRound(P, plays) {
  const ev = [];
  const chillBefore = [P[0].chill, P[1].chill];
  const sps = plays.map((pl) => (pl ? SPELL_BY_ID[pl.id] : null));

  plays.forEach((pl, i) => {
    ev.push({ k: 'cast', p: i, id: pl ? pl.id : null, acc: pl ? pl.acc : 0, m: pl ? pl.m : 0 });
  });

  // 1) Eigene Effekte: Schild, Reinigung, Heilung
  for (let i = 0; i < 2; i++) {
    const sp = sps[i];
    if (!sp) continue;
    const f = sp.fx, m = plays[i].m;
    if (f.cleanse) {
      P[i].burn = null; P[i].poison = null; P[i].chill = false;
      ev.push({ k: 'cleanse', p: i });
    }
    if (f.shield) {
      const a = Math.round(f.shield * m);
      P[i].shield += a; P[i].shieldT = 2;
      ev.push({ k: 'shield', p: i, amount: a, total: P[i].shield });
    }
    if (f.heal) {
      const a = Math.min(MAX_HP - P[i].hp, Math.round(f.heal * m));
      P[i].hp += a;
      ev.push({ k: 'heal', p: i, amount: a, hp: P[i].hp });
    }
  }

  // 2) Schaden (gleichzeitig: auch ein gefallener Spieler zaubert noch)
  for (let i = 0; i < 2; i++) {
    const sp = sps[i];
    if (!sp || !sp.fx.dmg) continue;
    const t = 1 - i;
    let d = sp.fx.dmg * plays[i].m;
    if (chillBefore[i]) d *= CHILL_FACTOR;
    d = Math.round(d);
    const r = applyDamage(P[t], d, false);
    ev.push({ k: 'dmg', p: t, src: i, id: sp.id, amount: r.dealt, absorbed: r.absorbed, hp: P[t].hp, shield: P[t].shield });
    if (sp.fx.drain && r.dealt > 0) {
      const a = Math.min(MAX_HP - P[i].hp, Math.round(r.dealt * sp.fx.drain));
      if (a > 0) {
        P[i].hp += a;
        ev.push({ k: 'heal', p: i, amount: a, hp: P[i].hp, drain: true });
      }
    }
  }

  // 3) Statuseffekte
  for (let i = 0; i < 2; i++) {
    if (chillBefore[i]) P[i].chill = false; // Frost wirkt nur auf den nächsten eigenen Zauber
  }
  for (let i = 0; i < 2; i++) {
    const sp = sps[i];
    if (!sp) continue;
    const t = 1 - i, f = sp.fx;
    if (f.burn) { P[t].burn = { v: Math.round(f.burn[0] * plays[i].m), t: f.burn[1] }; ev.push({ k: 'status', p: t, type: 'burn' }); }
    if (f.poison) { P[t].poison = { v: Math.round(f.poison[0] * plays[i].m), t: f.poison[1] }; ev.push({ k: 'status', p: t, type: 'poison' }); }
    if (f.chill) { P[t].chill = true; ev.push({ k: 'status', p: t, type: 'chill' }); }
  }

  // 4) Dauerschaden
  for (let i = 0; i < 2; i++) {
    for (const type of ['burn', 'poison']) {
      const s = P[i][type];
      if (!s) continue;
      const r = applyDamage(P[i], s.v, type === 'poison');
      ev.push({ k: 'dot', p: i, type, amount: r.dealt, absorbed: r.absorbed, hp: P[i].hp, shield: P[i].shield });
      s.t -= 1;
      if (s.t <= 0) P[i][type] = null;
    }
  }

  // 5) Schild läuft ab
  for (let i = 0; i < 2; i++) {
    if (P[i].shieldT > 0 && --P[i].shieldT === 0) P[i].shield = 0;
  }
  return ev;
}

/** Ergebnis: 0 / 1 = Sieger, -1 = Unentschieden, null = läuft weiter */
export function outcome(P, round) {
  const d0 = P[0].hp <= 0, d1 = P[1].hp <= 0;
  if (d0 && d1) return -1;
  if (d0) return 1;
  if (d1) return 0;
  if (round >= MAX_ROUNDS) return P[0].hp === P[1].hp ? -1 : P[0].hp > P[1].hp ? 0 : 1;
  return null;
}
