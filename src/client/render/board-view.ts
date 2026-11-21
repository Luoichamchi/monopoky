// SVG board + horses. Knows nothing about networking or rules flow: it draws a state and animates events.
import { GATE, STABLE, absOf, seatOf } from '../../core/board.ts';
import type { GameEvent, GameState } from '../../core/types.ts';
import type { BoardRenderer } from './renderer.ts';
import { TIMING } from '../../session.ts';
import { animate, burst, createTimeline, done, explosion, iconPop, impact, sfxText, shake, svg, utils } from './fx.ts';
import { CELL, TRACK_CELLS, center, horseXY } from './layout.ts';
import type { BoardArt } from './board-art.ts';
import { DUEL_SKIN, STATUS_ICON, TILE_SKIN } from './skins.ts';
import type { HorseFx, Trap } from '../../core/types.ts';
import { THEME, seatColor } from './theme.ts';

export class BoardView implements BoardRenderer {
  readonly el: HTMLElement;
  private root: SVGSVGElement;
  private ground!: SVGGElement;
  private hitLayer!: SVGGElement;
  private projections: SVGGElement[] = [];
  private targets: SVGRectElement[] = [];
  private stables: SVGGElement[] = [];
  private horseLayer!: SVGGElement;
  private fx!: SVGGElement;
  private trapLayer!: SVGGElement; // duel: face-down cards on squares
  private squareLayer!: SVGGElement; // duel: clickable squares
  private traps = new Map<number, SVGGElement>();
  private marker!: SVGEllipseElement;
  private horses: SVGGElement[] = [];
  private pos: number[] = []; // displayed positions
  private s!: GameState;
  private onPick?: (id: number) => void;
  private cells: SVGGraphicsElement[] = [];
  private art: BoardArt;
  onHop?: () => void; // hook for sound/haptics, keeps this file free of audio

  constructor(host: HTMLElement, art: BoardArt) {
    this.art = art;
    this.el = document.createElement('div');
    this.el.className = 'board';
    host.appendChild(this.el);
    this.root = svg('svg', { viewBox: art.viewBox }, this.el);
  }

  build(s: GameState) {
    this.s = s;
    this.root.innerHTML = '';
    const arena = this.art.draw(this.root, s.players.map(p => p.seat), s.tiles);
    this.cells = arena.cells;
    this.stables = arena.stables;
    this.projections = [];
    this.targets = [];
    this.marker = svg('ellipse', { class: 'marker', rx: 16, ry: 9 }, this.root);
    this.trapLayer = svg('g', { class: 'traps' }, this.root);
    this.traps.clear();
    this.ground = svg('g', { class: 'projections' }, this.root);
    this.horseLayer = svg('g', { class: 'spirits' }, this.root);
    this.hitLayer = svg('g', { class: 'horse-targets' }, this.root);
    this.squareLayer = svg('g', { class: 'square-picks' }, this.root);
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
      utils.set([this.horses[h.id], this.projections[h.id]], { x, y, scale: 1, rotate: 0, opacity: 1 });
      const [wx, wy] = horseXY(seatOf(s, h.owner), h.pos, h.id % 4);
      this.targets[h.id].setAttribute('transform', this.art.hitTransform(wx, wy, h.pos === STABLE));
      this.horses[h.id].classList.toggle('shielded', h.shield > 0);
      this.horses[h.id].classList.toggle('frozen', h.frozen > 0);
      this.badges(h.id, h.fx);
    }
    this.drawTraps(s.duel?.traps ?? []);
    // Paint rear spirits first so adjacent ranks read in the same order as their footprints.
    const ordered = [...s.horses].sort((a, b) => this.xy(a.id)[1] - this.xy(b.id)[1]);
    for (const h of ordered) this.horseLayer.append(this.horses[h.id]);
    this.paintCells();
  }

  /** Make some horses clickable. `preview` returns the destination pos to show on hover. */
  setPickable(ids: number[], onPick?: (id: number) => void, preview?: (id: number) => number | null) {
    this.onPick = onPick;
    this.marker.classList.remove('on');
    this.horses.forEach((g, id) => {
      const on = ids.includes(id);
      g.classList.toggle('pickable', on);
      const target = this.targets[id];
      this.projections[id].classList.toggle('selectable', on);
      target.classList.toggle('enabled', on);
      target.setAttribute('tabindex', on ? '0' : '-1');
      target.setAttribute('aria-disabled', String(!on));
      const enter = on && preview ? () => this.showMarker(id, preview(id)) : null;
      const leave = () => this.marker.classList.remove('on');
      target.onfocus = target.onpointerenter = g.onpointerenter = enter;
      target.onblur = target.onpointerleave = g.onpointerleave = leave;
    });
  }

  setSquares(abs: number[], onPick?: (abs: number) => void) {
    this.squareLayer.innerHTML = '';
    for (const a of abs) {
      const [x, y] = center(TRACK_CELLS[a]);
      const r = svg('rect', { x: x - CELL / 2 + 2, y: y - CELL / 2 + 2, width: CELL - 4, height: CELL - 4, rx: 6, class: 'square-pick', tabindex: 0, role: 'button', 'aria-label': `Ô ${a}` }, this.squareLayer);
      r.onclick = () => onPick?.(a);
      r.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick?.(a));
    }
  }

  async animate(e: GameEvent) {
    switch (e.t) {
      case 'status': {
        const h = this.s.horses[e.horse];
        const fx: HorseFx = { ...(h.fx ?? {}), [e.kind]: e.n };
        this.badges(e.horse, fx);
        if (e.kind === 'ice') this.horses[e.horse].classList.toggle('frozen', e.n > 0);
        if (e.kind === 'guard') this.horses[e.horse].classList.toggle('shielded', e.n > 0);
        if (e.n > 0) await iconPop(this.fx, ...this.xy(e.horse), STATUS_ICON[e.kind], '#ffffffcc');
        break;
      }
      case 'trap':
        if (e.on) {
          const g = this.trapToken({ abs: e.abs, owner: e.owner, kind: e.kind, left: 0 });
          await done(animate(g.firstElementChild!, { scale: [0, 1], rotate: [-200, -8], duration: 420, ease: 'outBack(2)' }));
        } else {
          const g = this.traps.get(e.abs);
          this.traps.delete(e.abs);
          if (g) await done(animate(g, { opacity: 0, duration: 250, onComplete: () => g.remove() }));
        }
        break;
      case 'spring': {
        const [x, y] = center(TRACK_CELLS[e.abs]);
        this.traps.get(e.abs)?.remove();
        this.traps.delete(e.abs);
        shake(this.el, 8);
        burst(this.fx, x, y, ['#b58cff', '#ffffff', '#ffe14d'], 16);
        await iconPop(this.fx, x, y, DUEL_SKIN[e.kind] ?? '❔', '#b58cff');
        break;
      }
      case 'link':
        if (e.on) await iconPop(this.fx, ...this.xy(e.follower), '🔗', '#b58cff');
        break;
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

  /** Status icons floating over a horse's head (duel). */
  private badges(id: number, fx: HorseFx | undefined) {
    const g = this.horses[id]?.querySelector<SVGGElement>('.badges');
    if (!g) return;
    g.innerHTML = '';
    const n = (k: string) => (fx as Record<string, number> | undefined)?.[k] ?? 0;
    const on = Object.entries(STATUS_ICON).filter(([k]) => n(k) > 0);
    on.forEach(([k, icon], i) => {
      const x = (i - (on.length - 1) / 2) * 15;
      svg('text', { x, y: -60, 'font-size': 12, 'text-anchor': 'middle' }, g, icon);
      if (n(k) > 1 && k !== 'immune') svg('text', { x: x + 7, y: -54, class: 'badge-n' }, g, String(n(k)));
    });
  }

  private drawTraps(traps: Trap[]) {
    const keep = new Set(traps.map(t => t.abs));
    for (const [abs, g] of this.traps) if (!keep.has(abs)) (g.remove(), this.traps.delete(abs));
    for (const t of traps) this.trapToken(t);
  }

  /** A face-down card lying on the square, rimmed in the owner's colour; your own traps show what they are. */
  private trapToken(t: Trap) {
    this.traps.get(t.abs)?.remove();
    const [x, y] = center(TRACK_CELLS[t.abs]);
    const g = svg('g', { class: 'trap', transform: `translate(${x} ${y})` }, this.trapLayer);
    const card = svg('g', { transform: 'rotate(-8)' }, g);
    svg('rect', { x: -11, y: -15, width: 22, height: 30, rx: 2.5, fill: 'none', stroke: this.art.color(seatOf(this.s, t.owner)), 'stroke-width': 2.5 }, card);
    svg('image', { href: '/art/card-back.webp', x: -10, y: -14, width: 20, height: 28 }, card);
    if (t.kind !== '?') svg('text', { x: 9, y: 12, 'font-size': 11, 'text-anchor': 'middle' }, g, DUEL_SKIN[t.kind]);
    this.traps.set(t.abs, g);
    return g;
  }

  private xy(id: number, pos = this.pos[id]): [number, number] {
    const h = this.s.horses[id];
    return this.art.anchor(...horseXY(seatOf(this.s, h.owner), pos, id % 4), pos === STABLE);
  }

  private showMarker(id: number, to: number | null) {
    if (to === null) return;
    const [x, y] = this.xy(id, to);
    this.marker.setAttribute('cx', String(x));
    this.marker.setAttribute('cy', String(y));
    this.marker.style.stroke = seatColor(seatOf(this.s, this.s.horses[id].owner)).main;
    this.marker.classList.add('on');
  }

  /** Light up track squares that hold a horse (in that horse's color). */
  private paintCells() {
    const occ = new Map<number, string>();
    for (const h of this.s.horses) {
      const p = this.pos[h.id];
      const seat = seatOf(this.s, h.owner);
      if (p >= 0 && p <= GATE) occ.set(absOf(seat, p), this.art.color(seat));
    }
    this.cells.forEach((c, abs) => {
      const col = occ.get(abs);
      c.classList.toggle('occ', !!col);
      c.style.fill = col ?? '';
    });
  }

  /** Glow the home lane of the player whose turn it is (-1 = none). */
  setTurn(seat: number) {
    this.stables.forEach((g, i) => g.classList.toggle('active', i === seat)); // whose turn: their starting stable glows
  }

  private drawHorse(seat: number, id: number): SVGGElement {
    const color = this.art.color(seat);
    const projection = svg('g', { class: 'projection' }, this.ground);
    this.projections[id] = projection;
    svg('ellipse', { cx: 5, cy: 3, rx: 17, ry: 6, fill: '#42345f', opacity: .36 }, projection);
    svg('ellipse', { rx: 13, ry: 5, fill: color, 'fill-opacity': .36, stroke: color, 'stroke-width': 1.6 }, projection);
    svg('ellipse', { rx: 8, ry: 3, fill: color }, projection);
    svg('ellipse', { rx: 18, ry: 9, stroke: color, class: 'pick-ring' }, projection);

    const g = svg('g', { class: 'horse', 'data-seat': seat }, this.horseLayer);
    g.style.setProperty('--spirit', color);
    const body = svg('g', { class: 'hbody' }, g);
    svg('ellipse', { cx: 0, cy: -24, rx: 24, ry: 27, class: 'bubble' }, body);
    const figure = svg('g', { class: 'figure' }, body);
    svg('g', { class: 'badges' }, g);
    svg('image', this.art.sprite, figure);
    figure.style.animationDelay = `${-(id % 5) * .43}s`;
    const target = svg('rect', { x: -19, y: -19, width: 38, height: 38, rx: 3, class: 'horse-target', role: 'button', 'aria-label': `Ngựa ${id % 4 + 1} của ${this.s.players[this.s.horses[id].owner].name}` }, this.hitLayer);
    this.targets[id] = target;
    const pick = () => { if (g.classList.contains('pickable')) this.onPick?.(id); };
    g.onclick = target.onclick = pick;
    target.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        pick();
      }
    };
    return g;
  }

  // ---------- animations ----------

  private async hop(id: number, to: number) {
    const g = this.horses[id];
    const [x, y] = this.xy(id, to);
    this.pos[id] = to;
    this.onHop?.();
    this.horseLayer.appendChild(g); // moving horse on top
    const body = g.querySelector('.hbody')!;
    await Promise.all([
      done(animate([g, this.projections[id]], { x, y, duration: TIMING.hop, ease: 'inOutSine' })),
      done(animate(body, {
        translateY: [{ to: -18, ease: 'outQuad' }, { to: 0, ease: 'inQuad' }],
        scaleY: [{ to: 1.12 }, { to: 0.82 }, { to: 1 }],
        scaleX: [{ to: 0.92 }, { to: 1.15 }, { to: 1 }],
        duration: TIMING.hop,
      })),
    ]);
    this.paintCells();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const ring = svg('ellipse', { cx: x, cy: y, rx: 5, ry: 2, fill: 'none', stroke: seatColor(seatOf(this.s, this.s.horses[id].owner)).main, 'stroke-width': 2 }, this.ground);
      animate(ring, { rx: 23, ry: 10, opacity: [1, 0], duration: 340, ease: 'outCubic', onComplete: () => ring.remove() });
    }
  }

  private async teleport(id: number, to: number) {
    const g = this.horses[id];
    const [fx, fy] = this.xy(id);
    burst(this.fx, fx, fy, ['#b28dff', '#ffffff', '#6ee7ff'], 12);
    await done(animate(g, { scale: 0, rotate: 540, duration: 280, ease: 'inBack' }));
    this.pos[id] = to;
    this.paintCells();
    const [x, y] = this.xy(id);
    utils.set([g, this.projections[id]], { x, y });
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
    utils.set([g, this.projections[id]], { x: sx, y: sy, rotate: 0 });
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
