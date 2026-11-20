// Rules engine. Pure & deterministic given an rng. Mutates the state passed in (callers clone when they need to).
import { GATE, HOME, HORSES, STABLE, WIN_STEP, absOf, horseAt, kick, onTrack, seatOf } from './board.ts';
import type { Action, Ctx, GameEvent, GameState, Horse, PlayerConfig, Rng, Toss, Variant } from './types.ts';
import { getVariant } from './variants/index.ts';

export function createGame(variantId: string, players: PlayerConfig[], rng: Rng): GameState {
  if (players.length < 2 || players.length > 4) throw new Error('need 2-4 players');
  const s: GameState = {
    variant: getVariant(variantId).id,
    players: players.map(p => ({ name: p.name, seat: p.seat, bot: p.bot, avatar: p.avatar, cards: [] })),
    horses: players.flatMap((_, owner) =>
      Array.from({ length: HORSES }, (_, i) => ({ id: owner * HORSES + i, owner, pos: STABLE, shield: 0, frozen: 0 })),
    ),
    turn: 0,
    phase: 'roll',
    dice: 0,
    tiles: {},
    winner: -1,
    round: 1,
  };
  getVariant(s.variant).setup?.(s, rng);
  return s;
}

const homeTaken = (s: GameState, owner: number, pos: number) => s.horses.some(h => h.owner === owner && h.pos === pos);

/** Can `h` stop on its own relative square `pos` (empty, or kickable opponent)? */
function landable(s: GameState, v: Variant, h: Horse, pos: number): boolean {
  const occ = horseAt(s, absOf(seatOf(s, h.owner), pos));
  if (!occ) return true;
  if (occ.owner === h.owner) return false;
  return v.canKick?.(s, occ) ?? true;
}

/** Destination of `h` with die `d`, or null if illegal. Horses can never jump over other horses. */
export function target(s: GameState, h: Horse, d: number): number | null {
  const v = getVariant(s.variant);
  if (h.pos === STABLE) return v.exitOn.includes(d) && landable(s, v, h, 0) ? 0 : null;
  if (h.pos === GATE) {
    // enter home column: rolling d goes to step d, every step on the way must be free
    for (let k = 1; k <= d; k++) if (homeTaken(s, h.owner, GATE + k)) return null;
    return GATE + d;
  }
  if (h.pos > GATE) {
    // climb inside home one step at a time: from step k you need exactly k+1
    const k = h.pos - GATE;
    return k < HOME && d === k + 1 && !homeTaken(s, h.owner, h.pos + 1) ? h.pos + 1 : null;
  }
  const to = h.pos + d;
  if (to > GATE) return null; // must stop exactly on the gate
  const seat = seatOf(s, h.owner);
  for (let p = h.pos + 1; p < to; p++) if (horseAt(s, absOf(seat, p))) return null;
  return landable(s, v, h, to) ? to : null;
}

export function legalActions(s: GameState): Action[] {
  if (s.phase === 'over') return [];
  const cards = getVariant(s.variant).cardActions?.(s) ?? [];
  if (s.phase === 'roll') return [{ type: 'roll' }, ...cards];
  const moves: Action[] = s.horses
    .filter(h => h.owner === s.turn && h.frozen === 0 && target(s, h, s.dice) !== null)
    .map(h => ({ type: 'move', horse: h.id }));
  return [...(moves.length ? moves : [{ type: 'pass' } as Action]), ...cards];
}

export const sameAction = (a: Action, b: Action) =>
  a.type === b.type &&
  (a.type !== 'move' || a.horse === (b as typeof a).horse) &&
  (a.type !== 'card' || (a.card === (b as typeof a).card && a.target === (b as typeof a).target));

export const isLegal = (s: GameState, a: Action) => legalActions(s).some(x => sameAction(x, a));

const rollDie = (rng: Rng) => 1 + Math.floor(rng() * 6);

/** Apply an action. Throws on illegal actions. Returns the events to animate. */
export function step(s: GameState, a: Action, rng: Rng): GameEvent[] {
  if (!isLegal(s, a)) throw new Error(`illegal action ${JSON.stringify(a)}`);
  const v = getVariant(s.variant);
  const ctx: Ctx = { rng, ev: [], roll: value => applyRoll(s, value, ctx) };
  switch (a.type) {
    case 'roll':
      applyRoll(s, rollDie(rng), ctx, a.toss);
      break;
    case 'move':
      doMove(s, v, s.horses[a.horse], ctx);
      break;
    case 'pass':
      ctx.ev.push({ t: 'pass', player: s.turn });
      endTurn(s, v, ctx, s.dice === 6);
      break;
    case 'card':
      v.applyCard?.(s, a, ctx);
      break;
  }
  return ctx.ev;
}

/** Set the die. If the only option left is passing, pass automatically. Bots and rerolls get a random throw. */
export function applyRoll(s: GameState, value: number, ctx: Ctx, toss?: Toss) {
  s.dice = value;
  s.phase = 'move';
  toss ??= { power: 0.35 + ctx.rng() * 0.4, angle: (ctx.rng() - 0.5) * 1.2, seed: Math.floor(ctx.rng() * 2 ** 31) };
  ctx.ev.push({ t: 'roll', player: s.turn, value, toss });
  const acts = legalActions(s);
  if (acts.length === 1 && acts[0].type === 'pass') {
    ctx.ev.push({ t: 'pass', player: s.turn });
    endTurn(s, getVariant(s.variant), ctx, value === 6);
  }
}

function doMove(s: GameState, v: Variant, h: Horse, ctx: Ctx) {
  const to = target(s, h, s.dice)!;
  const from = h.pos;
  const path = from === STABLE ? [0] : Array.from({ length: to - from }, (_, i) => from + 1 + i);
  ctx.ev.push({ t: 'move', horse: h.id, path });
  if (to <= GATE) {
    const occ = horseAt(s, absOf(seatOf(s, h.owner), to));
    if (occ && occ.owner !== h.owner) kick(occ, h, ctx);
  }
  h.pos = to;
  if (onTrack(h)) v.onLand?.(s, h, ctx);

  if (s.horses.every(x => x.owner !== h.owner || x.pos >= GATE + WIN_STEP)) {
    s.winner = h.owner;
    s.phase = 'over';
    ctx.ev.push({ t: 'win', player: h.owner });
    return;
  }
  endTurn(s, v, ctx, s.dice === 6);
}

function endTurn(s: GameState, v: Variant, ctx: Ctx, bonus: boolean) {
  if (s.phase === 'over') return;
  s.dice = 0;
  s.phase = 'roll';
  if (bonus) return ctx.ev.push({ t: 'turn', player: s.turn }), undefined;
  // a variant may skip whole turns; it must not skip every player forever
  for (;;) {
    s.turn = (s.turn + 1) % s.players.length;
    if (s.turn === 0) s.round++;
    if (!v.onTurnStart?.(s, ctx)) break;
  }
  ctx.ev.push({ t: 'turn', player: s.turn });
}
