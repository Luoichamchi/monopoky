// Duel mode bots. Same view as a human in that seat (core/view.ts): unknown cards and traps are '?'.
//  easy   – random, never plays cards
//  normal – plays a card when one simulated step says it pays, moves with the classic heuristic
//  hard / expert – also simulate the move that follows each play and compare whole plans (play + move vs move): 62% vs normal
// Draft values come from self-play (test/duel-lab.ts): win rate of decks holding the card, random drafts.
import { cloneState } from '../core/board.ts';
import { legalActions, step } from '../core/engine.ts';
import type { Action, BotLevel, GameState, Rng } from '../core/types.ts';
import { DUEL_CARDS as C } from '../core/variants/duel/cards.ts';
import { moveScore } from './bots.ts';
import { DW, evaluate } from './evaluate.ts';

/** Draft preference per card (≈ win-rate points above average when held). */
export const DRAFT_VALUE: Record<string, number> = {
  dichchuyen: 11.2, gioxo: 6.8, hoandoi: 5.9, xuatchuong: 4.2, morong: 4.2, luine: 3.4, hothuan: 2.1,
  bangphong: 1.6, tichluc: 1.5, phandon: 1, bhoden: 0.8, xichchan: 0.1, dotkich: 0.1, daykeo: 0, locxoay: -0.1,
  bhoandoi: -0.2, xungphong: -0.6, hapthu: -0.6, blienket: -0.7, phongan: -0.8, miennhiem: -0.8,
  bdaochieu: -1.1, dobay: -1.2, giaitru: -1.3, bbanggioi: -1.7, songma: -1.8, hoagiai: -2.1, doatvi: -2.2,
  phakhien: -2.3, ne: -2.5, giap: -2.6, bdoathon: -2.7, dolai: -3, batlui: -3.7, cuopbai: -4.1,
  chiemdoat: -4.7,
};

function best<T>(xs: T[], f: (x: T) => number): T {
  let b = xs[0], bv = -Infinity;
  for (const x of xs) {
    const v = f(x);
    if (v > bv) (bv = v), (b = x);
  }
  return b;
}

function draftPick(s: GameState, acts: Action[], rng: Rng): Action {
  const mine = s.duel!.lists[s.turn];
  const faces = (f: number) => mine.filter(c => C[c].point === f && C[c].kind !== 'trap').length;
  return best(acts, a => {
    const id = (a as { card: string }).card, c = C[id];
    let v = (DRAFT_VALUE[id] ?? 0) + rng() * 2;
    if (c.kind === 'trap') v -= 2 * mine.filter(x => C[x].kind === 'trap').length; // traps play on any face: a few is enough
    else v -= 2.5 * faces(c.point); // keep every face covered
    if (c.combo) v += Math.min(3, mine.filter(x => x === id).length * 1.5); // combo pieces like company
    return v;
  });
}

/** Play out `a` on a copy; for hard bots also the best follow-up move of the same roll. */
function simulate(s: GameState, a: Action, rng: Rng, followUp: boolean): number {
  const me = s.turn;
  const c = cloneState(s);
  let v: number;
  try {
    const ev = step(c, a, rng);
    v = evaluate(c, me);
    for (const e of ev) if (e.t === 'spring' && e.kind === '?' && s.horses[e.horse].owner === me) v -= 45; // an unknown trap hurts
  } catch {
    return -Infinity;
  }
  if (followUp && c.phase === 'move' && c.turn === me) {
    let top = -Infinity;
    for (const b of plainActs(c)) top = Math.max(top, simulate(c, b, rng, false));
    if (top > -Infinity) v = top;
  }
  return v;
}

/** Moves, endures, pass (after a play the turn's card is used, so listing is cheap). */
const plainActs = (s: GameState) => legalActions(s).filter(a => a.type !== 'play');

export function duelPick(s: GameState, acts: Action[], level: BotLevel, rng: Rng): Action {
  switch (s.phase) {
    case 'draft':
      return level === 'easy' ? acts[Math.floor(rng() * acts.length)] : draftPick(s, acts, rng);
    case 'react': // a reaction always beats letting the hit through; Chiếm Đoạt also wins the cards
      return acts.find(a => a.type === 'react' && a.card === 'chiemdoat') ?? acts.at(-1)!;
    case 'roll':
      if (acts[0].type !== 'discard') return acts[0];
      return best(acts, a => -(DRAFT_VALUE[(a as { card: string }).card] ?? 0) + rng()); // drop the least valued
  }
  const plays = acts.filter(a => a.type === 'play');
  const rest = acts.filter(a => a.type !== 'play');
  if (level === 'easy') return rest[Math.floor(rng() * rest.length)];

  if (level === 'normal') {
    if (plays.length) {
      const base = evaluate(s, s.turn);
      const pool = plays.length > 120 ? plays.filter(() => rng() < 120 / plays.length) : plays;
      let top: Action | undefined, tv = DW.minGain; // worth more than the card it costs
      for (const a of pool) {
        const v = simulate(s, a, rng, false) - base;
        if (v > tv) (tv = v), (top = a);
      }
      if (top) return top;
    }
    const moves = rest.filter(a => a.type === 'move');
    if (moves.length) return best(moves, a => moveScore(s, a, rng));
    return rest.find(a => a.type === 'endure') ?? rest[0];
  }

  // hard / expert: compare whole plans of this roll
  const scored: [Action, number][] = [
    ...rest.map(a => [a, simulate(s, a, rng, false) + (a.type === 'move' ? moveScore(s, a, rng) * 0.05 : 0)] as [Action, number]),
    ...plays.map(a => [a, simulate(s, a, rng, true) - DW.margin] as [Action, number]),
  ].sort((x, y) => y[1] - x[1]);
  return scored[0][0]; // expert = hard here: Monte-Carlo rollouts tested weaker (41–45% vs hard), opponents' cards are hidden
}
