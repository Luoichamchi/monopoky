// Pure data types shared by core, AI, server and client. Everything here must stay JSON-serializable.

export type BotLevel = 'easy' | 'normal' | 'hard' | 'expert';
export type Phase = 'draft' | 'roll' | 'move' | 'react' | 'over'; // draft/react: duel mode only
export type Rng = () => number;

export interface PlayerConfig {
  name: string;
  seat: number; // 0..3, board corner (clockwise from top-left)
  bot?: BotLevel;
  avatar?: string; // look only (protocol.ts AVATARS): the rules never read it
}

export interface Player extends PlayerConfig {
  cards: string[]; // variant item cards in hand
}

export interface Horse {
  id: number;
  owner: number; // player index
  pos: number; // -1 stable, 0..50 track (relative to owner), 51..56 home steps 1..6
  shield: number; // owner-turns of protection left (variants)
  frozen: number; // owner turn-starts until it may move again; > 0 = cannot move (variants)
  fx?: HorseFx; // duel mode statuses; dropped when kicked or entering the home column
}

/** Duel statuses on one horse. Controls (ice, rev, chain) are layers paid off with horse turns; the rest count player turns. */
export interface HorseFx {
  ice?: number; // stands still
  rev?: number; // moves backwards
  chain?: number; // moves only on a 1 or 2
  guard?: number; // blocks: cannot be kicked; each enemy card hitting it eats one
  guardT?: number;
  armor?: number; // stops the first trap
  armorT?: number;
  immune?: number; // no enemy cards, no new controls, no traps
}

/** One card of a play and what it aims at (horse ids, player index, track square, distance… depending on the card). */
export interface Pick {
  card: string;
  t: number[];
}

export interface Trap {
  abs: number; // track square
  owner: number;
  kind: string; // '?' in views of players who may not see it
  left: number; // owner turn-starts until it fades
}

/** Duel mode (rulebook docs/rulebook.md). Hidden parts are replaced by '?' in each player's view (core/view.ts). */
export interface DuelState {
  pool: Record<string, number>; // draft: copies left
  order: number[]; // draft: who picks next (snake)
  lists: string[][]; // drafted cards per player (public)
  decks: string[][]; // draw piles, top = last
  discards: string[][];
  plays: number; // active plays left this player turn
  extra: number; // extra rolls owed this player turn (legend)
  noMove: number; // horse that already used this roll (Song Mã), -1 = none
  traps: Trap[];
  streak: number[][]; // per player [face, count] of identical rolls in a row
  prevStreak: number[]; // before the last roll (Đổ Lại undoes it)
  legend: string[]; // legend card held per player, '' = none
  legendsTaken: string[];
  sealed: number[]; // per player: own turn-starts left without card play
  aegis: number[]; // per player: legend shield, own turn-starts left
  links: { leader: number; follower: number; left: number }[];
  pending?: { by: number; picks: Pick[]; face: number; queue: number[] }; // waiting for reactions
  known: number[][]; // per player: trap squares whose kind they saw
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
  duel?: DuelState;
}

/**
 * How the die was thrown. Never changes the value (the engine rolls that); it only lets every screen
 * replay the same throw. angle = radians off "straight at the board", power 0..1, seed = tumble variation.
 */
export interface Toss {
  power: number;
  angle: number;
  seed: number;
}

export type Action =
  | { type: 'roll'; toss?: Toss }
  | { type: 'move'; horse: number }
  | { type: 'pass' }
  | { type: 'card'; card: string; target: number } // target = horse id, -1 if none
  // duel mode
  | { type: 'pick'; card: string } // draft; '' = let the rules pick
  | { type: 'play'; picks: Pick[] } // one card, a combo, a trap or a legend
  | { type: 'react'; card: string } // '' = let it through
  | { type: 'endure'; horse: number } // give this roll to a controlled horse
  | { type: 'discard'; card: string };

export type GameEvent =
  | { t: 'roll'; player: number; value: number; toss: Toss }
  | { t: 'move'; horse: number; path: number[]; jump?: boolean } // successive pos values
  | { t: 'kick'; horse: number; by: number } // horse sent back to stable
  | { t: 'tile'; horse: number; tile: string }
  | { t: 'shield'; horse: number; on: boolean }
  | { t: 'gain'; player: number; card: string }
  | { t: 'card'; player: number; card: string; target: number }
  | { t: 'freeze'; horse: number; on: boolean }
  | { t: 'pass'; player: number }
  | { t: 'turn'; player: number }
  | { t: 'win'; player: number }
  // duel mode
  | { t: 'pick'; player: number; card: string }
  | { t: 'begin' } // draft over, first roll
  | { t: 'draw'; player: number; card: string } // '?' for other players
  | { t: 'discard'; player: number; card: string }
  | { t: 'play'; player: number; picks: Pick[]; face: number }
  | { t: 'react'; player: number; card: string }
  | { t: 'status'; horse: number; kind: keyof HorseFx; n: number }
  | { t: 'trap'; abs: number; owner: number; kind: string; on: boolean }
  | { t: 'spring'; abs: number; owner: number; kind: string; horse: number }
  | { t: 'reveal'; player: number; abs: number; kind: string }
  | { t: 'steal'; from: number; to: number; card: string }
  | { t: 'legend'; player: number; card: string }
  | { t: 'seal'; player: number; on: boolean }
  | { t: 'link'; leader: number; follower: number; on: boolean };

export interface Ctx {
  rng: Rng;
  ev: GameEvent[];
  roll: (value: number) => void; // lets variants trigger a (re)roll without importing the engine
  move: (h: Horse, d: number) => void; // a dice move of `h` by `d` (kick, landing, win), without ending the turn
  endTurn: (bonus: boolean) => void;
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
  // duel-style hooks
  actions?(s: GameState, core: Action[]): Action[]; // final legal list, given the classic one
  legal?(s: GameState, a: Action): boolean | undefined; // decides actions too many to list (undefined = look in the list)
  apply?(s: GameState, a: Action, ctx: Ctx): void; // actions the engine doesn't know
  canMove?(s: GameState, h: Horse): boolean; // may `h` take a normal dice move (default: not frozen)
  onRoll?(s: GameState, value: number, ctx: Ctx): void;
  onMoved?(s: GameState, h: Horse, steps: number, ctx: Ctx): void; // after a dice move
  extraRoll?(s: GameState): boolean; // at the end of a turn: owe this player another roll
}
