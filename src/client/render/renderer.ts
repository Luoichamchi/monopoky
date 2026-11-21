// Contracts between the game screen and the visual templates. Board and dice are independent:
// any board template can be combined with any dice template, and both can be swapped mid-game.
import type { GameEvent, GameState, Toss } from '../../core/types.ts';

export type TemplateKind = '2d' | '3d';

export interface BoardRenderer {
  fullTable?: boolean; // true = board fills the whole table, panels and dice float above it
  onHop?: () => void; // called on every square a horse steps on (sound hook)
  build(s: GameState): void; // draw a fresh board for this game
  sync(s: GameState): void; // snap every horse to the true state
  setPickable(ids: number[], onPick?: (id: number) => void, preview?: (id: number) => number | null): void;
  setSquares(abs: number[], onPick?: (abs: number) => void): void; // duel: make track squares clickable (traps, destinations)
  animate(e: GameEvent): Promise<void>; // move / kick / tile / shield / duel status, traps
  cheer(horse: number, icon: string, color: string): Promise<void>;
  setTurn(seat: number): void; // -1 = nobody
  follow?: boolean; // 3D only: the camera turns to the seat whose turn it is (absent = not supported)
  face?(seat: number): void; // 3D only: snap the camera to this seat's view (the local player's, at the start)
  destroy(): void; // must free everything (WebGL contexts are limited per page)
}

/** Dice skins draw the shared motion in dice/motion.ts and use dice/input.ts for hold-and-throw. */
export interface DiceRenderer {
  onRoll?: (toss: Toss) => void; // set by the screen: the player let go of the die
  onShake?: (on: boolean) => void; // set by the screen: the player is holding / shaking the die (sound)
  roll(value: number, color: string, toss: Toss): Promise<void>; // the value is decided by the rules, this only replays the throw
  setReady(on: boolean, color: string): void; // waiting for the player to grab the die
  destroy(): void;
}

export type MakeBoard = (host: HTMLElement) => BoardRenderer;
export type MakeDice = (host: HTMLElement, arena: () => DOMRect) => DiceRenderer; // arena = where the die may roll (the board)

/** 3D templates are fetched on first use (three.js chunk + model). Any failure falls back to 2D. */
async function pick<T>(kind: TemplateKind, load2d: () => Promise<T>, load3d: () => Promise<T>, what: string): Promise<T> {
  const make2d = await load2d();
  if (kind !== '3d') return make2d;
  try {
    const make3d = await load3d();
    return ((...args: unknown[]) => {
      try {
        return (make3d as (...a: unknown[]) => unknown)(...args);
      } catch (e) {
        console.warn(`3D ${what} unavailable (WebGL?), using 2D`, e);
        return (make2d as (...a: unknown[]) => unknown)(...args);
      }
    }) as T;
  } catch (e) {
    console.warn(`3D ${what} failed to load, using 2D`, e);
    return make2d;
  }
}

export const loadBoard = (kind: TemplateKind): Promise<MakeBoard> =>
  pick<MakeBoard>(
    kind,
    async () => {
      const [{ BoardView }, { atlasArt }] = await Promise.all([import('./board-view.ts'), import('./board-art.ts')]);
      return host => new BoardView(host, atlasArt);
    },
    async () => {
      const { Board3D, preload } = await import('../render3d/board3d.ts');
      await preload();
      return host => new Board3D(host);
    },
    'board',
  );

export const loadDice = (kind: TemplateKind): Promise<MakeDice> =>
  pick<MakeDice>(
    kind,
    async () => {
      const { DiceView } = await import('./dice.ts');
      return (host, arena) => new DiceView(host, arena);
    },
    async () => {
      const { DiceView3D } = await import('../render3d/dice3d.ts');
      return (host, arena) => new DiceView3D(host, arena);
    },
    'dice',
  );
