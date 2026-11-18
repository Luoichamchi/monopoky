// Bot levels:
//  easy   – random legal move
//  normal – hand-written priorities (furthest destination, exit, kick, tiles), ignores danger, never plays pre-roll cards
//  hard   – expectimax: own dice + cards, then the next opponent's dice and best reply, full evaluation
//  expert – Monte-Carlo search: UCB1 over root actions, short rollouts with `normal` play, leaf = full evaluation
// Strength is checked by self-play: `npm run bench`.
import { GATE, STABLE, absOf, cloneState, horseAt, seatOf } from '../core/board.ts';
import { legalActions, step, target } from '../core/engine.ts';
import type { Action, BotLevel, GameState, Rng } from '../core/types.ts';
import { evaluate } from './evaluate.ts';

const TILE_BIAS: Record<string, number> = { boost: 8, portal: 10, gift: 9, shield: 7, bomb: 6, trap: -9, ice: -12 };

export interface BotOptions {
  rng?: Rng;
  budgetMs?: number; // expert thinking time
}

export function chooseAction(s: GameState, level: BotLevel, opts: BotOptions = {}): Action {
  const rng = opts.rng ?? Math.random;
  const acts = legalActions(s);
  if (acts.length <= 1) return acts[0];
  switch (level) {
    case 'easy': {
      const plain = acts.filter(a => a.type !== 'card');
      return plain[Math.floor(rng() * plain.length)];
    }
    case 'normal':
      return quickPick(s, acts, rng);
    case 'hard':
      return argmax(acts, a => actionValue(s, a, s.turn, 3));
    case 'expert':
      return monteCarlo(s, acts, opts.budgetMs ?? 500, rng);
  }
}

function argmax<T>(xs: T[], f: (x: T) => number): T {
  let best = xs[0], bv = -Infinity;
  for (const x of xs) {
    const v = f(x);
    if (v > bv) (bv = v), (best = x);
  }
  return best;
}

/** Cheap rule-based policy (also the rollout policy). Self-play showed "push the furthest horse" dominates. */
export function quickPick(s: GameState, acts: Action[], rng: Rng): Action {
  if (s.phase === 'roll') return acts[0]; // roll
  const moves = acts.filter(a => a.type === 'move');
  if (!moves.length) return acts.find(a => a.type === 'card') ?? acts[0]; // reroll instead of passing
  const seat = seatOf(s, s.turn);
  return argmax(moves, a => {
    const h = s.horses[(a as { horse: number }).horse];
    const to = target(s, h, s.dice)!;
    let sc = rng() * 2 + to * 0.2;
    if (h.pos === STABLE) sc += 30;
    if (to > GATE) sc += 25;
    if (to <= GATE) {
      const occ = horseAt(s, absOf(seat, to));
      if (occ && occ.owner !== s.turn) sc += 40 + occ.pos * 0.5;
      sc += TILE_BIAS[s.tiles[absOf(seat, to)]] ?? 0;
    }
    return sc;
  });
}

const fixedDie = (d: number): Rng => () => (d - 0.5) / 6;
const isChance = (a: Action) => a.type === 'roll' || (a.type === 'card' && a.card === 'reroll');

/** Expected value for `me`, with `depth` own decisions left; when the turn passes, model the next opponent's reply. */
function best(s: GameState, me: number, depth: number): number {
  if (s.phase === 'over') return evaluate(s, me);
  if (s.turn !== me) return opponentReply(s, me);
  if (depth === 0) return evaluate(s, me);
  let b = -Infinity;
  for (const a of legalActions(s)) b = Math.max(b, actionValue(s, a, me, depth));
  return b;
}

function actionValue(s: GameState, a: Action, me: number, depth: number): number {
  const dice = isChance(a) ? [1, 2, 3, 4, 5, 6] : [3.5];
  let sum = 0;
  for (const d of dice) {
    const c = cloneState(s);
    step(c, a, fixedDie(d));
    sum += best(c, me, depth - 1);
  }
  return sum / dice.length;
}

/** Average over the opponent's 6 rolls of the position after their greedy best move. */
function opponentReply(s: GameState, me: number): number {
  let sum = 0;
  for (let d = 1; d <= 6; d++) {
    const c = cloneState(s);
    step(c, { type: 'roll' }, fixedDie(d));
    let after = c;
    if (c.phase === 'move' && c.turn !== me) {
      let bv = -Infinity;
      for (const a of legalActions(c)) {
        if (a.type !== 'move') continue;
        const n = cloneState(c);
        step(n, a, fixedDie(3.5));
        const v = evaluate(n, c.turn);
        if (v > bv) (bv = v), (after = n);
      }
    }
    sum += evaluate(after, me);
  }
  return sum / 6;
}

function monteCarlo(s: GameState, acts: Action[], budgetMs: number, rng: Rng): Action {
  const me = s.turn;
  const depth = 7 * s.players.length; // ≈ 3 rounds of play
  const n = acts.map(() => 0);
  const sum = acts.map(() => 0);
  const idx = acts.map((_, k) => k);
  const t0 = performance.now();
  const C = 40; // exploration constant, in evaluation points
  for (let it = 0; it < 20000; it++) {
    const warm = it < acts.length * 8;
    if (!warm && performance.now() - t0 > budgetMs) break;
    const logN = Math.log(it);
    const i = warm ? it % acts.length : argmax(idx, k => sum[k] / n[k] + C * Math.sqrt(logN / n[k]));
    const c = cloneState(s);
    step(c, acts[i], rng);
    for (let k = 0; k < depth && c.phase !== 'over'; k++) step(c, quickPick(c, legalActions(c), rng), rng);
    n[i]++;
    sum[i] += Math.max(-300, Math.min(300, evaluate(c, me))); // clamp wins so one lucky rollout can't dominate
  }
  return acts[argmax(idx, k => sum[k] / n[k])];
}
