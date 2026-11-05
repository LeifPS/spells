// Echtzeit-Duell-Simulation. Läuft identisch auf dem Server (online) und im Browser (Training).
import { SPELL_BY_ID, RARITIES, powerFactor, levelMul, isHostile } from './spells.js';

export const CFG = {
  maxHp: 200, maxMana: 100, regen: 6.5,
  gcd: 0.9, // globale Abklingzeit nach jedem Zauber
  tol: 0.28, // Latenz-Toleranz: ein Zauber darf kurz VOR Ablauf der Abklingzeit eintreffen
  duration: 150, suddenAt: 90, // Sudden Death
  chillGcd: 1.4, chillRegen: 0.6, hasteGcd: 0.6, hasteRegen: 1.4, hasteCd: 0.75,
  dotTick: 0.5, reflectTravel: 0.5, curseMul: 1.3,
};

const STATUSES = ['burn', 'poison', 'chill', 'stun', 'reflect', 'phase', 'haste', 'curse', 'regen', 'phoenix'];

function newPlayer(deck, levels) {
  return {
    deck: deck.slice(), levels: levels || {},
    hp: CFG.maxHp, mana: CFG.maxMana, gcd: 0, cds: {},
    shield: 0, shieldT: 0,
    burn: null, poison: null, chill: 0, stun: 0, reflect: 0, phase: 0, haste: 0,
    curse: 0, regen: null, phoenix: 0, phoenixHp: 0.4,
    dotAcc: 0,
    stats: { dmg: 0, heal: 0, casts: 0, fails: 0, accSum: 0 },
  };
}

export class Duel {
  constructor({ decks, levels = [{}, {}], rng = Math.random }) {
    this.rng = rng;
    this.p = [newPlayer(decks[0], levels[0]), newPlayer(decks[1], levels[1])];
    this.t = 0;
    this.proj = [];
    this.ev = [];
    this.over = false;
    this.winner = null;
    this.reason = null;
    this.sdAcc = 0;
  }

  drain() { const e = this.ev; this.ev = []; return e; }
  push(e) { e.t = Math.round(this.t * 100) / 100; this.ev.push(e); }

  // ------------------------------------------------------------ Wirken
  cast(i, id, acc) {
    const fail = (why) => { this.push({ k: 'fizzle', p: i, id, why }); this.p[i].stats.fails++; return { ok: false, why }; };
    if (this.over) return { ok: false, why: 'over' };
    const me = this.p[i], sp = SPELL_BY_ID[id];
    if (!sp || !me.deck.includes(id)) return fail('deck');
    const thr = RARITIES[sp.rarity].thr;
    if (!(acc >= thr - 0.005)) return fail('acc');
    if (me.stun > 0) return fail('stun');
    if (me.gcd > CFG.tol) return fail('gcd');
    if ((me.cds[id] || 0) > CFG.tol) return fail('cd');
    if (me.mana < sp.cost) return fail('mana');

    const lvl = me.levels[id] || 1;
    const pw = powerFactor(Math.min(1, acc), thr) * levelMul(lvl);
    me.mana -= sp.cost;
    me.gcd = CFG.gcd * (me.chill > 0 ? CFG.chillGcd : 1) * (me.haste > 0 ? CFG.hasteGcd : 1);
    me.cds[id] = sp.cd * (me.haste > 0 ? CFG.hasteCd : 1);
    me.stats.casts++; me.stats.accSum += Math.min(1, acc);
    // Glückswurf: ein zufälliger Effekt aus der Liste
    let f = sp.fx, roll = null;
    if (f.gamble) { roll = Math.floor(this.rng() * f.gamble.length); f = f.gamble[roll]; }
    const hostile = isHostile({ fx: f });
    this.push({ k: 'cast', p: i, id, acc: Math.round(acc * 100) / 100, lvl, travel: hostile ? sp.travel : 0, hostile, roll });

    // Selbst-Effekte sofort
    if (f.cleanse) this.cleanse(i);
    if (f.heal) this.heal(i, Math.round(f.heal * pw), 'spell');
    if (f.shield) this.addShield(i, Math.round(f.shield[0] * pw), f.shield[1]);
    if (f.mana) this.addMana(i, f.mana);
    if (f.reflect) this.status(i, 'reflect', f.reflect);
    if (f.phase) this.status(i, 'phase', f.phase);
    if (f.haste) this.status(i, 'haste', f.haste);
    if (f.regen) { me.regen = { hps: f.regen[0] * pw, t: f.regen[1] }; this.push({ k: 'status', p: i, type: 'regen', dur: f.regen[1] }); }
    if (f.phoenix) { me.phoenix = f.phoenix[0]; me.phoenixHp = f.phoenix[1]; this.push({ k: 'status', p: i, type: 'phoenix', dur: f.phoenix[0] }); }

    if (hostile) this.proj.push({ id, src: i, tgt: 1 - i, t: sp.travel, pw, hitIdx: 0, hits: f.hits || 1, gap: f.hitGap || 0.2, wait: 0, reflected: false, landed: false, fx: f });
    return { ok: true };
  }

  // ------------------------------------------------------------ Effekte
  heal(i, amt, src) {
    const me = this.p[i];
    const a = Math.max(0, Math.min(CFG.maxHp - me.hp, amt));
    me.hp += a; me.stats.heal += a;
    if (amt > 0) this.push({ k: 'heal', p: i, amount: a, hp: Math.round(me.hp), src });
  }
  addMana(i, amt) {
    const me = this.p[i];
    const a = Math.min(CFG.maxMana - me.mana, amt);
    me.mana += a;
    if (a > 0) this.push({ k: 'mana', p: i, amount: Math.round(a) });
  }
  addShield(i, amt, dur) {
    const me = this.p[i];
    me.shield += amt; me.shieldT = Math.max(me.shieldT, dur);
    this.push({ k: 'shield', p: i, amount: amt, total: Math.round(me.shield), dur });
  }
  status(i, type, dur, dps) {
    const me = this.p[i];
    if (type === 'burn' || type === 'poison') me[type] = { dps, t: Math.max(dur, me[type] ? me[type].t : 0) };
    else me[type] = Math.max(me[type], dur);
    this.push({ k: 'status', p: i, type, dur });
  }
  cleanse(i) {
    const me = this.p[i];
    me.burn = null; me.poison = null; me.chill = 0; me.stun = 0; me.curse = 0;
    this.push({ k: 'cleanse', p: i });
  }

  damage(T, amount, pierceShield) {
    if (T.curse > 0) amount = Math.round(amount * CFG.curseMul);
    let absorbed = 0;
    if (!pierceShield && T.shield > 0) { absorbed = Math.min(T.shield, amount); T.shield -= absorbed; }
    const dealt = amount - absorbed;
    T.hp = Math.max(0, T.hp - dealt);
    return { dealt, absorbed };
  }

  // Ein Geschoss kommt an (erster Treffer) bzw. weitere Treffer einer Salve
  land(pr) {
    const T = this.p[pr.tgt], S = this.p[pr.src], sp = SPELL_BY_ID[pr.id], f = pr.fx || sp.fx;
    if (pr.hitIdx === 0) {
      if (!f.pierce && T.phase > 0) { T.phase = 0; this.push({ k: 'evade', p: pr.tgt, id: pr.id }); pr.landed = true; pr.hitIdx = pr.hits; return; }
      if (!f.pierce && T.reflect > 0 && !pr.reflected) {
        T.reflect = 0;
        this.push({ k: 'reflect', p: pr.tgt, id: pr.id, travel: CFG.reflectTravel });
        this.proj.push({ ...pr, src: pr.tgt, tgt: pr.src, t: CFG.reflectTravel, hitIdx: 0, wait: 0, reflected: true, landed: false });
        pr.landed = true; pr.hitIdx = pr.hits; return;
      }
      if (f.shieldBreak && T.shield > 0) { const b = Math.round(T.shield); T.shield = 0; this.push({ k: 'shield', p: pr.tgt, amount: -b, total: 0 }); }
      if (f.burn) this.status(pr.tgt, 'burn', f.burn[1], f.burn[0] * pr.pw);
      if (f.poison) this.status(pr.tgt, 'poison', f.poison[1], f.poison[0] * pr.pw);
      if (f.chill) this.status(pr.tgt, 'chill', f.chill);
      if (f.stun) this.status(pr.tgt, 'stun', f.stun);
      if (f.curse) this.status(pr.tgt, 'curse', f.curse);
      if (f.gcdHit) { T.gcd += f.gcdHit; this.push({ k: 'status', p: pr.tgt, type: 'gcd', dur: f.gcdHit }); }
    }
    if (f.dmg) {
      const amount = Math.max(1, Math.round(f.dmg * pr.pw));
      const r = this.damage(T, amount, false);
      S.stats.dmg += r.dealt;
      this.push({ k: 'hit', p: pr.tgt, src: pr.src, id: pr.id, n: pr.hitIdx, amount: r.dealt, absorbed: r.absorbed, hp: Math.round(T.hp), shield: Math.round(T.shield) });
      if (f.drain && r.dealt > 0) this.heal(pr.src, Math.round(r.dealt * f.drain), 'drain');
    } else if (pr.hitIdx === 0) {
      this.push({ k: 'hit', p: pr.tgt, src: pr.src, id: pr.id, n: 0, amount: 0, absorbed: 0, hp: Math.round(T.hp), shield: Math.round(T.shield) });
    }
    pr.hitIdx++;
    pr.landed = true;
    pr.wait = pr.gap;
  }

  // ------------------------------------------------------------ Zeitschritt
  step(dt) {
    if (this.over) return;
    this.t += dt;
    for (let i = 0; i < 2; i++) {
      const me = this.p[i];
      me.gcd = Math.max(0, me.gcd - dt);
      for (const id in me.cds) if (me.cds[id] > 0) me.cds[id] = Math.max(0, me.cds[id] - dt);
      const regen = CFG.regen * (me.chill > 0 ? CFG.chillRegen : 1) * (me.haste > 0 ? CFG.hasteRegen : 1);
      me.mana = Math.min(CFG.maxMana, me.mana + regen * dt);
      for (const s of ['chill', 'stun', 'reflect', 'phase', 'haste', 'curse', 'phoenix']) if (me[s] > 0) me[s] = Math.max(0, me[s] - dt);
      if (me.shieldT > 0) { me.shieldT -= dt; if (me.shieldT <= 0 && me.shield > 0) { me.shield = 0; me.shieldT = 0; this.push({ k: 'shield', p: i, amount: 0, total: 0, expired: true }); } }
      // Dauerschaden / Regeneration
      me.dotAcc += dt;
      while (me.dotAcc >= CFG.dotTick) {
        me.dotAcc -= CFG.dotTick;
        if (me.regen) { this.heal(i, Math.max(1, Math.round(me.regen.hps * CFG.dotTick)), 'regen'); me.regen.t -= CFG.dotTick; if (me.regen.t <= 0) { me.regen = null; this.push({ k: 'statusEnd', p: i, type: 'regen' }); } }
        for (const type of ['burn', 'poison']) {
          const d = me[type];
          if (!d) continue;
          const amount = Math.max(1, Math.round(d.dps * CFG.dotTick));
          const r = this.damage(me, amount, type === 'poison');
          this.p[1 - i].stats.dmg += r.dealt;
          this.push({ k: 'dot', p: i, type, amount: r.dealt, absorbed: r.absorbed, hp: Math.round(me.hp), shield: Math.round(me.shield) });
          d.t -= CFG.dotTick;
          if (d.t <= 0) { me[type] = null; this.push({ k: 'statusEnd', p: i, type }); }
        }
      }
    }
    // Geschosse
    for (const pr of this.proj) {
      if (!pr.landed) { pr.t -= dt; if (pr.t <= 0) this.land(pr); }
      else if (pr.hitIdx < pr.hits) { pr.wait -= dt; if (pr.wait <= 0) this.land(pr); }
    }
    this.proj = this.proj.filter((pr) => !pr.landed || pr.hitIdx < pr.hits);

    // Sudden Death
    if (this.t > CFG.suddenAt) {
      this.sdAcc += dt;
      if (this.sdAcc >= 1) {
        this.sdAcc -= 1;
        const amount = Math.round(2 + 0.25 * (this.t - CFG.suddenAt));
        for (let i = 0; i < 2; i++) {
          const me = this.p[i];
          me.hp = Math.max(0, me.hp - amount);
          this.push({ k: 'dot', p: i, type: 'sudden', amount, absorbed: 0, hp: Math.round(me.hp), shield: Math.round(me.shield) });
        }
      }
    }

    // Phönix: statt zu sterben wiederauferstehen
    for (let i = 0; i < 2; i++) {
      const me = this.p[i];
      if (me.hp <= 0 && me.phoenix > 0) {
        me.phoenix = 0; me.hp = Math.round(CFG.maxHp * me.phoenixHp); me.burn = null; me.poison = null; me.chill = 0; me.stun = 0; me.curse = 0; me.shield = 0; me.shieldT = 0;
        this.push({ k: 'rebirth', p: i, hp: Math.round(me.hp) });
      }
    }

    // Ende?
    const d0 = this.p[0].hp <= 0, d1 = this.p[1].hp <= 0;
    if (d0 || d1) this.finish(d0 && d1 ? -1 : d0 ? 1 : 0, 'ko');
    else if (this.t >= CFG.duration) this.finish(this.p[0].hp === this.p[1].hp ? -1 : this.p[0].hp > this.p[1].hp ? 0 : 1, 'time');
  }

  finish(winner, reason) {
    this.over = true; this.winner = winner; this.reason = reason;
    this.push({ k: 'end', winner, reason });
  }

  snapshot() {
    const r1 = (v) => Math.round(v * 10) / 10;
    return {
      t: r1(this.t),
      p: this.p.map((me) => ({
        hp: Math.round(me.hp), mana: r1(me.mana), gcd: r1(me.gcd),
        cds: Object.fromEntries(Object.entries(me.cds).filter(([, v]) => v > 0).map(([k, v]) => [k, r1(v)])),
        shield: Math.round(me.shield), shT: r1(me.shieldT),
        burn: me.burn ? r1(me.burn.t) : 0, poison: me.poison ? r1(me.poison.t) : 0,
        chill: r1(me.chill), stun: r1(me.stun), reflect: r1(me.reflect), phase: r1(me.phase), haste: r1(me.haste),
        curse: r1(me.curse), regen: me.regen ? r1(me.regen.t) : 0, phoenix: r1(me.phoenix),
      })),
      pr: this.proj.filter((x) => !x.landed).map((x) => [x.id, x.src, Math.round(x.t * 10) / 10]),
    };
  }
}

export { STATUSES };
