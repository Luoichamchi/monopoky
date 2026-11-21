// Duel building blocks: statuses, card-driven movement, swaps, traps, drawing. Everything pushes GameEvents.
import { GATE, HORSES, TRACK, absOf, absOfHorse, horseAt, kick, onTrack, relOf, seatOf } from '../../board.ts';
import type { Ctx, DuelState, GameState, Horse, HorseFx, Rng, Trap } from '../../types.ts';
import { LEGENDS, MAX_LAYERS } from './cards.ts';

export const duel = (s: GameState) => s.duel as DuelState;
export const ringDist = (a: number, b: number) => Math.min(Math.abs(a - b), TRACK - Math.abs(a - b));
export const controlled = (h: Horse) => !!(h.fx && (h.fx.ice || h.fx.rev || h.fx.chain));
export const isStart = (abs: number) => [0, 1, 2, 3].some(q => absOf(q, 0) === abs);
export const isGate = (abs: number) => [0, 1, 2, 3].some(q => absOf(q, GATE) === abs);

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Set one status counter (0 removes it) and keep the classic mirrors the renderers read: frozen = ice, shield = guard. */
export function setFx(h: Horse, kind: keyof HorseFx, n: number, ctx: Ctx) {
  const f = (h.fx ??= {});
  const was = f[kind] ?? 0;
  if (n > 0) f[kind] = n;
  else delete f[kind];
  if (kind === 'guard' && n <= 0) delete f.guardT;
  if (kind === 'armor' && n <= 0) delete f.armorT;
  if (!Object.keys(f).length) h.fx = undefined;
  h.frozen = h.fx?.ice ?? 0;
  h.shield = h.fx?.guard ?? 0;
  if (was !== n && (kind === 'ice' || kind === 'rev' || kind === 'chain' || kind === 'guard' || kind === 'armor' || kind === 'immune'))
    ctx.ev.push({ t: 'status', horse: h.id, kind, n: Math.max(0, n) });
}

/** Add control layers (capped). `force` = a legend: ignores Miễn Nhiễm. */
export function addLayer(h: Horse, kind: 'ice' | 'rev' | 'chain', n: number, ctx: Ctx, force = false) {
  if (!onTrack(h) || (!force && h.fx?.immune)) return;
  setFx(h, kind, Math.min(MAX_LAYERS, (h.fx?.[kind] ?? 0) + n), ctx);
}

/** Can `victim` be kicked (by a move or a card)? Hộ Thuẫn and the legend shield stop it. */
export const kickable = (s: GameState, victim: Horse) => !(victim.fx?.guard ?? 0) && !(duel(s).aegis[victim.owner] > 0);

/** The furthest-ahead / furthest-behind track horse of a player. */
export function lead(s: GameState, p: number, last = false): Horse | undefined {
  const mine = s.horses.filter(h => h.owner === p && onTrack(h)).sort((a, b) => b.pos - a.pos);
  return last ? mine.at(-1) : mine[0];
}

/**
 * Card movement (rulebook law 6): step by step, never past a horse. If the very last step lands on a kickable
 * enemy, kick it (when `canKick`). Stops at the own gate and at the start square. Then the landing (traps).
 */
export function cardMove(s: GameState, h: Horse, dir: 1 | -1, n: number, ctx: Ctx, canKick = true) {
  if (n <= 0 || !onTrack(h)) return;
  const seat = seatOf(s, h.owner);
  const path: number[] = [];
  let p = h.pos;
  let victim: Horse | undefined;
  while (path.length < n) {
    const q = p + dir;
    if (q < 0 || q > GATE) break;
    const occ = horseAt(s, absOf(seat, q));
    if (occ) {
      if (canKick && path.length === n - 1 && occ.owner !== h.owner && kickable(s, occ)) (victim = occ), path.push((p = q));
      break;
    }
    path.push((p = q));
  }
  if (!path.length) return;
  ctx.ev.push({ t: 'move', horse: h.id, path });
  h.pos = p;
  if (victim) kick(victim, h, ctx);
  landed(s, h, ctx);
}

/** Positions after swapping two track horses, or null if either would end past its own gate. */
export function swapTo(s: GameState, a: Horse, b: Horse): [number, number] | null {
  if (!onTrack(a) || !onTrack(b) || a.id === b.id) return null;
  const pa = relOf(seatOf(s, a.owner), absOfHorse(s, b));
  const pb = relOf(seatOf(s, b.owner), absOfHorse(s, a));
  return pa <= GATE && pb <= GATE ? [pa, pb] : null;
}

export function swap(s: GameState, a: Horse, b: Horse, ctx: Ctx) {
  const to = swapTo(s, a, b);
  if (!to) return;
  [a.pos, b.pos] = to;
  ctx.ev.push({ t: 'move', horse: a.id, path: [a.pos], jump: true }, { t: 'move', horse: b.id, path: [b.pos], jump: true });
  landed(s, a, ctx);
  landed(s, b, ctx);
}

export function jump(s: GameState, h: Horse, pos: number, ctx: Ctx) {
  h.pos = pos;
  ctx.ev.push({ t: 'move', horse: h.id, path: [pos], jump: true });
  landed(s, h, ctx);
}

// ---------- cards in hand ----------

export function draw(s: GameState, p: number, n: number, ctx: Ctx) {
  const d = duel(s);
  for (let i = 0; i < n; i++) {
    if (!d.decks[p].length) d.decks[p] = shuffle(d.discards[p].splice(0), ctx.rng);
    const c = d.decks[p].pop();
    if (!c) return;
    s.players[p].cards.push(c);
    ctx.ev.push({ t: 'draw', player: p, card: c });
  }
}

/** Move `n` random cards from one hand to another. */
export function steal(s: GameState, from: number, to: number, n: number, ctx: Ctx) {
  const hand = s.players[from].cards;
  for (let i = 0; i < n && hand.length; i++) {
    const [c] = hand.splice(Math.floor(ctx.rng() * hand.length), 1);
    s.players[to].cards.push(c);
    ctx.ev.push({ t: 'steal', from, to, card: c });
  }
}

export function discardRandom(s: GameState, p: number, ctx: Ctx) {
  const hand = s.players[p].cards;
  if (!hand.length) return;
  const [c] = hand.splice(Math.floor(ctx.rng() * hand.length), 1);
  duel(s).discards[p].push(c);
  ctx.ev.push({ t: 'discard', player: p, card: c });
}

export function grantLegend(s: GameState, p: number, face: number, ctx: Ctx) {
  const d = duel(s);
  const id = LEGENDS[face - 1];
  if (d.legend[p] || d.legendsTaken.includes(id)) return draw(s, p, 2, ctx); // one each, one copy per game
  d.legend[p] = id;
  d.legendsTaken.push(id);
  ctx.ev.push({ t: 'legend', player: p, card: id });
}

export function seal(s: GameState, p: number, ctx: Ctx) {
  duel(s).sealed[p] = 2; // through the end of their next turn (counted at their turn starts)
  ctx.ev.push({ t: 'seal', player: p, on: true });
}

// ---------- traps ----------

export function removeTrap(s: GameState, tr: Trap, ctx: Ctx) {
  const d = duel(s);
  d.traps = d.traps.filter(x => x !== tr);
  d.known = d.known.map(k => k.filter(a => a !== tr.abs));
  ctx.ev.push({ t: 'trap', abs: tr.abs, owner: tr.owner, kind: tr.kind, on: false });
}

let springing = false; // a trap's own effect never sets off another trap (law 2.5)

/** A horse stopped on a track square: an enemy trap there goes off (law 2: stops only, enemies only). */
export function landed(s: GameState, h: Horse, ctx: Ctx) {
  const d = s.duel;
  if (!d || springing || !onTrack(h)) return;
  const abs = absOfHorse(s, h);
  const tr = d.traps.find(x => x.abs === abs);
  if (!tr || tr.owner === h.owner || d.aegis[h.owner] > 0 || h.fx?.immune) return;
  removeTrap(s, tr, ctx);
  if (h.fx?.armor) return setFx(h, 'armor', 0, ctx);
  ctx.ev.push({ t: 'spring', abs, owner: tr.owner, kind: tr.kind, horse: h.id });
  springing = true;
  try {
    spring(s, tr, h, ctx);
  } finally {
    springing = false;
  }
}

function spring(s: GameState, tr: Trap, h: Horse, ctx: Ctx) {
  const d = duel(s);
  const own = tr.owner;
  switch (tr.kind) {
    case 'bhoandoi': {
      const f = lead(s, own, true);
      if (f) swap(s, h, f, ctx);
      break;
    }
    case 'blienket': {
      const f = lead(s, own, true);
      if (f) {
        d.links.push({ leader: h.id, follower: f.id, left: 2 });
        ctx.ev.push({ t: 'link', leader: h.id, follower: f.id, on: true });
      }
      break;
    }
    case 'bdoathon':
      steal(s, h.owner, own, 2, ctx);
      seal(s, h.owner, ctx);
      break;
    case 'bhoden':
      kick(h, s.horses[own * HORSES], ctx);
      break;
    case 'bbanggioi':
      for (const o of s.horses)
        if (o.owner !== own && onTrack(o) && !(d.aegis[o.owner] > 0) && ringDist(absOfHorse(s, o), tr.abs) <= 3) addLayer(o, 'ice', 2, ctx);
      break;
    case 'bdaochieu':
      addLayer(h, 'rev', 2, ctx);
      break;
  }
}
