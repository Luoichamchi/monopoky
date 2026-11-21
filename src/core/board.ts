// Board topology + small state queries. No rendering coordinates here (see client/render/layout.ts).
import type { Ctx, DuelState, GameState, Horse } from './types.ts';

export const TRACK = 52; // shared ring squares
export const GATE = 50; // last track square before the home column (relative)
export const HOME = 6; // home column steps 1..6
export const HORSES = 4;
export const STABLE = -1;
export const WIN_STEP = 3; // all 4 horses on steps 3..6 = win (Vietnamese rule)

export const startOf = (seat: number) => 1 + 13 * seat;
export const absOf = (seat: number, pos: number) => (pos >= 0 && pos <= GATE ? (startOf(seat) + pos) % TRACK : -1);
export const relOf = (seat: number, abs: number) => (abs - startOf(seat) + TRACK) % TRACK;
export const seatOf = (s: GameState, player: number) => s.players[player].seat;
export const onTrack = (h: Horse) => h.pos >= 0 && h.pos <= GATE;
export const homeStep = (h: Horse) => (h.pos > GATE ? h.pos - GATE : 0);

/** Horse standing on absolute track square `abs`, if any. */
export function horseAt(s: GameState, abs: number): Horse | undefined {
  return s.horses.find(h => onTrack(h) && absOf(seatOf(s, h.owner), h.pos) === abs);
}

export const absOfHorse = (s: GameState, h: Horse) => absOf(seatOf(s, h.owner), h.pos);

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map(p => ({ ...p, cards: [...p.cards] })),
    horses: s.horses.map(h => (h.fx ? { ...h, fx: { ...h.fx } } : { ...h })),
    tiles: s.tiles, // tiles never change after setup
    duel: s.duel && cloneDuel(s.duel),
  };
}

function cloneDuel(d: DuelState): DuelState {
  const rows = (xs: string[][]) => xs.map(x => [...x]);
  return {
    ...d,
    pool: { ...d.pool },
    order: [...d.order],
    lists: rows(d.lists),
    decks: rows(d.decks),
    discards: rows(d.discards),
    traps: d.traps.map(x => ({ ...x })),
    streak: d.streak.map(x => [...x]),
    prevStreak: [...d.prevStreak],
    legend: [...d.legend],
    legendsTaken: [...d.legendsTaken],
    sealed: [...d.sealed],
    aegis: [...d.aegis],
    links: d.links.map(x => ({ ...x })),
    pending: d.pending && { ...d.pending, picks: d.pending.picks.map(p => ({ card: p.card, t: [...p.t] })), queue: [...d.pending.queue] },
    known: d.known.map(x => [...x]),
  };
}

/** Send a horse back to its stable. */
export function kick(victim: Horse, by: Horse, ctx: Ctx) {
  victim.pos = STABLE;
  victim.shield = 0;
  victim.fx = undefined;
  ctx.ev.push({ t: 'kick', horse: victim.id, by: by.id });
  if (victim.frozen) ctx.ev.push({ t: 'freeze', horse: victim.id, on: false });
  victim.frozen = 0;
}

/** Slide a track horse up to `n` squares (dir ±1) without passing anyone or leaving 0..GATE. Returns path. */
export function slide(s: GameState, h: Horse, dir: 1 | -1, n: number): number[] {
  const seat = seatOf(s, h.owner);
  const path: number[] = [];
  let p = h.pos;
  while (path.length < n && p + dir >= 0 && p + dir <= GATE && !horseAt(s, absOf(seat, p + dir))) path.push((p += dir));
  h.pos = p;
  return path;
}
