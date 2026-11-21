// Playing cards: what is legal (rulebook law 1C + 4), listing plays for bots/UI, reaction windows and resolution.
import { GATE, STABLE, absOf, absOfHorse, horseAt, kick, onTrack, relOf, seatOf } from '../../board.ts';
import { target } from '../../engine.ts';
import type { Ctx, GameState, Horse, Pick } from '../../types.ts';
import { DUEL_CARDS as C, MAX_TRAPS, TRAP_LIFE, TRI, type CardDef } from './cards.ts';
import {
  addLayer, cardMove, controlled, draw, duel, isGate, isStart, jump, kickable, lead, ringDist, seal, setFx, steal, swap, swapTo,
} from './effects.ts';

const int = (x: unknown): x is number => Number.isInteger(x);

/** Mở Rộng multiplier of a play (1 when played alone). */
const multOf = (picks: Pick[]) => (picks.length > 1 ? 1 + picks.filter(p => p.card === 'morong').length : 1);

/** The card that Mở Rộng multiplies: the plain card if there is one, else Tích Lực. */
const recipient = (picks: Pick[]) => picks.find(p => !C[p.card].combo)?.card ?? (picks.some(p => p.card === 'tichluc') ? 'tichluc' : undefined);

/** Reach of card `id` inside this play. */
export function reach(picks: Pick[], id: string) {
  const base = C[id].range ?? 0;
  return recipient(picks) === id ? base * multOf(picks) : base;
}

/** Xung Phong's 12: only along the track (from the gate a die enters the home column, which caps at 6). */
const far = (s: GameState, h: Horse) => h.pos < GATE && target(s, h, 12) !== null;

/** First enemy ahead of `h` within `range` squares with a clear path (Đột Kích). */
export function charge(s: GameState, h: Horse, range: number): Horse | undefined {
  const seat = seatOf(s, h.owner);
  for (let q = h.pos + 1; q <= Math.min(h.pos + range, GATE); q++) {
    const occ = horseAt(s, absOf(seat, q));
    if (occ) return occ.owner !== h.owner ? occ : undefined;
  }
}

/** May player `p` put a trap on `abs` with this die face? */
export function trapSpot(s: GameState, p: number, abs: number, face: number): boolean {
  const d = duel(s);
  if (!int(abs) || abs < 0 || abs > 51 || isStart(abs) || isGate(abs) || horseAt(s, abs) || d.traps.some(t => t.abs === abs)) return false;
  if (d.traps.filter(t => t.owner === p).length >= MAX_TRAPS) return false;
  return s.horses.some(h => h.owner === p && onTrack(h) && ringDist(absOfHorse(s, h), abs) <= face * 2);
}

function okTarget(s: GameState, p: number, pk: Pick, picks: Pick[]): boolean {
  const c = C[pk.card], t = pk.t;
  const n = { none: 0, own: 1, foe: 1, any: 1, stable: 1, player: 1, square: 1, trap: 1, ownFoe: 2, ownN: 2, anyN: 2, ownDest: 2, any2: 2 }[c.aim];
  if (!Array.isArray(t) || t.length !== n || !t.every(int)) return false;
  const horse = (i: number) => (t[i] >= 0 && t[i] < s.horses.length ? s.horses[t[i]] : undefined);
  const own = (h?: Horse) => !!h && h.owner === p && onTrack(h);
  const free = (h?: Horse) => own(h) && !controlled(h!); // your own cards never move a controlled horse
  const foe = (h?: Horse) => !!h && h.owner !== p && onTrack(h);
  const r = reach(picks, pk.card);
  switch (pk.card) {
    case 'tichluc': case 'songma': case 'xungphong': case 'dotkich': {
      const h = horse(0);
      if (!free(h)) return false;
      if (pk.card === 'songma') return target(s, h!, s.dice) !== null;
      if (pk.card === 'xungphong') return far(s, h!) || target(s, h!, 6) !== null;
      if (pk.card === 'dotkich') return !!charge(s, h!, r);
      return true;
    }
    case 'giaitru': return own(horse(0)) && controlled(horse(0)!);
    case 'hothuan': case 'giap': case 'miennhiem': return own(horse(0));
    case 'xuatchuong': {
      const h = horse(0);
      if (!h || h.owner !== p || h.pos !== STABLE) return false;
      const occ = horseAt(s, absOf(seatOf(s, p), 0));
      return !occ || (occ.owner !== p && kickable(s, occ));
    }
    case 'hoandoi': {
      const [a, b] = [horse(0), horse(1)];
      return free(a) && foe(b) && ringDist(absOfHorse(s, a!), absOfHorse(s, b!)) <= r && !!swapTo(s, a!, b!);
    }
    case 'luine': return free(horse(0)) && t[1] >= 1 && t[1] <= r;
    case 'gioxo': {
      const h = horse(0);
      return (foe(h) || free(h)) && t[1] >= 1 && t[1] <= r;
    }
    case 'dichchuyen': {
      const h = horse(0);
      return free(h) && t[1] > h!.pos && t[1] <= Math.min(h!.pos + r, GATE) && !horseAt(s, absOf(seatOf(s, p), t[1]));
    }
    case 'l5': {
      const h = horse(0);
      if (!h || h.owner !== p || !(h.pos === STABLE || (onTrack(h) && !controlled(h)))) return false;
      return t[1] > h.pos && t[1] >= 0 && t[1] <= GATE && !horseAt(s, absOf(seatOf(s, p), t[1]));
    }
    case 'l2': {
      const [a, b] = [horse(0), horse(1)];
      const shielded = (h: Horse) => h.owner !== p && duel(s).aegis[h.owner] > 0;
      return !!a && !!b && !shielded(a) && !shielded(b) && !!swapTo(s, a, b);
    }
    case 'locxoay':
      return int(t[0]) && t[0] >= 0 && t[0] < 52 && s.horses.some(h => own(h) && ringDist(absOfHorse(s, h), t[0]) <= r);
    case 'dobay': return duel(s).traps.some(x => x.abs === t[0]);
    case 'cuopbai': case 'phongan': case 'doatvi': {
      const q = t[0];
      if (q < 0 || q >= s.players.length || q === p) return false;
      if (pk.card === 'cuopbai') return s.players[q].cards.length > 0;
      if (pk.card === 'doatvi') return s.horses.filter(h => h.owner === q && onTrack(h)).length >= 2;
      return true;
    }
  }
  if (c.kind === 'trap') return trapSpot(s, p, t[0], s.dice);
  if (c.aim === 'foe') return foe(horse(0));
  return c.aim === 'none';
}

/** Is this play legal for the player on turn? (law 1C: face rule; law 4: combos) */
export function validPlay(s: GameState, picks: Pick[]): boolean {
  const d = s.duel;
  if (!d || s.phase !== 'move' || d.pending || !Array.isArray(picks) || !picks.length || picks.length > 6) return false;
  const p = s.turn;
  if (d.plays <= 0 || d.sealed[p] > 0) return false;
  if (!picks.every(pk => pk && typeof pk.card === 'string' && C[pk.card] && Array.isArray(pk.t))) return false;
  // the cards must be in hand (legends: held)
  const hand = [...s.players[p].cards];
  for (const pk of picks) {
    if (C[pk.card].kind === 'legend') {
      if (d.legend[p] !== pk.card) return false;
      continue;
    }
    const i = hand.indexOf(pk.card);
    if (i < 0) return false;
    hand.splice(i, 1);
  }
  const face = s.dice;
  if (picks.length === 1) {
    const c = C[picks[0].card];
    if (c.kind === 'react') return false;
    if (c.kind !== 'trap' && c.point !== face) return false;
  } else {
    if (picks.length !== face) return false;
    if (picks.some(pk => C[pk.card].kind === 'trap' || C[pk.card].kind === 'legend' || C[pk.card].kind === 'react')) return false;
    const plain = picks.filter(pk => !C[pk.card].combo);
    const grow = picks.some(pk => pk.card === 'morong');
    if (plain.length > 1) return false;
    if (plain.length === 1 && (!grow || !C[plain[0].card].range)) return false;
    if (grow && !recipient(picks)) return false;
    const runs = picks.filter(pk => pk.card === 'tichluc');
    if (runs.some(pk => pk.t[0] !== runs[0].t[0])) return false;
  }
  return picks.every(pk => okTarget(s, p, pk, picks));
}

// ---------- listing (bots, UI hints) ----------

function aims(s: GameState, p: number, c: CardDef, id: string, picks: Pick[]): number[][] {
  const ids = (f: (h: Horse) => boolean) => s.horses.filter(f).map(h => h.id);
  const own = ids(h => h.owner === p && onTrack(h));
  const foes = ids(h => h.owner !== p && onTrack(h));
  const r = reach(picks, id);
  const span = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  switch (c.aim) {
    case 'none': return [[]];
    case 'own': return own.map(h => [h]);
    case 'foe': return foes.map(h => [h]);
    case 'any': return [...own, ...foes].map(h => [h]);
    case 'stable': return ids(h => h.owner === p && h.pos === STABLE).slice(0, 1).map(h => [h]);
    case 'player': return s.players.map((_, q) => [q]).filter(([q]) => q !== p);
    case 'square': return span(0, 51).map(a => [a]);
    case 'trap': return duel(s).traps.map(x => [x.abs]);
    case 'ownFoe': return own.flatMap(a => foes.map(b => [a, b]));
    case 'ownN': return own.flatMap(h => span(1, r).map(n => [h, n]));
    case 'anyN': return [...own, ...foes].flatMap(h => span(1, r).map(n => [h, n]));
    case 'ownDest': {
      const mine = id === 'l5' ? ids(h => h.owner === p && (onTrack(h) || h.pos === STABLE)) : own;
      return mine.flatMap(h => span(s.horses[h].pos + 1, Math.min(id === 'l5' ? GATE : s.horses[h].pos + r, GATE)).map(q => [h, q]));
    }
    case 'any2': {
      const all = [...own, ...foes];
      return all.flatMap((a, i) => all.slice(i + 1).map(b => [a, b]));
    }
  }
}

/** Every legal single card, trap, legend and same-target combo for the player on turn. */
export function playList(s: GameState): Pick[][] {
  const d = s.duel;
  if (!d || s.phase !== 'move' || d.pending || d.plays <= 0 || d.sealed[s.turn] > 0) return [];
  const p = s.turn;
  const hand = s.players[p].cards.filter(c => C[c]);
  const out: Pick[][] = [];
  const add = (cards: string[]) => {
    const names = [...new Set(cards)];
    const shell = cards.map(card => ({ card, t: [] as number[] }));
    const options = names.map(n => aims(s, p, C[n], n, shell));
    const walk = (i: number, chosen: number[][]) => {
      if (i === names.length) {
        const picks = cards.map(card => ({ card, t: chosen[names.indexOf(card)] }));
        if (validPlay(s, picks)) out.push(picks);
        return;
      }
      for (const o of options[i]) walk(i + 1, [...chosen, o]);
    };
    walk(0, []);
  };
  for (const c of new Set(hand)) add([c]);
  if (d.legend[p]) add([d.legend[p]]);
  const face = s.dice;
  if (face >= 2) {
    const stars = hand.filter(c => C[c].combo);
    const plains = [...new Set(hand.filter(c => !C[c].combo && C[c].range))];
    const seen = new Set<string>();
    const pickN = (pool: string[], k: number, start: number, acc: string[], extra?: string) => {
      if (acc.length === k) {
        const cards = extra ? [...acc, extra] : [...acc];
        const key = [...cards].sort().join();
        if (!seen.has(key)) seen.add(key), add(cards);
        return;
      }
      for (let i = start; i < pool.length; i++) pickN(pool, k, i + 1, [...acc, pool[i]], extra);
    };
    pickN(stars, face, 0, []);
    for (const x of plains) pickN(stars, face - 1, 0, [], x);
  }
  return out;
}

// ---------- resolution ----------

/** Opponents a play hits (who may react), in seat order after the player. */
export function victims(s: GameState, by: number, picks: Pick[]): number[] {
  const hit = new Set<number>();
  for (const pk of picks) {
    if (C[pk.card].kind !== 'hex') continue;
    const horse = (i: number) => s.horses[pk.t[i]];
    switch (C[pk.card].aim) {
      case 'foe': case 'anyN': hit.add(horse(0).owner); break;
      case 'ownFoe': hit.add(horse(1).owner); break;
      case 'player': hit.add(pk.t[0]); break;
    }
    if (pk.card === 'dotkich') {
      const e = charge(s, horse(0), reach(picks, pk.card));
      if (e) hit.add(e.owner);
    }
    if (pk.card === 'locxoay')
      for (const h of s.horses) if (h.owner !== by && onTrack(h) && ringDist(absOfHorse(s, h), pk.t[0]) <= 2) hit.add(h.owner);
  }
  hit.delete(by);
  const n = s.players.length;
  return [...hit].sort((a, b) => ((a - by + n) % n) - ((b - by + n) % n));
}

/** Reaction cards `q` may answer with (same face as the attack, law 1C.6). */
export function reactions(s: GameState, q: number, face: number): string[] {
  const d = duel(s);
  if (d.sealed[q] > 0) return [];
  return [...new Set(s.players[q].cards.filter(c => C[c]?.kind === 'react' && C[c].point === face))];
}

/** Apply a play. `by` = whose effect it is (the reflecting player after Phản Đòn). */
export function resolve(s: GameState, by: number, picks: Pick[], ctx: Ctx) {
  const d = duel(s);
  if (!picks.length) return;
  const legendary = C[picks[0].card].kind === 'legend';
  const blocked = new Set<number>(), through = new Set<number>();
  /** May an effect of `by` touch this enemy horse? Hộ Thuẫn eats one hit per play and per horse (law 11). */
  const reach0 = (h: Horse) => {
    if (h.owner === by) return true;
    if (d.aegis[h.owner] > 0) return false;
    if (legendary || through.has(h.id)) return true;
    if (blocked.has(h.id) || h.fx?.immune) return false;
    if (h.fx?.guard) {
      setFx(h, 'guard', h.fx.guard - 1, ctx);
      blocked.add(h.id);
      return false;
    }
    through.add(h.id);
    return true;
  };
  const player = (q: number) => !(d.aegis[q] > 0);
  const horse = (pk: Pick, i = 0) => s.horses[pk.t[i]];
  const count = (id: string) => picks.filter(x => x.card === id).length;
  const done = new Set<string>();

  for (const pk of picks) {
    const h = horse(pk);
    switch (pk.card) {
      case 'tichluc':
        if (done.has('tichluc')) break;
        done.add('tichluc');
        cardMove(s, h, 1, TRI[count('tichluc')] * (recipient(picks) === 'tichluc' ? multOf(picks) : 1), ctx);
        break;
      case 'morong':
        if (picks.length === 1) draw(s, by, 1, ctx);
        break;
      case 'bangphong':
        if (reach0(h)) addLayer(h, 'ice', 1, ctx);
        break;
      case 'hothuan':
        setFx(h, 'guard', (h.fx?.guard ?? 0) + 1, ctx);
        h.fx!.guardT = 3;
        break;
      case 'phakhien':
        if (d.aegis[h.owner] > 0) break; // the shield breaker ignores Hộ Thuẫn and Miễn Nhiễm
        for (const k of ['guard', 'armor', 'immune'] as const) setFx(h, k, 0, ctx);
        break;
      case 'giaitru':
        for (const k of ['ice', 'rev', 'chain'] as const) setFx(h, k, 0, ctx);
        break;
      case 'hoandoi':
        if (reach0(horse(pk, 1))) swap(s, h, horse(pk, 1), ctx);
        break;
      case 'xichchan':
        if (reach0(h)) addLayer(h, 'chain', 2, ctx);
        break;
      case 'songma':
        ctx.move(h, s.dice);
        d.noMove = h.id;
        break;
      case 'dobay': {
        const tr = d.traps.find(x => x.abs === pk.t[0]);
        if (!tr) break;
        if (!d.known[by].includes(tr.abs)) d.known[by].push(tr.abs);
        ctx.ev.push({ t: 'reveal', player: by, abs: tr.abs, kind: tr.kind });
        const near = s.horses.some(o => o.owner === by && onTrack(o) && relOf(seatOf(s, by), tr.abs) - o.pos >= 1 && relOf(seatOf(s, by), tr.abs) - o.pos <= 12);
        if (near && tr.owner !== by) {
          d.traps = d.traps.filter(x => x !== tr);
          d.known = d.known.map(k => k.filter(a => a !== tr.abs));
          ctx.ev.push({ t: 'trap', abs: tr.abs, owner: tr.owner, kind: tr.kind, on: false });
        }
        break;
      }
      case 'daykeo':
        if (reach0(h)) cardMove(s, h, -1, reach(picks, 'daykeo'), ctx, false);
        break;
      case 'luine':
        cardMove(s, h, -1, pk.t[1], ctx);
        break;
      case 'dolai':
        d.streak[by] = [...d.prevStreak]; // the dropped result doesn't count towards a legend
        ctx.roll(1 + Math.floor(ctx.rng() * 6));
        break;
      case 'cuopbai':
        if (player(pk.t[0])) steal(s, pk.t[0], by, 1, ctx);
        break;
      case 'gioxo':
        if (reach0(h)) cardMove(s, h, 1, pk.t[1], ctx, false);
        break;
      case 'giap':
        setFx(h, 'armor', 1, ctx);
        h.fx!.armorT = 3;
        break;
      case 'dotkich': {
        const e = charge(s, h, reach(picks, 'dotkich'));
        if (!e) break;
        const gap = relOf(seatOf(s, by), absOfHorse(s, e)) - h.pos;
        if (reach0(e) && kickable(s, e)) cardMove(s, h, 1, gap, ctx);
        else cardMove(s, h, 1, gap - 1, ctx);
        break;
      }
      case 'locxoay':
        for (const o of s.horses)
          if (o.owner !== by && onTrack(o) && ringDist(absOfHorse(s, o), pk.t[0]) <= 2 && reach0(o)) cardMove(s, o, -1, 2, ctx, false);
        break;
      case 'xuatchuong': {
        const occ = horseAt(s, absOf(seatOf(s, by), 0));
        h.pos = 0;
        ctx.ev.push({ t: 'move', horse: h.id, path: [0] });
        if (occ && occ.owner !== by) kick(occ, h, ctx);
        break;
      }
      case 'miennhiem':
        setFx(h, 'immune', 1, ctx);
        break;
      case 'doatvi': {
        const q = pk.t[0];
        const a = lead(s, q), b = lead(s, q, true);
        if (player(q) && a && b && a !== b) {
          [a.pos, b.pos] = [b.pos, a.pos];
          ctx.ev.push({ t: 'move', horse: a.id, path: [a.pos], jump: true }, { t: 'move', horse: b.id, path: [b.pos], jump: true });
        }
        break;
      }
      case 'phongan':
        if (player(pk.t[0])) seal(s, pk.t[0], ctx);
        break;
      case 'dichchuyen':
      case 'l5':
        jump(s, h, pk.t[1], ctx);
        break;
      case 'xungphong':
        ctx.move(h, far(s, h) ? 12 : 6);
        ctx.endTurn(s.dice === 6); // this was the turn's move
        break;
      // legends
      case 'l1':
        for (const o of s.horses) if (o.owner !== by && onTrack(o) && reach0(o)) addLayer(o, 'ice', 1, ctx, true);
        break;
      case 'l2':
        swap(s, h, horse(pk, 1), ctx);
        break;
      case 'l3':
        if (reach0(h)) kick(h, lead(s, by) ?? s.horses[by * 4], ctx);
        break;
      case 'l4':
        d.aegis[by] = 3;
        break;
      case 'l6':
        d.extra += 2;
        d.plays += 2;
        break;
      default:
        if (C[pk.card].kind === 'trap') {
          d.traps.push({ abs: pk.t[0], owner: by, kind: pk.card, left: TRAP_LIFE });
          ctx.ev.push({ t: 'trap', abs: pk.t[0], owner: by, kind: pk.card, on: true });
        }
    }
  }
}

/** Phản Đòn: hits on horses or on the reflecting player go back to the attacker's lead horse / the attacker. */
export function reflect(s: GameState, by: number, me: number, picks: Pick[]): Pick[] {
  const back = lead(s, by);
  const out: Pick[] = [];
  for (const pk of picks) {
    const c = C[pk.card];
    if (c.kind !== 'hex') continue;
    if (c.aim === 'player' && pk.t[0] === me) out.push({ card: pk.card, t: [by] });
    else if ((c.aim === 'foe' || c.aim === 'anyN') && back && s.horses[pk.t[0]].owner === me) out.push({ card: pk.card, t: [back.id, ...pk.t.slice(1)] });
  }
  return out;
}
