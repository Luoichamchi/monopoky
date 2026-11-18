// Anime-style effects built on anime.js. All functions return promises so the event player can sequence them.
import { animate, createTimeline, stagger, utils } from 'animejs';
import { THEME } from './theme.ts';

const NS = 'http://www.w3.org/2000/svg';
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Record<string, string | number> = {}, parent?: Element, text?: string,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

const done = (a: { then: (cb: () => void) => unknown }) => new Promise<void>(r => a.then(() => r()));
const remove = (e: Element) => () => e.remove();

/** Particles flying out of a point (stars + dots). */
export function burst(layer: SVGGElement, x: number, y: number, colors: string[], n = 14) {
  const parts = Array.from({ length: n }, (_, i) =>
    i % 3 === 0
      ? svg('text', { x, y, 'font-size': 14, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: colors[i % colors.length] }, layer, '★')
      : svg('circle', { cx: x, cy: y, r: utils.random(2, 5), fill: colors[i % colors.length], stroke: THEME.ink, 'stroke-width': 1 }, layer),
  );
  return done(
    animate(parts, {
      translateX: () => utils.random(-70, 70),
      translateY: () => utils.random(-70, 50),
      scale: [{ to: 1.4, duration: 150 }, { to: 0, duration: 500 }],
      rotate: () => utils.random(-180, 180),
      duration: 650,
      ease: 'outExpo',
      delay: stagger(12),
      onComplete: () => parts.forEach(p => p.remove()),
    }),
  );
}

/** Manga sound-effect text ("BAM!") popping out. */
export function sfxText(layer: SVGGElement, x: number, y: number, text: string, color: string) {
  const g = svg('g', { transform: `translate(${x} ${y - 24})` }, layer);
  const t = svg('text', { class: 'sfx', fill: color, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g, text);
  utils.set(t, { scale: 0, rotate: utils.random(-18, 18) });
  return done(
    createTimeline({ onComplete: remove(g) })
      .add(t, { scale: 1.25, duration: 260, ease: 'outBack(3)' })
      .add(t, { scale: 1, duration: 120 })
      .add(t, { translateY: -26, opacity: 0, duration: 300, ease: 'inQuad' }, '+=150'),
  );
}

/** Radial speed lines + expanding ring. */
export function impact(layer: SVGGElement, x: number, y: number, color: string) {
  const g = svg('g', { transform: `translate(${x} ${y})` }, layer);
  const ring = svg('circle', { r: 6, fill: 'none', stroke: color, 'stroke-width': 6 }, g);
  const lines = Array.from({ length: 12 }, (_, i) =>
    svg('line', { x1: 18, y1: 0, x2: 46, y2: 0, stroke: THEME.ink, 'stroke-width': 3, 'stroke-linecap': 'round', transform: `rotate(${i * 30})` }, g),
  );
  animate(ring, { r: 55, 'stroke-width': 0, opacity: [1, 0], duration: 500, ease: 'outCubic' });
  return done(
    animate(lines, {
      opacity: [{ to: 1, duration: 60 }, { to: 0, duration: 340 }],
      duration: 400,
      ease: 'outQuad',
      onComplete: remove(g),
    }),
  );
}

/** Icon pops above a square (tiles, cards). */
export function iconPop(layer: SVGGElement, x: number, y: number, icon: string, glow: string) {
  const g = svg('g', { transform: `translate(${x} ${y})` }, layer);
  const halo = svg('circle', { r: 22, fill: glow, opacity: 0.85, stroke: THEME.ink, 'stroke-width': 3 }, g);
  const t = svg('text', { 'font-size': 26, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g, icon);
  utils.set([halo, t], { scale: 0 });
  return done(
    createTimeline({ onComplete: remove(g) })
      .add([halo, t], { scale: 1.3, translateY: -34, duration: 300, ease: 'outBack(2.5)' })
      .add([halo, t], { scale: 0, opacity: 0, duration: 220, ease: 'inBack' }, '+=180'),
  );
}

export function explosion(layer: SVGGElement, x: number, y: number) {
  const g = svg('g', { transform: `translate(${x} ${y})` }, layer);
  // drawn largest first so the hot core stays on top
  const rings = ['#ff5f3d', '#ffb347', '#fff2a8'].map(fill => svg('circle', { r: 4, fill }, g));
  return Promise.all(
    rings.map((ring, i) =>
      done(animate(ring, { r: 95 - i * 25, opacity: [{ to: 1, duration: 100 }, { to: 0, duration: 450 }], duration: 550, delay: i * 40, ease: 'outExpo' })),
    ),
  ).then(remove(g));
}

export function shake(el: Element, power = 8) {
  return done(animate(el, { x: [0, -power, power, -power / 2, power / 2, 0], duration: 360, ease: 'linear' }));
}

/** Full-screen confetti (HTML layer). */
export function confetti(host: HTMLElement, colors: string[]) {
  const pieces = Array.from({ length: 90 }, (_, i) => {
    const d = document.createElement('i');
    d.className = 'confetti';
    d.style.background = colors[i % colors.length];
    d.style.left = `${utils.random(0, 100)}%`;
    host.appendChild(d);
    return d;
  });
  utils.set(pieces, { y: () => utils.random(-260, -40) });
  return done(
    animate(pieces, {
      y: window.innerHeight + 60,
      x: () => utils.random(-120, 120),
      rotate: () => utils.random(-720, 720),
      duration: () => utils.random(1800, 3200),
      delay: stagger(15),
      ease: 'inQuad',
      onComplete: () => pieces.forEach(p => p.remove()),
    }),
  );
}

/** Anime "cut-in" banner sliding across the screen. */
export function cutIn(host: HTMLElement, text: string, color: string) {
  const b = document.createElement('div');
  b.className = 'cutin';
  b.style.setProperty('--c', color);
  b.innerHTML = `<span>${text}</span>`;
  host.appendChild(b);
  const span = b.firstElementChild!;
  return done(
    createTimeline({ onComplete: remove(b) })
      .add(b, { scaleY: [0, 1], opacity: [0, 1], duration: 180, ease: 'outQuad' })
      .add(span, { x: ['-60vw', '0vw'], duration: 320, ease: 'outBack(1.2)' }, 0)
      .add(span, { x: '60vw', duration: 260, ease: 'inQuad' }, '+=380')
      .add(b, { scaleY: 0, opacity: 0, duration: 160 }, '-=120'),
  );
}

export { animate, createTimeline, done, stagger, utils };
