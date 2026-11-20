// Hold-and-fling input + table geometry shared by every dice skin. DOM only, no drawing.
import type { Toss } from '../../core/types.ts';
import { chargeOf, type Table } from './motion.ts';

/** Where the die may roll, in die units around its home (the dice slot): the board area plus home itself. */
export function tableFor(home: DOMRect, arena: DOMRect, unitPx: number): { table: Table; aim: number } {
  const [hx, hy] = [home.left + home.width / 2, home.top + home.height / 2];
  const m = 0.6; // keep the whole die inside
  const u = (v: number) => v / unitPx;
  return {
    table: {
      minX: Math.min(0, u(arena.left - hx) + m),
      maxX: Math.max(0, u(arena.right - hx) - m),
      minZ: Math.min(0, u(arena.top - hy) + m),
      maxZ: Math.max(0, u(arena.bottom - hy) - m),
    },
    aim: Math.atan2(arena.top + arena.height / 2 - hy, arena.left + arena.width / 2 - hx), // towards the board centre
  };
}

export interface HoldHandlers {
  enabled(): boolean;
  aim(): number; // screen direction towards the board
  hold(): void; // pressed: start shaking
  cancel(): void; // let go without throwing (pointer lost)
  toss(t: Toss): void;
}

/**
 * Press and hold to shake harder, let go to throw. Flicking while letting go throws in that direction,
 * a still release throws towards the board. Holding the Space key shakes the same way, releasing it throws.
 * Enter on the focused die throws at medium power. Returns a cleanup for the window key listeners.
 */
export function holdToThrow(el: HTMLElement, h: HoldHandlers) {
  let down = 0;
  let trail: [number, number, number][] = []; // recent pointer samples: x, y, time
  const seed = () => Math.floor(Math.random() * 2 ** 31);
  const rel = (a: number) => Math.atan2(Math.sin(a - h.aim()), Math.cos(a - h.aim())); // wrapped to [-π, π]

  el.addEventListener('pointerdown', e => {
    if (!h.enabled() || e.button !== 0) return;
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or already released pointer */ }
    down = performance.now();
    trail = [[e.clientX, e.clientY, down]];
    h.hold();
  });
  el.addEventListener('pointermove', e => {
    if (!down) return;
    trail.push([e.clientX, e.clientY, performance.now()]);
    if (trail.length > 12) trail.shift();
  });
  el.addEventListener('pointerup', e => {
    if (!down) return;
    const now = performance.now(), charge = chargeOf(now - down);
    down = 0;
    const old = trail.find(p => now - p[2] < 120) ?? trail[0];
    const [vx, vy] = [e.clientX - old[0], e.clientY - old[1]];
    const flick = Math.hypot(vx, vy) / Math.max(16, now - old[2]); // px per ms
    if (flick > 0.25) h.toss({ power: Math.min(1, 0.3 + flick * 0.25 + charge * 0.4), angle: rel(Math.atan2(vy, vx)), seed: seed() });
    else h.toss({ power: 0.15 + 0.85 * charge, angle: (Math.random() - 0.5) * 0.8, seed: seed() });
  });
  el.addEventListener('pointercancel', () => {
    if (down) (down = 0), h.cancel();
  });
  el.addEventListener('click', e => {
    if (e.detail === 0 && h.enabled()) h.toss({ power: 0.5, angle: (Math.random() - 0.5) * 0.8, seed: seed() }); // Enter
  });

  let key = 0; // when Space went down
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || (e.target as Element | null)?.closest?.('input, textarea, select')) return;
    if (e.type === 'keydown') {
      if (!key && !h.enabled()) return;
      e.preventDefault(); // no page scroll, no button click
      if (key || e.repeat) return;
      key = performance.now();
      h.hold();
    } else if (key) {
      e.preventDefault();
      const charge = chargeOf(performance.now() - key);
      key = 0;
      h.toss({ power: 0.15 + 0.85 * charge, angle: (Math.random() - 0.5) * 0.8, seed: seed() });
    }
  };
  const onBlur = () => key && ((key = 0), h.cancel()); // switched tab mid-shake
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  addEventListener('blur', onBlur);
  return () => {
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKey);
    removeEventListener('blur', onBlur);
  };
}
