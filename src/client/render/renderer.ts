// Contracts between the game screen and the visual templates. Board and dice are independent:
// any board template can be combined with any dice template, and both can be swapped mid-game.
import type { GameEvent, GameState } from '../../core/types.ts';

export type TemplateKind = '2d' | '3d';

export interface BoardRenderer {
  fullTable?: boolean; // true = board fills the whole table, panels and dice float above it
  onHop?: () => void; // called on every square a horse steps on (sound hook)
  build(s: GameState): void; // draw a fresh board for this game
  sync(s: GameState): void; // snap every horse to the true state
  setPickable(ids: number[], onPick?: (id: number) => void, preview?: (id: number) => number | null): void;
  animate(e: GameEvent): Promise<void>; // move / kick / tile / shield
  cheer(horse: number, icon: string, color: string): Promise<void>;
  setTurn(seat: number): void; // -1 = nobody
  destroy(): void; // must free everything (WebGL contexts are limited per page)
}

export interface DiceRenderer {
  onRoll?: () => void; // set by the screen: the player clicked the die
  roll(value: number, color: string): Promise<void>; // the value is decided by the rules, this only shows it
  setReady(on: boolean, color: string): void; // waiting for a click
  destroy(): void;
}

export type MakeBoard = (host: HTMLElement) => BoardRenderer;
export type MakeDice = (host: HTMLElement) => DiceRenderer;

/** 3D templates are fetched on first use (three.js chunk + model). Any failure falls back to 2D. */
async function pick<T>(kind: TemplateKind, load2d: () => Promise<T>, load3d: () => Promise<T>, what: string): Promise<T> {
  const make2d = await load2d();
  if (kind !== '3d') return make2d;
  try {
    const make3d = await load3d();
    return ((host: HTMLElement) => {
      try {
        return (make3d as (h: HTMLElement) => unknown)(host);
      } catch (e) {
        console.warn(`3D ${what} unavailable (WebGL?), using 2D`, e);
        return (make2d as (h: HTMLElement) => unknown)(host);
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
      const { BoardView } = await import('./board-view.ts');
      return host => new BoardView(host);
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
      return host => new DiceView(host);
    },
    async () => {
      const { DiceView3D } = await import('../render3d/dice3d.ts');
      return host => new DiceView3D(host);
    },
    'dice',
  );
