// Maps logical positions to board pixels. The board is a 15×15 grid (cross-shaped track, 4 corner stables).
import { GATE, STABLE, absOf } from '../../core/board.ts';

export const CELL = 40;
export const SIZE = 15 * CELL;

type Cell = [number, number]; // [col, row]

/** The 52 ring squares, clockwise, index = absolute track square. */
export const TRACK_CELLS: Cell[] = (() => {
  const t: Cell[] = [];
  const run = (n: number, f: (i: number) => Cell) => { for (let i = 0; i < n; i++) t.push(f(i)); };
  run(6, i => [i, 6]); run(6, i => [6, 5 - i]); t.push([7, 0]);
  run(6, i => [8, i]); run(6, i => [9 + i, 6]); t.push([14, 7]);
  run(6, i => [14 - i, 8]); run(6, i => [8, 9 + i]); t.push([7, 14]);
  run(6, i => [6, 14 - i]); run(6, i => [5 - i, 8]); t.push([0, 7]);
  return t;
})();

/** Home column cells per seat, step 1..6 → index 0..5 */
export const HOME_CELLS: Cell[][] = [
  [1, 2, 3, 4, 5, 6].map(i => [i, 7] as Cell),
  [1, 2, 3, 4, 5, 6].map(i => [7, i] as Cell),
  [1, 2, 3, 4, 5, 6].map(i => [14 - i, 7] as Cell),
  [1, 2, 3, 4, 5, 6].map(i => [7, 14 - i] as Cell),
];

export const CORNERS: Cell[] = [[0, 0], [9, 0], [9, 9], [0, 9]];
const SLOTS: Cell[] = [[2, 2], [4, 2], [2, 4], [4, 4]];

export const center = ([c, r]: Cell): [number, number] => [(c + 0.5) * CELL, (r + 0.5) * CELL];

export function horseXY(seat: number, pos: number, slot: number): [number, number] {
  if (pos === STABLE) {
    const [c, r] = CORNERS[seat];
    return [(c + SLOTS[slot][0]) * CELL, (r + SLOTS[slot][1]) * CELL];
  }
  if (pos > GATE) return center(HOME_CELLS[seat][pos - GATE - 1]);
  return center(TRACK_CELLS[absOf(seat, pos)]);
}
