// Static evaluation of a position from one player's point of view.
import { GATE, STABLE, TRACK, absOf, homeStep, onTrack, seatOf, startOf } from '../core/board.ts';
import { getVariant } from '../core/variants/index.ts';
import type { GameState, Horse } from '../core/types.ts';

export const W = {
  win: 1e5,
  onBoard: 60, // leaving the stable needs a rare die, so being out is worth a lot
  progress: 1, // per square travelled
  quad: 0.08, // extra per square²: advanced horses are worth more (no-jump + exact-gate rules) – tuned by self-play
  home: -50, // entering home on a low step blocks the column and needs many exact dice: better wait for a high roll
  homeStep: 30, // per home step: climbing needs an exact die, so every step is precious
  risk: 0.5, // fraction of a threatened horse's value we expect to lose
  card: 6,
  frozen: 9, // per frozen horse: it loses its next move
  leader: 0.65, // weight on the strongest opponent vs the average one
};

/** occupancy[abs] = horse standing there, for fast path checks */
function occupancy(s: GameState): (Horse | undefined)[] {
  const occ: (Horse | undefined)[] = new Array(TRACK);
  for (const h of s.horses) if (onTrack(h)) occ[absOf(seatOf(s, h.owner), h.pos)] = h;
  return occ;
}

/** Probability that `h` gets kicked before its owner moves again (one roll per opponent, bonus rolls ignored). */
export function threat(s: GameState, h: Horse, occ = occupancy(s)): number {
  if (!onTrack(h) || h.shield > 0) return 0;
  const v = getVariant(s.variant);
  if (v.canKick && !v.canKick(s, h)) return 0;
  const at = absOf(seatOf(s, h.owner), h.pos);
  let safe = 1;
  for (let o = 0; o < s.players.length; o++) {
    if (o === h.owner) continue;
    const seat = seatOf(s, o);
    const kills = new Set<number>();
    for (const e of s.horses) {
      if (e.owner !== o || e.frozen > 0) continue;
      if (e.pos === STABLE) {
        if (at === startOf(seat) % TRACK) v.exitOn.forEach(d => kills.add(d));
        continue;
      }
      if (!onTrack(e)) continue;
      const from = absOf(seat, e.pos);
      const dist = (at - from + TRACK) % TRACK;
      if (dist < 1 || dist > 6 || e.pos + dist > GATE) continue;
      let clear = true;
      for (let k = 1; k < dist && clear; k++) if (occ[(from + k) % TRACK]) clear = false;
      if (clear) kills.add(dist);
    }
    safe *= 1 - kills.size / 6;
  }
  return 1 - safe;
}

export function playerScore(s: GameState, p: number, withRisk = true): number {
  const occ = withRisk ? occupancy(s) : [];
  let score = s.players[p].cards.length * W.card;
  const d = s.duel;
  if (d) {
    if (d.legend[p]) score += 25;
    score += d.traps.filter(t => t.owner === p).length * 8;
  }
  for (const h of s.horses) {
    if (h.owner !== p || h.pos === STABLE) continue;
    if (h.frozen > 0) score -= W.frozen;
    if (h.fx) score -= ((h.fx.rev ?? 0) * 1.5 + (h.fx.chain ?? 0) + (h.fx.ice ?? 0)) * W.frozen - (h.fx.guard ?? 0) * 4;
    if (h.pos > GATE) {
      score += W.onBoard + GATE * W.progress + GATE * GATE * W.quad + W.home + homeStep(h) * W.homeStep;
      continue;
    }
    const val = W.onBoard + h.pos * W.progress + h.pos * h.pos * W.quad;
    score += withRisk ? val * (1 - W.risk * threat(s, h, occ)) : val;
  }
  return score;
}

export function evaluate(s: GameState, me: number): number {
  if (s.winner === me) return W.win;
  if (s.winner >= 0) return -W.win;
  let mine = 0, best = -Infinity, sum = 0;
  for (let p = 0; p < s.players.length; p++) {
    const sc = playerScore(s, p);
    if (p === me) mine = sc;
    else (best = Math.max(best, sc)), (sum += sc);
  }
  const avg = sum / (s.players.length - 1);
  return mine - W.leader * best - (1 - W.leader) * avg;
}
