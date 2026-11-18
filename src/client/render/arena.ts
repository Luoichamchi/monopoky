// Parallel projection for the 2D arena. Heights are measured vertically on screen.
// Project only floors and footprints. Horse sprites and effects stand upright at their anchors.
import { GATE, STABLE, absOf } from '../../core/board.ts';
import { svg } from './fx.ts';
import { CELL, CORNERS, HOME_CELLS, TRACK_CELLS, center, horseXY } from './layout.ts';
import { TILE_ENGRAVING, TILE_SKIN } from './skins.ts';
import { THEME, seatColor } from './theme.ts';

type Point = [number, number];
const camera = { xx: .90, xy: -.44, yx: .29, yy: .59 };
export const TRACK_HEIGHT = 23;
export const STABLE_HEIGHT = 3;
export const ARENA_VIEWBOX = '-22 10 868 651';

export function project(x: number, y: number, z: number): Point {
  return [280 + camera.xx * x + camera.xy * y, 66 + camera.yx * x + camera.yy * y - z];
}

export function groundMatrix(x: number, y: number, z: number) {
  const [sx, sy] = project(x, y, z);
  return `matrix(${camera.xx} ${camera.yx} ${camera.xy} ${camera.yy} ${sx} ${sy})`;
}

function plane(parent: SVGElement, x: number, y: number, z: number) {
  return svg('g', { transform: groundMatrix(x, y, z) }, parent);
}

function square(x: number, y: number, half: number, cut: number): Point[] {
  const l = x-half, r = x+half, t = y-half, b = y+half;
  return [[l+cut,t],[r-cut,t],[r,t+cut],[r,b-cut],[r-cut,b],[l+cut,b],[l,b-cut],[l,t+cut]];
}

function polygon(parent: SVGElement, points: Point[], fill: string, stroke = 'none', weight = 1) {
  return svg('polygon', { points: points.map(p => p.join(',')).join(' '), fill, stroke, 'stroke-width': weight, 'stroke-linejoin': 'round' }, parent);
}

// Each visible vertical face connects the same two corners at two world heights.
function solid(parent: SVGElement, corners: Point[], bottom: number, top: number, fill: string, front: string, side: string) {
  const upper = corners.map(([x,y]) => project(x,y,top));
  const lower = corners.map(([x,y]) => project(x,y,bottom));
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    if (upper[j][0] >= upper[i][0]) continue;
    polygon(parent, [upper[i],upper[j],lower[j],lower[i]], corners[i][1] === corners[j][1] ? front : side, '#384267', 1.1);
  }
  return polygon(parent, upper, fill, '#465173', 1.3);
}

const star = 'M0 -11 3.2 -3.6 11 -3 5 2.5 6.7 10 0 6 -6.7 10 -5 2.5 -11 -3 -3.2 -3.6Z';

function courtyard(root: SVGElement, seat: number, active: boolean) {
  const [col,row] = CORNERS[seat];
  const x = CELL * col, y = CELL * row;
  const c = seatColor(seat);
  const g = svg('g', { class: active ? 'stable' : 'stable off' }, root);
  solid(g, square(x+120,y+120,116,13), -4, STABLE_HEIGHT, c.light, c.dark, c.main);
  const floor = plane(g,x,y,STABLE_HEIGHT);
  svg('path', { d: 'M20 21 H211 L220 30 V210 L211 219 H29 L19 209 V34', fill: 'none', stroke: '#fff', 'stroke-width': 6 }, floor);
  svg('path', { d: 'M24 179 181 22h13L24 192z M27 204 206 25h6L31 208z', fill: '#fff', opacity: .35 }, floor);
  for (let i = 0; i < 4; i++) {
    const [hx,hy] = horseXY(seat, STABLE, i);
    const cx = hx-x, cy = hy-y;
    svg('circle', { cx, cy, r: 26, fill: c.main, stroke: c.dark, 'stroke-width': 2 }, floor);
    svg('circle', { cx, cy, r: 21, fill: c.light, stroke: '#fff', 'stroke-width': 3 }, floor);
  }
  // A stencilled stable name stays on the floor below the four starting slots.
  svg('text', { x: 115, y: 195, class: 'stable-name', fill: c.dark }, floor, c.name.toUpperCase());
  return g;
}

// Start gate with two upright posts, a cast shadow, and a cloth drape in the team's colour.
function gate(parent: SVGElement, seat: number) {
  const [col,row] = CORNERS[seat];
  const x = col*CELL + 49, y = row*CELL + 32;
  const c = seatColor(seat);
  const floor = plane(parent,x,y,STABLE_HEIGHT);
  svg('path', { d: 'M-5 0h9l13 15h-9z M66 0h9l13 15h-9z', fill: '#343d69', opacity: .24 }, floor);
  const [sx,sy] = project(x,y,STABLE_HEIGHT);
  const g = svg('g', { transform: `matrix(0.90 0.29 0 1 ${sx} ${sy})`, stroke: '#353558', 'stroke-width': 2, 'stroke-linejoin': 'round' }, parent);
  for (const px of [0,70]) {
    svg('rect', { x:px-3, y:-33, width:6, height:33, fill:'#f68265' }, g);
    svg('rect', { x:px-5, y:-4, width:10, height:5, fill:'#50557b' }, g);
  }
  svg('path', { d:'M-6 -29 H76 V-24 H-6Z', fill:'#ff9a79' }, g);
  svg('path', { d:'M4 -29H66V-17l-10 3-10-3-10 3-10-3-10 3-12-4Z', fill:c.main }, g);
  svg('path', { d:star, transform:'translate(35 -22) scale(.46)', fill:'#fff6ca', stroke:'none' }, g);
  svg('path', { d:'M-13 -41Q33 -32 83 -41L78 -33Q34 -25 -8 -33Z', fill:'#454267' }, g);
  svg('path', { d:'M-9 -39Q34 -32 78 -39', fill:'none', stroke:'#b2bef1' }, g);
}

export function drawArena(root: SVGSVGElement, seats: number[], tiles: Record<number,string>) {
  const base = svg('g', {}, root);
  // The broad fascia and its contrasting stripe are visible even at phone size.
  solid(base, square(300,300,313,19), -49,-38,'#9aa2ef','#555493','#414077');
  solid(base, square(300,300,315,19), -38,-14,'#acb6ee','#8886c9','#6667a7');
  solid(base, square(300,300,315,19), -22,-17,'#d7d9fa','#f0c976','#e7a262');
  solid(base, square(300,300,317,19), -14,-4,'#e7ecff','#c4d0ee','#9aaad5');
  const stables = CORNERS.map((_,i) => courtyard(root,i,seats.includes(i)));
  const cells: SVGPolygonElement[] = [];
  const lanes: SVGGElement[][] = THEME.seats.map(() => []);
  // Sort all free-standing scenery and tile blocks together, back to front.
  const objects: { depth: number; draw: () => void }[] = [];
  function queue(x: number, y: number, draw: () => void) {
    objects.push({ depth: project(x,y,0)[1], draw });
  }
  CORNERS.forEach(([col,row],seat) => queue(col*CELL+80,row*CELL+32,() => gate(root,seat)));
  const starts = THEME.seats.map((_,seat) => absOf(seat,0));
  const gates = THEME.seats.map((_,seat) => absOf(seat,GATE));
  function tile(cx: number, cy: number, seat: number, step?: number, abs?: number) {
    const c = seat >= 0 ? seatColor(seat) : undefined;
    const parent = svg('g', {}, root);
    const shadow = plane(parent,cx+6,cy+9,STABLE_HEIGHT);
    svg('rect', { x:-19,y:-19,width:38,height:38,rx:3,fill:'#576787',opacity:.25 },shadow);
    const face = solid(parent,square(cx,cy,19,3),-3,TRACK_HEIGHT,c?.light ?? '#fffbed',c?.main ?? '#b7bee2',c?.dark ?? '#8594bf');
    if (abs !== undefined) cells[abs] = face;
    const cap = plane(parent,cx,cy,TRACK_HEIGHT);
    svg('path', { d:'M-15 11 V-14 H12', fill:'none', stroke:'#fff', 'stroke-width':2.5 },cap);
    if (step !== undefined && c) {
      parent.classList.add('lane');
      parent.classList.toggle('off',!seats.includes(seat));
      lanes[seat].push(parent);
      if (step) svg('text',{x:0,y:7,class:'lane-number',fill:c.dark},cap,String(step));
      else svg('path',{d:'M-7 -8 2 0 -7 8 M0 -8 9 0 0 8',transform:`rotate(${90*seat})`,fill:'none',stroke:c.dark,'stroke-width':3},cap);
    } else if (abs !== undefined && tiles[abs]) {
      const kind = tiles[abs];
      svg('circle',{r:14,fill:TILE_SKIN[kind].color,stroke:'#54466e','stroke-width':1.8},cap);
      svg('path',{d:TILE_ENGRAVING[kind],fill:'none',stroke:'#3b3659','stroke-width':2.1,'stroke-linecap':'round','stroke-linejoin':'round'},cap);
    } else if (c) svg('path',{d:star,fill:c.main,stroke:c.dark,'stroke-width':1.5},cap);
    else svg('circle',{r:2.5,fill:'#c2bdd0'},cap);
  }
  TRACK_CELLS.forEach((cell,abs) => {
    if (gates.includes(abs)) return;
    const [x,y] = center(cell);
    queue(x,y,() => tile(x,y,starts.indexOf(abs),undefined,abs));
  });
  HOME_CELLS.forEach((home,seat) => {
    [TRACK_CELLS[gates[seat]],...home].forEach((cell,i) => {
      const [x,y] = center(cell);
      queue(x,y,() => tile(x,y,seat,i,i === 0 ? gates[seat] : undefined));
    });
  });
  queue(300,300,() => {
    solid(root,square(300,300,19,5),-3,TRACK_HEIGHT+4,'#fff4ae','#ffb653','#e78945');
    const [x,y] = project(300,300,TRACK_HEIGHT+11);
    svg('path',{d:star,transform:`translate(${x} ${y}) scale(1.35)`,fill:'#ffdf62',stroke:'#8b534c','stroke-width':2},root);
  });
  objects.sort((a,b) => a.depth-b.depth).forEach(o => o.draw());
  return { cells, lanes, stables };
}
