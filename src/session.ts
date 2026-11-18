// Runs one game: validates actions, applies them, drives bots. Used by the server (online) and the browser (offline).
import { chooseAction } from './ai/bots.ts';
import { cloneState } from './core/board.ts';
import { createGame, isLegal, step } from './core/engine.ts';
import type { Action, GameEvent, GameState, PlayerConfig, Rng } from './core/types.ts';

export interface Update {
  state: GameState;
  events: GameEvent[];
}

// Pacing contract with the renderer, so bots wait for animations to finish.
// ponytail: estimated, not acknowledged by clients; add client "done" acks if animations get long/variable.
export const TIMING = { hop: 150, roll: 700, kick: 650, tile: 550, banner: 900 };
export function animMs(events: GameEvent[]): number {
  let ms = 0;
  for (const e of events) {
    if (e.t === 'move') ms += e.jump ? 600 : e.path.length * TIMING.hop + 100;
    else if (e.t === 'roll') ms += TIMING.roll;
    else if (e.t === 'kick') ms += TIMING.kick;
    else if (e.t === 'tile' || e.t === 'card' || e.t === 'skip') ms += TIMING.tile;
    else if (e.t === 'turn') ms += 150;
  }
  return ms;
}

/** Turn an untrusted object into a well-formed Action (or null). */
export function sanitizeAction(a: unknown): Action | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  if (o.type === 'roll' || o.type === 'pass') return { type: o.type };
  if (o.type === 'move' && Number.isInteger(o.horse)) return { type: 'move', horse: o.horse as number };
  if (o.type === 'card' && typeof o.card === 'string' && Number.isInteger(o.target))
    return { type: 'card', card: o.card, target: o.target as number };
  return null;
}

export class GameSession {
  state: GameState;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private onUpdate: (u: Update) => void;
  private rng: Rng;

  constructor(variant: string, players: PlayerConfig[], onUpdate: (u: Update) => void, rng: Rng = Math.random) {
    this.onUpdate = onUpdate;
    this.rng = rng;
    this.state = createGame(variant, players, rng);
  }

  start() {
    const events: GameEvent[] = [{ t: 'turn', player: this.state.turn }];
    this.onUpdate({ state: this.state, events });
    this.scheduleBot(events);
  }

  /** Apply an action for `player`. Returns false if it isn't their turn or the move is illegal. */
  act(player: number, raw: unknown): boolean {
    const a = sanitizeAction(raw);
    const s = this.state;
    if (!a || s.phase === 'over' || s.turn !== player || !isLegal(s, a)) return false;
    const events = step(s, a, this.rng);
    this.onUpdate({ state: s, events });
    this.scheduleBot(events);
    return true;
  }

  /** Let a bot play for a seat (e.g. a disconnected human). */
  setBot(player: number, level: PlayerConfig['bot']) {
    this.state.players[player].bot = level;
    this.scheduleBot([]);
  }

  stop() {
    clearTimeout(this.timer);
  }

  private scheduleBot(events: GameEvent[]) {
    clearTimeout(this.timer);
    const s = this.state;
    const level = s.players[s.turn]?.bot;
    if (s.phase === 'over' || !level) return;
    const turn = s.turn;
    this.timer = setTimeout(() => {
      // ponytail: expert search blocks the event loop ~0.5s; move bots to a worker if one server hosts many rooms
      this.act(turn, chooseAction(cloneState(s), level, { rng: this.rng }));
    }, animMs(events) + 400);
  }
}
