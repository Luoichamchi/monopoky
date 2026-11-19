// SVG board + horses. Knows nothing about networking or rules flow: it draws a state and animates events.
import { GATE, STABLE, absOf, seatOf } from '../../core/board.ts';
import type { GameEvent, GameState } from '../../core/types.ts';
import type { BoardRenderer } from './renderer.ts';
import { TIMING } from '../../session.ts';
import { animate, burst, createTimeline, done, explosion, iconPop, impact, sfxText, shake, svg, utils } from './fx.ts';
import { CELL, CORNERS, HOME_CELLS, SIZE, TRACK_CELLS, center, horseXY } from './layout.ts';
import { TILE_SKIN } from './skins.ts';
import { THEME, seatColor } from './theme.ts';

const PAD = 14;

import '../classic-board.css';

export class ClassicBoard implements BoardRenderer {
  readonly el: HTMLElement;
  private root: SVGSVGElement;
  private tilesLayer!: SVGGElement;
  private horseLayer!: SVGGElement;
  private fx!: SVGGElement;
  private marker!: SVGCircleElement;
  private horses: SVGGElement[] = [];
  private pos: number[] = []; // displayed positions
  private s!: GameState;
  private onPick?: (id: number) => void;
  private cells: SVGRectElement[] = []; // track squares by absolute index (sparse: no starts/gates)
  private lanes: SVGGElement[] = [];
  onHop?: () => void; // hook for sound/haptics, keeps this file free of audio

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'classic-board';
    host.appendChild(this.el);
    this.root = svg('svg', { viewBox: `${-PAD} ${-PAD} ${SIZE + 2 * PAD} ${SIZE + 2 * PAD}` }, this.el);
  }

  build(s: GameState) {
    this.s = s;
    this.root.innerHTML = '';
    this.drawBoard(s);
    this.tilesLayer = svg('g', {}, this.root);
    for (const [abs, kind] of Object.entries(s.tiles)) {
      const [x, y] = center(TRACK_CELLS[+abs]);
      const skin = TILE_SKIN[kind];
      const pos = svg('g', { transform: `translate(${x} ${y})` }, this.tilesLayer);
      const g = svg('g', { class: 'tile' }, pos); // CSS animation lives on the inner group, the outer one keeps the position
      svg('circle', { r: 14, fill: skin.color, class: 'tile-bg' }, g);
      svg('text', { class: 'tile-icon', 'font-size': 17 }, g, skin.icon);
      g.style.animationDelay = `${(+abs % 7) * -0.3}s`;
    }
    this.marker = svg('circle', { class: 'marker', r: 17 }, this.root);
    this.horseLayer = svg('g', {}, this.root);
    this.fx = svg('g', { class: 'fx' }, this.root);
    this.horses = s.horses.map(h => this.drawHorse(seatOf(s, h.owner), h.id));
    this.pos = s.horses.map(() => STABLE);
    this.sync(s);
  }

  /** Snap every horse to the true state (end of an animation batch, reconnects). */
  sync(s: GameState) {
    this.s = s;
    for (const h of s.horses) {
      this.pos[h.id] = h.pos;
      const [x, y] = this.xy(h.id, h.pos);
      utils.set(this.horses[h.id], { x, y, scale: 1, rotate: 0, opacity: 1 });
      this.horses[h.id].classList.toggle('shielded', h.shield > 0);
      this.horses[h.id].classList.toggle('frozen', h.frozen > 0);
    }
    this.paintCells();
  }

  /** Make some horses clickable. `preview` returns the destination pos to show on hover. */
  setPickable(ids: number[], onPick?: (id: number) => void, preview?: (id: number) => number | null) {
    this.onPick = onPick;
    this.marker.classList.remove('on');
    this.horses.forEach((g, id) => {
      const on = ids.includes(id);
      g.classList.toggle('pickable', on);
      g.onpointerenter = on && preview ? () => this.showMarker(id, preview(id)) : null;
      g.onpointerleave = on ? () => this.marker.classList.remove('on') : null;
    });
  }

  async animate(e: GameEvent) {
    switch (e.t) {
      case 'move':
        if (e.jump) await this.teleport(e.horse, e.path[0]);
        else for (const p of e.path) await this.hop(e.horse, p);
        break;
      case 'kick':
        await this.kick(e.horse);
        break;
      case 'tile':
        await this.tile(e.horse, e.tile);
        break;
      case 'shield':
        this.horses[e.horse].classList.toggle('shielded', e.on);
        if (e.on) await burst(this.fx, ...this.xy(e.horse), ['#7fd8ff', '#ffffff'], 10);
        break;
      case 'freeze':
        this.horses[e.horse].classList.toggle('frozen', e.on);
        if (e.on) await burst(this.fx, ...this.xy(e.horse), ['#bdf0ff', '#ffffff'], 14);
        break;
    }
  }

  destroy() {
    this.el.remove();
  }

  /** Little celebration on a horse (cards, bonus). */
  cheer(horse: number, icon: string, color: string) {
    return iconPop(this.fx, ...this.xy(horse), icon, color);
  }

  // ---------- drawing ----------

  private xy(id: number, pos = this.pos[id]): [number, number] {
    const h = this.s.horses[id];
    return horseXY(seatOf(this.s, h.owner), pos, id % 4);
  }

  private showMarker(id: number, to: number | null) {
    if (to === null) return;
    const [x, y] = this.xy(id, to);
    this.marker.setAttribute('cx', String(x));
    this.marker.setAttribute('cy', String(y));
    this.marker.style.stroke = seatColor(seatOf(this.s, this.s.horses[id].owner)).main;
    this.marker.classList.add('on');
  }

  private drawBoard(s: GameState) {
    const r = this.root;
    const defs = svg('defs', {}, r);
    const dots = svg('pattern', { id: 'dots', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, defs);
    svg('circle', { cx: 5, cy: 5, r: 1.8, fill: '#fff', opacity: 0.35 }, dots);
    THEME.seats.forEach((c, i) => {
      const g = svg('radialGradient', { id: `horse${i}`, cx: '35%', cy: '30%', r: '75%' }, defs);
      svg('stop', { offset: '0%', 'stop-color': '#fff' }, g);
      svg('stop', { offset: '35%', 'stop-color': c.main }, g);
      svg('stop', { offset: '100%', 'stop-color': c.dark }, g);
    });

    svg('rect', { x: -8, y: -8, width: SIZE + 16, height: SIZE + 16, rx: 30, class: 'board-bg' }, r);
    const used = new Set(s.players.map(p => p.seat));

    CORNERS.forEach(([c, rr], seat) => {
      const col = seatColor(seat);
      const g = svg('g', { class: used.has(seat) ? 'stable' : 'stable off' }, r);
      const x = c * CELL + 4, y = rr * CELL + 4, w = 6 * CELL - 8;
      svg('rect', { x, y, width: w, height: w, rx: 26, fill: col.main, stroke: THEME.ink, 'stroke-width': 4 }, g);
      svg('rect', { x, y, width: w, height: w, rx: 26, fill: 'url(#dots)' }, g);
      svg('rect', { x: x + CELL * 0.75, y: y + CELL * 0.75, width: w - CELL * 1.5, height: w - CELL * 1.5, rx: 20, fill: col.light, stroke: THEME.ink, 'stroke-width': 3 }, g);
      for (let k = 0; k < 4; k++) {
        const [hx, hy] = horseXY(seat, STABLE, k);
        svg('circle', { cx: hx, cy: hy, r: 18, fill: '#fff', stroke: col.main, 'stroke-width': 3, 'stroke-dasharray': '5 4' }, g);
      }
    });

    // shared track: faint, a square lights up only while a horse stands on it (see paintCells)
    const starts = [0, 1, 2, 3].map(seat => absOf(seat, 0));
    const gates = [0, 1, 2, 3].map(seat => absOf(seat, GATE));
    this.cells = [];
    TRACK_CELLS.forEach((cell, abs) => {
      if (gates.includes(abs)) return; // drawn as part of the home lane
      const [cx, cy] = center(cell);
      const seat = starts.indexOf(abs);
      const rect = svg('rect', { x: cx - CELL / 2 + 3, y: cy - CELL / 2 + 3, width: CELL - 6, height: CELL - 6, rx: 9, fill: seat >= 0 ? seatColor(seat).main : '#fff', class: seat >= 0 ? 'cell start' : 'cell' }, r);
      if (seat >= 0) svg('text', { x: cx, y: cy, class: 'cell-mark', fill: '#fff' }, r, '★');
      else this.cells[abs] = rect;
    });

    // center: four colored triangles + star
    const a = 6 * CELL, b = 9 * CELL, m = 7.5 * CELL;
    const tri = [[a, a, a, b], [a, a, b, a], [b, a, b, b], [a, b, b, b]];
    tri.forEach((t, seat) =>
      svg('polygon', { points: `${t[0]},${t[1]} ${t[2]},${t[3]} ${m},${m}`, fill: seatColor(seat).light, stroke: THEME.ink, 'stroke-width': 3, 'stroke-linejoin': 'round' }, r),
    );

    // home lanes: gate square + steps 1..6 as one bold strip per seat, the visual focus of the board
    this.lanes = HOME_CELLS.map((home, seat) => {
      const col = seatColor(seat);
      const gate = TRACK_CELLS[absOf(seat, GATE)];
      const all = [gate, ...home];
      const [c0, c1] = [Math.min(...all.map(c => c[0])), Math.max(...all.map(c => c[0]))];
      const [r0, r1] = [Math.min(...all.map(c => c[1])), Math.max(...all.map(c => c[1]))];
      const g = svg('g', { class: used.has(seat) ? 'lane' : 'lane off' }, r);
      g.style.setProperty('--c', col.main);
      svg('rect', { x: c0 * CELL + 1, y: r0 * CELL + 1, width: (c1 - c0 + 1) * CELL - 2, height: (r1 - r0 + 1) * CELL - 2, rx: 14, fill: col.main, class: 'lane-bg' }, g);
      svg('rect', { x: c0 * CELL + 1, y: r0 * CELL + 1, width: (c1 - c0 + 1) * CELL - 2, height: (r1 - r0 + 1) * CELL - 2, rx: 14, fill: 'url(#dots)' }, g);
      // gate square with an arrow pointing into the lane
      const [gx, gy] = center(gate);
      const [hx, hy] = center(home[0]);
      svg('rect', { x: gx - 15, y: gy - 15, width: 30, height: 30, rx: 8, fill: col.light }, g);
      const angle = (Math.atan2(hy - gy, hx - gx) * 180) / Math.PI;
      svg('path', { d: 'M-5 -9 L6 0 L-5 9', fill: 'none', stroke: col.dark, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', transform: `translate(${gx} ${gy}) rotate(${angle})` }, g);
      home.forEach((cell, i) => {
        const [cx, cy] = center(cell);
        const win = i >= 2; // steps 3..6 are the winning steps
        svg('rect', { x: cx - 15, y: cy - 15, width: 30, height: 30, rx: 8, fill: win ? '#fff' : col.light }, g);
        svg('text', { x: cx, y: cy, class: 'cell-num', fill: win ? col.main : col.dark }, g, String(i + 1));
      });
      return g;
    });
    svg('text', { x: m, y: m + 1, class: 'center-star' }, r, '★');
  }

  /** Light up track squares that hold a horse (in that horse's color). */
  private paintCells() {
    const occ = new Map<number, string>();
    for (const h of this.s.horses) {
      const p = this.pos[h.id];
      const seat = seatOf(this.s, h.owner);
      if (p >= 0 && p <= GATE) occ.set(absOf(seat, p), seatColor(seat).light);
    }
    this.cells.forEach((c, abs) => {
      const col = occ.get(abs);
      c.classList.toggle('occ', !!col);
      c.style.fill = col ?? '';
    });
  }

  /** Glow the home lane of the player whose turn it is (-1 = none). */
  setTurn(seat: number) {
    this.lanes.forEach((l, i) => l.classList.toggle('active', i === seat));
  }

  private drawHorse(seat: number, id: number): SVGGElement {
    const g = svg('g', { class: 'horse' }, this.horseLayer);
    svg('ellipse', { cx: 0, cy: 14, rx: 13, ry: 4.5, class: 'horse-shadow' }, g);
    svg('circle', { r: 24, class: 'ring' }, g);
    const body = svg('g', { class: 'hbody' }, g);
    svg('circle', { r: 16, fill: `url(#horse${seat})`, stroke: THEME.ink, 'stroke-width': 3 }, body);
    svg('ellipse', { cx: -6, cy: -8, rx: 5, ry: 3, fill: '#fff', opacity: 0.8, transform: 'rotate(-35 -6 -8)' }, body);
    svg('text', { y: 1.5, class: 'horse-glyph' }, body, THEME.horseGlyph);
    svg('circle', { r: 21, class: 'bubble' }, g);
    g.addEventListener('click', () => g.classList.contains('pickable') && this.onPick?.(id));
    return g;
  }

  // ---------- animations ----------

  private async hop(id: number, to: number) {
    const g = this.horses[id];
    const [x, y] = this.xy(id, to);
    this.pos[id] = to;
    this.paintCells();
    this.onHop?.();
    this.horseLayer.appendChild(g); // moving horse on top
    const body = g.querySelector('.hbody')!;
    await Promise.all([
      done(animate(g, { x, y, duration: TIMING.hop, ease: 'inOutSine' })),
      done(animate(body, {
        translateY: [{ to: -18, ease: 'outQuad' }, { to: 0, ease: 'inQuad' }],
        scaleY: [{ to: 1.12 }, { to: 0.82 }, { to: 1 }],
        scaleX: [{ to: 0.92 }, { to: 1.15 }, { to: 1 }],
        duration: TIMING.hop,
      })),
    ]);
  }

  private async teleport(id: number, to: number) {
    const g = this.horses[id];
    const [fx, fy] = this.xy(id);
    burst(this.fx, fx, fy, ['#b28dff', '#ffffff', '#6ee7ff'], 12);
    await done(animate(g, { scale: 0, rotate: 540, duration: 280, ease: 'inBack' }));
    this.pos[id] = to;
    this.paintCells();
    const [x, y] = this.xy(id);
    utils.set(g, { x, y });
    burst(this.fx, x, y, ['#b28dff', '#ffffff', '#6ee7ff'], 12);
    await done(animate(g, { scale: [0, 1], rotate: [-360, 0], duration: 320, ease: 'outBack(2)' }));
  }

  private async kick(id: number) {
    const g = this.horses[id];
    const [x, y] = this.xy(id);
    const color = seatColor(seatOf(this.s, this.s.horses[id].owner)).main;
    shake(this.el, 10);
    impact(this.fx, x, y, color);
    burst(this.fx, x, y, [color, '#fff', '#ffe14d'], 16);
    sfxText(this.fx, x, y, THEME.sfx[Math.floor(Math.random() * THEME.sfx.length)], '#ffe14d');
    await done(
      createTimeline()
        .add(g, { y: y - 70, rotate: 720, scale: 1.4, duration: 300, ease: 'outQuad' })
        .add(g, { scale: 0, opacity: 0, duration: 150 }),
    );
    this.pos[id] = STABLE;
    this.paintCells();
    const [sx, sy] = this.xy(id);
    utils.set(g, { x: sx, y: sy, rotate: 0 });
    await done(animate(g, { scale: [0, 1], opacity: 1, duration: 200, ease: 'outBack(3)' }));
  }

  private async tile(id: number, kind: string) {
    const [x, y] = this.xy(id);
    const skin = TILE_SKIN[kind];
    if (kind === 'bomb') {
      shake(this.el, 14);
      explosion(this.fx, x, y);
      sfxText(this.fx, x, y, 'DOKAAN!', '#ff7a59');
    }
    await iconPop(this.fx, x, y, skin.icon, skin.color);
  }
}
