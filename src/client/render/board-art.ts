import type { BoardTheme } from './board-themes.ts';
import { ARENA_VIEWBOX, STABLE_HEIGHT, TRACK_HEIGHT, drawArena, groundMatrix, project } from './arena.ts';
import { drawAtlas, ENAMEL } from './atlas.ts';
import { center, TRACK_CELLS } from './layout.ts';
import { drawSpecialTile, drawSpiritBoard, SPIRIT_INK } from './spirit-board.ts';
import { seatColor } from './theme.ts';
import { svg } from './fx.ts';

type Point = [number, number];
interface Surfaces {
  cells: SVGGraphicsElement[];
  stables: SVGGElement[];
  lanes: SVGGElement[][];
}
export interface BoardArt {
  viewBox: string;
  draw(root: SVGSVGElement, seats: number[], tiles: Record<number, string>): Surfaces;
  anchor(x: number, y: number, stable: boolean): Point;
  hitTransform(x: number, y: number, stable: boolean): string;
  color(seat: number): string;
  tether?(projection: SVGGElement, seat: number): void;
  sprite: { href: string; x: number; y: number; width: number; height: number };
}

const flat = {
  viewBox: '-24 -24 648 648',
  anchor: (x: number, y: number): Point => [x, y],
  hitTransform: (x: number, y: number) => `translate(${x} ${y})`,
};
const height = (stable: boolean) => stable ? STABLE_HEIGHT : TRACK_HEIGHT;

export const boardArt: Record<Exclude<BoardTheme, 'original'>, BoardArt> = {
  cloud: {
    viewBox: ARENA_VIEWBOX,
    draw: drawArena,
    anchor: (x, y, stable) => project(x, y, height(stable)),
    hitTransform: (x, y, stable) => groundMatrix(x, y, height(stable)),
    color: seat => seatColor(seat).main,
    sprite: { href: '/art/kaze.png', x: -29, y: -55, width: 58, height: 54 },
  },
  atlas: {
    ...flat,
    draw(root, seats, tiles) {
      const { cells, lanes, stables } = drawAtlas(root, seats);
      for (const [abs, kind] of Object.entries(tiles)) drawSpecialTile(root, ...center(TRACK_CELLS[Number(abs)]), kind);
      return { cells, lanes: lanes.map(lane => [lane]), stables };
    },
    color: seat => ENAMEL[seat],
    sprite: { href: '/art/linh-ma.png', x: -27, y: -52, width: 54, height: 51 },
  },
  spirit: {
    ...flat,
    viewBox: '-24 -49 648 680',
    draw: drawSpiritBoard,
    color: seat => SPIRIT_INK[seat],
    tether(projection, seat) {
      svg('path', { d: 'M-10 -28 Q-8 -10 -4 0 Q0 3 4 0 Q8 -10 10 -28Z', fill: `url(#spirit-beam-${seat})` }, projection);
      svg('path', { d: 'M0 -9 2 -5 0 -1 -2 -5Z', fill: SPIRIT_INK[seat] }, projection);
    },
    sprite: { href: '/art/phantom-knight.svg', x: -24, y: -62, width: 48, height: 54 },
  },
};
