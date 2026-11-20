// Runs one game: validates actions, applies them, drives bots. Used by the server (online) and the browser (offline).
import { chooseAction } from './ai/bots.ts';
import { cloneState } from './core/board.ts';
import { createGame, isLegal, step } from './core/engine.ts';
import type { Action, BotLevel, GameEvent, GameState, PlayerConfig, Rng } from './core/types.ts';

export interface Update {
  state: GameState;
  events: GameEvent[];
}

// Pacing contract with the renderer, so bots wait for animations to finish.
// ponytail: estimated, not acknowledged by clients; add client "done" acks if animations get long/variable.
export const TIMING = { hop: 150, roll: 1400, kick: 650, tile: 550, banner: 900 };
export function animMs(events: GameEvent[]): number {
  let ms = 0;
  for (const e of events) {
    if (e.t === 'move') ms += e.jump ? 600 : e.path.length * TIMING.hop + 100;
    else if (e.t === 'roll') ms += TIMING.roll;
    else if (e.t === 'kick') ms += TIMING.kick;
    else if (e.t === 'tile' || e.t === 'card' || e.t === 'freeze') ms += TIMING.tile;
    else if (e.t === 'turn') ms += 150;
  }
  return ms;
}

/** Turn an untrusted object into a well-formed Action (or null). */
export function sanitizeAction(a: unknown): Action | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  if (o.type === 'pass') return { type: 'pass' };
  if (o.type === 'roll') {
    const t = o.toss as Record<string, unknown> | undefined;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
    const [power, angle, seed] = [num(t?.power), num(t?.angle), num(t?.seed)];
    if ([power, angle, seed].some(Number.isNaN)) return { type: 'roll' }; // the engine throws for them
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    return { type: 'roll', toss: { power: clamp(power, 0, 1), angle: clamp(angle, -Math.PI, Math.PI), seed: Math.floor(seed) >>> 0 } };
  }
  if (o.type === 'move' && Number.isInteger(o.horse)) return { type: 'move', horse: o.horse as number };
  if (o.type === 'card' && typeof o.card === 'string' && Number.isInteger(o.target))
    return { type: 'card', card: o.card, target: o.target as number };
  return null;
}

/** How a bot picks its move. Default: right here. The server passes one that runs slow levels on worker threads. */
export type Think = (s: GameState, level: BotLevel) => Action | Promise<Action>;

export class GameSession {
  state: GameState;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private onUpdate: (u: Update) => void;
  private rng: Rng;
  private think: Think;
  private epoch = 0; // bumps on every reschedule/stop, so a bot answer that arrives late is dropped

  constructor(variant: string, players: PlayerConfig[], onUpdate: (u: Update) => void, rng: Rng = Math.random, think?: Think) {
    this.onUpdate = onUpdate;
    this.rng = rng;
    this.think = think ?? ((s, level) => chooseAction(s, level, { rng: this.rng }));
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
    this.epoch++;
  }

  private scheduleBot(events: GameEvent[]) {
    clearTimeout(this.timer);
    const epoch = ++this.epoch;
    const s = this.state;
    const level = s.players[s.turn]?.bot;
    if (s.phase === 'over' || !level) return;
    const turn = s.turn;
    this.timer = setTimeout(async () => {
      let a: Action;
      try {
        a = await this.think(cloneState(s), level);
      } catch {
        a = chooseAction(cloneState(s), level, { rng: this.rng }); // worker failed: think here rather than stall the game
      }
      if (epoch === this.epoch) this.act(turn, a);
    }, animMs(events) + 400);
  }
}
