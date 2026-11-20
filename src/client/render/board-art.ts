// 2D board look: BoardView draws horses and effects, a BoardArt draws the board under them.
// Only "Tinh bàn Thiên Mã" for now; another 2D board = another BoardArt.
import { drawAtlas, drawSpecialTile, ENAMEL } from './atlas.ts';
import { center, TRACK_CELLS } from './layout.ts';

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
  sprite: { href: string; x: number; y: number; width: number; height: number };
}

export const atlasArt: BoardArt = {
  viewBox: '-24 -24 648 648',
  anchor: (x, y) => [x, y],
  hitTransform: (x, y) => `translate(${x} ${y})`,
  draw(root, seats, tiles) {
    const { cells, lanes, stables } = drawAtlas(root, seats);
    for (const [abs, kind] of Object.entries(tiles)) drawSpecialTile(root, ...center(TRACK_CELLS[Number(abs)]), kind);
    return { cells, lanes: lanes.map(lane => [lane]), stables };
  },
  color: seat => ENAMEL[seat],
  sprite: { href: '/art/linh-ma.png', x: -27, y: -52, width: 54, height: 51 },
};
