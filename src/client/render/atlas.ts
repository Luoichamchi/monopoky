// Engraved board surfaces, from the recessed courtyards up to the enamel track.
import { GATE, STABLE, absOf } from '../../core/board.ts';
import { svg } from './fx.ts';
import { CELL, CORNERS, HOME_CELLS, TRACK_CELLS, center, horseXY } from './layout.ts';
import { seatColor } from './theme.ts';

export const ENAMEL = ['#f997b4', '#8cc9fa', '#78d9b8', '#f3c777'];
const STONE = ['#573244', '#26415c', '#244b48', '#554432'];
const GOLD = '#d5b981';
const stamp = 'M0 -5 L1.5 -1.5 L5 0 L1.5 1.5 L0 5 L-1.5 1.5 L-5 0 L-1.5 -1.5 Z';

function gradient(defs: SVGDefsElement, id: string, colors: string[]) {
  const g = svg('linearGradient', { id, x2: '36%', y2: '100%' }, defs);
  colors.forEach((color, i) => svg('stop', { offset: i / (colors.length - 1), 'stop-color': color }, g));
}

function courtyard(root: SVGSVGElement, seat: number, used: boolean) {
  const [col, row] = CORNERS[seat];
  const color = ENAMEL[seat];
  const g = svg('g', { class: used ? 'stable' : 'stable off', transform: `translate(${col * CELL} ${row * CELL})` }, root);
  const outline = 'M20 6 H220 L234 20 V220 L220 234 H20 L6 220 V20 Z';
  svg('path', { d: outline, fill: '#11151f', stroke: '#927f62', 'stroke-width': 2 }, g);
  svg('path', { d: 'M22 12 H218 L228 22 V218 L218 228 H22 L12 218 V22 Z', fill: `url(#stable-${seat})`, stroke: color, 'stroke-opacity': .6 }, g);
  // The observatory dial sits behind the four horse projections.
  const dial = svg('g', { fill: 'none', stroke: color, 'stroke-opacity': .24 }, g);
  for (const r of [82, 87, 96]) svg('circle', { cx: 120, cy: 114, r }, dial);
  svg('path', { d: 'M24 114 H216 M120 20 V208 M53 47 L187 181 M53 181 L187 47', 'stroke-dasharray': '2 5' }, dial);
  for (let i = 0; i < 48; i++) {
    svg('path', { d: i % 4 ? 'M120 21 v3' : 'M120 19 v6', transform: `rotate(${7.5 * i} 120 114)` }, dial);
  }
  // Distant, etched ridgelines recede into the floor of each stable.
  svg('path', { d: 'M13 183 L38 163 51 171 75 143 102 171 122 156 152 179 173 151 195 168 208 160 227 178 V216 L216 227 H24 L13 216Z', fill: '#101925', opacity: .42 }, g);
  svg('path', { d: 'M13 183 L38 163 51 171 75 143 102 171 122 156 152 179 173 151 195 168 208 160 227 178 M75 143 l-5 20 8-6 12 11 M173 151 l-3 15 6-5 9 8', fill: 'none', stroke: color, 'stroke-opacity': .28 }, g);
  for (let i = 0; i < 24; i++) {
    const x = 22 + ((i * 83 + seat * 11) % 195), y = 24 + ((i * 37 + seat * 23) % 154);
    svg('circle', { cx: x, cy: y, r: i % 5 ? .8 : 1.5, fill: '#f7ead0', opacity: .5 }, g);
  }
  for (let slot = 0; slot < 4; slot++) {
    const [hx, hy] = horseXY(seat, STABLE, slot);
    const cx = hx - col * CELL, cy = hy - row * CELL;
    svg('ellipse', { cx, cy: cy + 2, rx: 24, ry: 10, fill: '#101724', stroke: color, 'stroke-opacity': .48 }, g);
    svg('ellipse', { cx, cy: cy + 2, rx: 20, ry: 7, fill: 'none', stroke: color, 'stroke-dasharray': '12 5', 'stroke-opacity': .4 }, g);
  }
  svg('path', { d: 'M39 206 H63 M177 206 H201', stroke: color, opacity: .62 }, g);
  svg('text', { x: 120, y: 210, class: 'stable-name', fill: color }, g, seatColor(seat).name.toUpperCase());
  return g;
}

export function drawAtlas(root: SVGSVGElement, seats: number[]) {
  const defs = svg('defs', {}, root);
  gradient(defs, 'table-enamel', ['#586071', '#272e41', '#191f30']);
  gradient(defs, 'track-enamel', ['#626979', '#444e61', '#333c50']);
  STONE.forEach((c, seat) => gradient(defs, `stable-${seat}`, [c, c, '#1a2331']));
  const frame = (inset: number, y: number, fill: string, stroke: string) => {
    const lo = -inset, hi = 600 + inset, cut = 19;
    svg('path', { d: `M${lo + cut} ${lo} H${hi - cut} L${hi} ${lo + cut} V${hi-cut} L${hi-cut} ${hi} H${lo+cut} L${lo} ${hi-cut} V${lo+cut} Z`, transform: `translate(0 ${y})`, fill, stroke, 'stroke-width': 1.7 }, root);
  };
  frame(13, 10, '#171823', '#5e503b');
  frame(13, 6, '#635543', '#b79a6b');
  frame(13, 0, '#262c39', GOLD);
  frame(8, 0, 'url(#table-enamel)', '#9a8e7a');
  const stables = CORNERS.map((_, seat) => courtyard(root, seat, seats.includes(seat)));
  const starts = ENAMEL.map((_, seat) => absOf(seat, 0));
  const gates = ENAMEL.map((_, seat) => absOf(seat, GATE));
  const cells: SVGRectElement[] = [];
  function slab(x: number, y: number, fill: string, stroke: string, parent: SVGElement) {
    const rect = { x: x - 18, y: y - 18, width: 36, height: 34, rx: 5 };
    svg('rect', { ...rect, y: y - 14, fill: '#191e2c' }, parent);
    const face = svg('rect', { ...rect, fill, stroke, 'stroke-width': 1 }, parent);
    svg('path', { d: `M${x-13} ${y-15.5} h26`, stroke: '#fff', opacity: .15 }, parent);
    return face;
  }
  TRACK_CELLS.forEach((cell, abs) => {
    if (gates.includes(abs)) return;
    const [x, y] = center(cell);
    const seat = starts.indexOf(abs);
    cells[abs] = slab(x, y, seat < 0 ? 'url(#track-enamel)' : STONE[seat], seat < 0 ? '#778295' : ENAMEL[seat], root);
    svg('path', { d: stamp, fill: seat < 0 ? '#a7b0bc' : ENAMEL[seat], transform: `translate(${x} ${y-1}) scale(${seat < 0 ? .5 : 1.7})` }, root);
  });
  const lanes = HOME_CELLS.map((home, seat) => {
    const g = svg('g', { class: seats.includes(seat) ? 'lane' : 'lane off' }, root);
    const gate = TRACK_CELLS[gates[seat]];
    [gate, ...home].forEach((cell, i) => {
      const [x, y] = center(cell);
      slab(x, y, STONE[seat], ENAMEL[seat], g);
      if (i) svg('text', { x, y: y + 5, class: 'lane-number', fill: ENAMEL[seat] }, g, String(i));
      else svg('path', { d: 'M-5 -7 L3 0 L-5 7 M2 -7 L10 0 L2 7', transform: `translate(${x} ${y-1}) rotate(${seat * 90})`, fill: 'none', stroke: ENAMEL[seat], 'stroke-width': 2 }, g);
    });
    return g;
  });
  // Compass rose occupies only the central cell, leaving all six home steps legible.
  const hub = svg('g', { transform: 'translate(300 300)' }, root);
  svg('circle', { r: 20, fill: '#20293a', stroke: GOLD }, hub);
  svg('circle', { r: 16, fill: 'none', stroke: '#897b63' }, hub);
  for (let i = 0; i < 8; i++) {
    const g = svg('g', { transform: `rotate(${45*i}) scale(${i%2 ? .58 : 1})` }, hub);
    svg('path', { d: 'M0 -19 L4 0 H0Z', fill: '#f9e8ba' }, g);
    svg('path', { d: 'M0 -19 L-4 0 H0Z', fill: '#a48c5f' }, g);
  }
  return { cells, lanes, stables };
}
