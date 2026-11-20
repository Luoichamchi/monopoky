import type { Toss } from '../../core/types.ts';
import { TIMING } from '../../session.ts';
import { DiceDriver } from '../dice/driver.ts';
import { tableFor } from '../dice/input.ts';
import { REST, spinOf, topFace, type Pose } from '../dice/motion.ts';
import type { DiceRenderer } from './renderer.ts';

const FACES: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

/** 2D die: a CSS tile seen from above. Draws the shared motion as slide + lift + turn, showing whichever face is on top. */
export class DiceView implements DiceRenderer {
  readonly el: HTMLButtonElement;
  private pips: HTMLElement[];
  private driver: DiceDriver;

  constructor(host: HTMLElement, arena: () => DOMRect) {
    this.el = document.createElement('button');
    this.el.className = 'dice';
    this.el.setAttribute('aria-label', 'Đổ xúc xắc (nhấn giữ để lắc mạnh hơn, vuốt để quăng)');
    this.el.innerHTML = '<span></span>'.repeat(9);
    this.pips = [...this.el.querySelectorAll('span')];
    host.appendChild(this.el);
    this.driver = new DiceDriver(
      this.el,
      () => tableFor(host.getBoundingClientRect(), arena(), this.el.offsetWidth || 64),
      (p, moving) => this.draw(p, moving),
    );
    this.setReadyClass(false);
    this.show(6);
  }

  set onRoll(fn: ((toss: Toss) => void) | undefined) {
    this.driver.onRoll = fn;
  }

  show(v: number) {
    if (this.el.dataset.value === String(v)) return;
    this.pips.forEach((p, i) => p.classList.toggle('on', FACES[v]?.includes(i) ?? false));
    this.el.dataset.value = String(v);
  }

  setReady(on: boolean, color: string) {
    if (color) this.el.style.setProperty('--c', color);
    this.setReadyClass(on);
    this.driver.setReady(on);
  }

  async roll(v: number, color: string, toss: Toss) {
    this.el.style.setProperty('--c', color);
    this.setReadyClass(false);
    await this.driver.roll(v, toss, TIMING.roll);
    this.show(v);
  }

  destroy() {
    this.driver.destroy();
    this.el.remove();
  }

  private setReadyClass(on: boolean) {
    this.el.classList.toggle('ready', on);
    this.el.disabled = !on;
  }

  private draw(p: Pose, moving: boolean) {
    this.el.classList.toggle('moving', moving);
    if (!moving) return void (this.el.style.transform = '');
    const px = this.el.offsetWidth || 64, lift = p.y - REST;
    const { value, flat } = topFace(p.q);
    this.show(value);
    const turn = ((((spinOf(p.q) * 180) / Math.PI + 45) % 90) + 90) % 90 - 45; // a square looks the same every 90°
    this.el.style.transform =
      `translate(${p.x * px}px, ${(p.z - lift * 0.7) * px}px) rotate(${turn}deg) scale(${1 + lift * 0.2}, ${(1 + lift * 0.2) * (0.7 + 0.3 * flat)})`;
  }
}
