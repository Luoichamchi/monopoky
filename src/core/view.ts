// What one player may see (rulebook law 8). Classic and party have nothing hidden: they pass through unchanged.
import { cloneState } from './board.ts';
import type { GameEvent, GameState } from './types.ts';

/** `p` = the viewer's player index, -1 for spectators. */
export function viewState(s: GameState, p: number): GameState {
  if (!s.duel) return s;
  const v = cloneState(s);
  const d = v.duel!;
  v.players.forEach((pl, i) => i !== p && (pl.cards = pl.cards.map(() => '?')));
  d.decks = d.decks.map(x => x.map(() => '?'));
  d.traps = d.traps.map(t => (t.owner === p || d.known[p]?.includes(t.abs) ? t : { ...t, kind: '?' }));
  d.known = d.known.map((k, i) => (i === p ? k : []));
  return v;
}

export function viewEvents(events: GameEvent[], p: number): GameEvent[] {
  return events.flatMap((e): GameEvent[] => {
    switch (e.t) {
      case 'draw':
        return [e.player === p ? e : { ...e, card: '?' }];
      case 'trap':
        return [e.owner === p ? e : { ...e, kind: '?' }];
      case 'reveal':
        return e.player === p ? [e] : [];
      case 'steal':
        return [e.from === p || e.to === p ? e : { ...e, card: '?' }];
      default:
        return [e];
    }
  });
}

export const viewUpdate = <U extends { state: GameState; events: GameEvent[] }>(u: U, p: number): U =>
  u.state.duel ? { ...u, state: viewState(u.state, p), events: viewEvents(u.events, p) } : u;
