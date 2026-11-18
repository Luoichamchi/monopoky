import { absOf, GATE, STABLE } from '../../core/board.ts';
import { svg } from './fx.ts';
import { CELL, CORNERS, HOME_CELLS, TRACK_CELLS, center, horseXY } from './layout.ts';
import { TILE_ENGRAVING, TILE_SKIN } from './skins.ts';
import { seatColor } from './theme.ts';

export const SPIRIT_INK = ['#ed94a6', '#86b9f0', '#8fceaf', '#e3b76f'];
const papers = ['#513a47', '#31495c', '#324c49', '#514637'];
const star = 'M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2Z';
const crests = [
  'M0 2C-14 0-13-12-4-9L0-4 4-9C13-12 14 0 0 2ZM0 4C-5 5-6 11-1 12L3 6Z',
  'M-12 5Q-7-4 0 1T12-4M-12 10Q-7 1 0 6T12 1M-9-3Q-3-11 4-6',
  'M-8 10 8-9M-3 5Q-13-7-4-10Q2-4-3 5ZM2 1Q9-2 14 1Q10 8 2 6',
  'M-12 7H12M-8 4A8 8 0 0 1 8 4ZM0-11V-8M-11-6-8-4M11-6 8-4',
];

function stable(root: SVGGElement, seat: number, used: boolean) {
  const [col, row] = CORNERS[seat];
  const x = col * CELL, y = row * CELL, ink = SPIRIT_INK[seat];
  const g = svg('g', { class: used ? 'stable' : 'stable off', transform: `translate(${x} ${y})` }, root);
  svg('rect', { x: 4, y: 4, width: 232, height: 232, rx: 5, fill: papers[seat], stroke: ink, 'stroke-width': 1.3 }, g);
  svg('image', { href: '/art/moon-pass.jpg', x: 7, y: 7, width: 226, height: 226, opacity: .3,
    preserveAspectRatio: seat % 2 ? 'xMaxYMid slice' : 'xMinYMid slice' }, g);
  // Printed silhouettes stay on the deepest sheet, below the track's cast shadow.
  svg('path', { d: 'M5 167Q40 162 83 131T178 83Q205 76 235 49V235H5Z', fill: '#192b36', opacity: .29 }, g);
  svg('path', { d: 'M5 203Q51 182 102 174T186 134Q209 123 235 119V235H5Z', fill: '#14232e', opacity: .38 }, g);
  svg('path', { d: 'M9 181Q60 174 99 147T177 107M135 146Q176 129 195 125M11 192Q50 184 60 177', fill: 'none', stroke: ink, 'stroke-opacity': .28 }, g);
  svg('path', { d: 'M12 44V13H45M196 13H227V44M227 195V227H198M43 227H13V196', fill: 'none', stroke: ink, 'stroke-width': 1.8 }, g);
  svg('path', { d: crests[seat], transform: 'translate(34 205) scale(.78)', fill: 'none', stroke: ink, 'stroke-width': 1.8 }, g);
  svg('text', { x: 53, y: 209, class: 'spirit-stable-name', fill: ink }, g, seatColor(seat).name.toUpperCase());
  svg('path', { d: 'M143 205h65', stroke: ink, 'stroke-opacity': .45 }, g);
  for (let i = 0; i < 4; i++) {
    const [px, py] = horseXY(seat, STABLE, i);
    const socket = svg('g', { transform: `translate(${px - x} ${py - y})` }, g);
    svg('ellipse', { rx: 22, ry: 9, fill: '#10202b', stroke: ink, 'stroke-opacity': .55 }, socket);
    svg('path', { d: 'M-27 0h5m44 0h5', stroke: ink, 'stroke-width': 1.3 }, socket);
  }
  return g;
}

export function drawSpecialTile(parent: SVGElement, x: number, y: number, kind: string) {
  const g = svg('g', { transform: `translate(${x} ${y})` }, parent);
  svg('circle', { r: 12.5, fill: '#29333d', stroke: TILE_SKIN[kind].color, 'stroke-opacity': .6 }, g);
  svg('path', { d: TILE_ENGRAVING[kind], fill: 'none', stroke: TILE_SKIN[kind].color, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
}

/** Parallel sheets in screen space. Every cell, socket and hit area uses the same square grid. */
export function drawSpiritBoard(root: SVGSVGElement, seats: number[], tiles: Record<number, string>) {
  const defs = svg('defs', {}, root);
  SPIRIT_INK.forEach((color, seat) => {
    const beam = svg('linearGradient', { id: `spirit-beam-${seat}`, x1: '0%', x2: '0%', y1: '0%', y2: '100%' }, defs);
    svg('stop', { offset: 0, 'stop-color': color, 'stop-opacity': 0 }, beam);
    svg('stop', { offset: 1, 'stop-color': color, 'stop-opacity': .45 }, beam);
  });
  const base = svg('g', { class: 'spirit-sheet stables-sheet' }, root);
  svg('rect', { x: -9, y: -9, width: 618, height: 618, rx: 7, fill: '#202f38', stroke: '#b7a889', 'stroke-width': 1.5 }, base);
  const stables = CORNERS.map((_, i) => stable(base, i, seats.includes(i)));
  const track = svg('g', { class: 'spirit-sheet track-sheet' }, root);
  svg('path', { d: 'M241 0H359V241H600V359H359V600H241V359H0V241H241Z', fill: '#253139', stroke: '#ced4bf', 'stroke-width': 2 }, track);
  const cells: SVGRectElement[] = [];
  const gates = CORNERS.map((_, i) => absOf(i, GATE));
  const starts = CORNERS.map((_, i) => absOf(i, 0));
  function tile(parent: SVGElement, x: number, y: number, fill: string) {
    return svg('rect', { x: x - 17.5, y: y - 17.5, width: 35, height: 35, rx: 3, fill }, parent);
  }
  TRACK_CELLS.forEach((cell, abs) => {
    if (gates.includes(abs)) return;
    const [x, y] = center(cell), seat = starts.indexOf(abs);
    cells[abs] = tile(track, x, y, seat < 0 ? '#e1dfcc' : SPIRIT_INK[seat]);
    if (tiles[abs]) drawSpecialTile(track, x, y, tiles[abs]);
    else svg('path', { d: star, transform: `translate(${x} ${y}) scale(${seat < 0 ? .35 : .9})`, fill: seat < 0 ? '#8b998f' : '#28353c' }, track);
  });
  const lanes = HOME_CELLS.map((home, seat) => {
    const g = svg('g', { class: seats.includes(seat) ? 'lane' : 'lane off' }, track);
    [TRACK_CELLS[gates[seat]], ...home].forEach((cell, index) => {
      const [x, y] = center(cell);
      const face = tile(g, x, y, papers[seat]);
      face.setAttribute('stroke', SPIRIT_INK[seat]);
      if (index) svg('text', { x, y: y + 6, class: 'spirit-step', fill: SPIRIT_INK[seat] }, g, String(index));
      else {
        cells[gates[seat]] = face;
        svg('path', { d: 'M-5-8 4 0-5 8', transform: `translate(${x} ${y}) rotate(${seat * 90})`, fill: 'none', stroke: SPIRIT_INK[seat], 'stroke-width': 2.5 }, g);
      }
    });
    return [g];
  });
  const seal = svg('g', { transform: 'translate(300 300)' }, track);
  svg('circle', { r: 16, fill: '#c26255', stroke: '#f0d2a5' }, seal);
  svg('path', { d: crests[3], fill: 'none', stroke: '#fff3d4', 'stroke-width': 1.5 }, seal);
  return { cells, lanes, stables };
}
