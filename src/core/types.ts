// Pure data types shared by core, AI, server and client. Everything here must stay JSON-serializable.

export type BotLevel = 'easy' | 'normal' | 'hard' | 'expert';
export type Phase = 'roll' | 'move' | 'over';
export type Rng = () => number;

export interface PlayerConfig {
  name: string;
  seat: number; // 0..3, board corner (clockwise from top-left)
  bot?: BotLevel;
}

export interface Player extends PlayerConfig {
  cards: string[]; // variant item cards in hand
  frozen: number; // turns to skip
}

export interface Horse {
  id: number;
  owner: number; // player index
  pos: number; // -1 stable, 0..50 track (relative to owner), 51..56 home steps 1..6
  shield: number; // owner-turns of protection left (variants)
}

export interface GameState {
  variant: string;
  players: Player[];
  horses: Horse[];
  turn: number; // player index
  phase: Phase;
  dice: number; // 0 = not rolled yet
  tiles: Record<number, string>; // absolute track square -> tile kind (variants)
  winner: number; // -1 = none
  round: number;
}

export type Action =
  | { type: 'roll' }
  | { type: 'move'; horse: number }
  | { type: 'pass' }
  | { type: 'card'; card: string; target: number }; // target = horse id, -1 if none

export type GameEvent =
  | { t: 'roll'; player: number; value: number }
  | { t: 'move'; horse: number; path: number[]; jump?: boolean } // successive pos values
  | { t: 'kick'; horse: number; by: number } // horse sent back to stable
  | { t: 'tile'; horse: number; tile: string }
  | { t: 'shield'; horse: number; on: boolean }
  | { t: 'gain'; player: number; card: string }
  | { t: 'card'; player: number; card: string; target: number }
  | { t: 'skip'; player: number }
  | { t: 'pass'; player: number }
  | { t: 'turn'; player: number }
  | { t: 'win'; player: number };

export interface Ctx {
  rng: Rng;
  ev: GameEvent[];
  roll: (value: number) => void; // lets variants trigger a (re)roll without importing the engine
}

/** A game variant = classic rules + optional hooks. New modes live in core/variants/<name>/. */
export interface Variant {
  id: string;
  name: string;
  desc: string;
  exitOn: number[]; // dice values that let a horse leave the stable
  setup?(s: GameState, rng: Rng): void;
  onLand?(s: GameState, h: Horse, ctx: Ctx): void; // horse stopped on a track square
  canKick?(s: GameState, victim: Horse): boolean;
  onTurnStart?(s: GameState, ctx: Ctx): boolean; // return true = skip this player's turn
  cardActions?(s: GameState): Action[];
  applyCard?(s: GameState, a: Extract<Action, { type: 'card' }>, ctx: Ctx): void;
}
