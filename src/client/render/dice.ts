import { TIMING } from '../../session.ts';
import { animate, done } from './fx.ts';
import type { DiceRenderer } from './renderer.ts';

const FACES: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export class DiceView implements DiceRenderer {
  readonly el: HTMLButtonElement;
  onRoll?: () => void;
  private pips: HTMLElement[];

  constructor(host: HTMLElement) {
    this.el = document.createElement('button');
    this.el.className = 'dice';
    this.el.setAttribute('aria-label', 'Đổ xúc xắc');
    this.el.innerHTML = '<span></span>'.repeat(9);
    this.pips = [...this.el.querySelectorAll('span')];
    this.el.onclick = () => this.onRoll?.();
    this.ready = false;
    host.appendChild(this.el);
    this.show(6);
  }

  show(v: number) {
    this.pips.forEach((p, i) => p.classList.toggle('on', FACES[v]?.includes(i) ?? false));
    this.el.dataset.value = String(v);
  }

  private setColor(c: string) {
    this.el.style.setProperty('--c', c);
  }

  setReady(on: boolean, color: string) {
    if (color) this.setColor(color);
    this.ready = on;
  }

  destroy() {
    this.el.remove();
  }

  private set ready(on: boolean) {
    this.el.classList.toggle('ready', on);
    this.el.disabled = !on;
  }

  async roll(v: number, color: string) {
    this.setColor(color);
    this.ready = false;
    // The result is already decided by the rules; this only has to *look* like a die slowing down.
    // Faces change ever more slowly and the last change is the real value, just before the spin stops,
    // so the die settles on it instead of jumping to it afterwards.
    const dur = TIMING.roll - 150;
    const settle = dur - 110;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let face = Number(this.el.dataset.value);
    for (let t = 40, gap = 40; t < settle - 30; gap *= 1.22, t += gap) {
      const f = (face = 1 + ((face + Math.floor(Math.random() * 5)) % 6)); // always a different face
      timers.push(setTimeout(() => this.show(f), t));
    }
    timers.push(setTimeout(() => this.show(v), settle));
    await done(
      animate(this.el, {
        rotate: { from: 0, to: 720 },
        translateY: [{ to: -40, ease: 'outQuad' }, { to: 0, ease: 'outBounce' }],
        scale: [{ to: 1.25 }, { to: 1 }],
        duration: dur,
        ease: 'outCubic',
      }),
    );
    timers.forEach(clearTimeout);
    this.show(v); // in case timers ran late (busy tab)
    await done(animate(this.el, { scale: [1.15, 1], duration: 150, ease: 'outBack(3)' }));
  }
}
