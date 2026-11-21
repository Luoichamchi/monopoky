// Duel mode bot: draft for a spread of faces, react when it can, play a card when one simulated step says it pays.
// Bots get the same view as a human in their seat (core/view.ts): unknown cards and traps are '?'.
import { cloneState } from '../core/board.ts';
import { step } from '../core/engine.ts';
import type { Action, BotLevel, GameState, Rng } from '../core/types.ts';
import { DUEL_CARDS as C } from '../core/variants/duel/cards.ts';
import { moveScore } from './bots.ts';
import { evaluate } from './evaluate.ts';

const LIKE: Record<string, number> = { tichluc: 3, bangphong: 2, hothuan: 2, morong: 1, xuatchuong: 3, dichchuyen: 2, xungphong: 2, bhoden: 3, bdoathon: 2 };

function draftPick(s: GameState, acts: Action[], rng: Rng): Action {
  const mine = s.duel!.lists[s.turn];
  const faces = (f: number) => mine.filter(c => C[c].point === f).length;
  return best(acts, a => {
    const c = C[(a as { card: string }).card];
    let v = 5 + (LIKE[(a as { card: string }).card] ?? 0) + rng() * 3;
    if (c.kind === 'trap') v += 1 - 2 * mine.filter(x => C[x].kind === 'trap').length; // a couple of traps, not more
    else v -= 2.5 * faces(c.point); // keep every face covered
    if (c.kind === 'react') v -= 1;
    return v;
  });
}

function best<T>(xs: T[], f: (x: T) => number): T {
  let b = xs[0], bv = -Infinity;
  for (const x of xs) {
    const v = f(x);
    if (v > bv) (bv = v), (b = x);
  }
  return b;
}

/** Value change of a play for the player on turn, one simulated step (an average of a few dice outcomes). */
function gain(s: GameState, a: Action, rng: Rng, base: number): number {
  const me = s.turn;
  const c = cloneState(s);
  try {
    const ev = step(c, a, rng);
    let v = evaluate(c, me) - base;
    for (const e of ev) if (e.t === 'spring' && s.horses[e.horse].owner === me) v -= 40;
    return v;
  } catch {
    return -Infinity;
  }
}

export function duelPick(s: GameState, acts: Action[], level: BotLevel, rng: Rng): Action {
  switch (s.phase) {
    case 'draft':
      return level === 'easy' ? acts[Math.floor(rng() * acts.length)] : draftPick(s, acts, rng);
    case 'react':
      return acts.find(a => a.type === 'react' && a.card === 'chiemdoat') ?? acts.at(-1)!; // '' comes first
    case 'roll':
      if (acts[0].type !== 'discard') return acts[0];
      return best(acts, a => -(LIKE[(a as { card: string }).card] ?? 0) + rng()); // drop the least liked
  }
  const plays = acts.filter(a => a.type === 'play');
  const rest = acts.filter(a => a.type !== 'play');
  if (level === 'easy') return rest[Math.floor(rng() * rest.length)];
  if (plays.length) {
    const base = evaluate(s, s.turn);
    const pool = level === 'normal' && plays.length > 120 ? plays.filter(() => rng() < 120 / plays.length) : plays;
    let top: Action | undefined, tv = level === 'normal' ? 12 : 6; // a play must be worth it
    for (const a of pool) {
      const v = gain(s, a, rng, base);
      if (v > tv) (tv = v), (top = a);
    }
    if (top) return top;
  }
  const moves = rest.filter(a => a.type === 'move');
  if (moves.length) return best(moves, a => moveScore(s, a, rng));
  return rest.find(a => a.type === 'endure') ?? rest[0];
}
