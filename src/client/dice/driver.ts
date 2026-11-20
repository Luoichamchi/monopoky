// Runs the shared dice motion over time for one die on screen: shake while held, replay the throw, hop back home.
// A skin gives it the die element (input), where the die may roll, and a draw(pose) callback. Nothing here draws.
import type { Toss } from '../../core/types.ts';
import { holdToThrow } from './input.ts';
import { chargeOf, homePose, restPose, shakePose, tossPath, type Pose, type Table } from './motion.ts';

const SHOW_MS = 700; // the result stays where it landed this long, then the die goes home
const HOME_MS = 380;

export class DiceDriver {
  pose: Pose = restPose();
  ready = false;
  onRoll?: (toss: Toss) => void;
  private geometry: () => { table: Table; aim: number };
  private draw: (p: Pose, moving: boolean) => void;
  private fn?: (ms: number) => Pose;
  private t0 = 0;
  private end = Infinity; // ms after t0 when fn is done
  private raf = 0;
  private homeTimer?: ReturnType<typeof setTimeout>;
  private unlisten: () => void;

  constructor(el: HTMLElement, geometry: () => { table: Table; aim: number }, draw: (p: Pose, moving: boolean) => void) {
    this.geometry = geometry;
    this.draw = draw;
    this.unlisten = holdToThrow(el, {
      enabled: () => this.ready,
      aim: () => this.geometry().aim,
      hold: () => {
        const base = this.pose.q;
        this.run(ms => shakePose(ms / 1000, chargeOf(ms), base)); // keeps rattling until the throw comes back
      },
      cancel: () => this.goHome(),
      toss: t => {
        this.ready = false;
        this.onRoll?.(t);
      },
    });
  }

  get home() {
    return !this.fn && this.pose.x === 0 && this.pose.z === 0;
  }

  setReady(on: boolean) {
    this.ready = on;
    if (on && !this.home && !this.fn) this.goHome(); // next player: fetch the die from the board
  }

  /** Replay a throw that lands on `value`; resolves when it has stopped (after `duration` ms, even in a background tab). */
  roll(value: number, toss: Toss, duration: number) {
    clearTimeout(this.homeTimer);
    const { table, aim } = this.geometry();
    const path = tossPath(toss, value, table, aim, duration, this.pose);
    this.run(path, duration);
    return new Promise<void>(resolve =>
      setTimeout(() => {
        this.stop(path(duration));
        this.homeTimer = setTimeout(() => this.goHome(), SHOW_MS);
        resolve();
      }, duration),
    );
  }

  destroy() {
    this.unlisten();
    cancelAnimationFrame(this.raf);
    clearTimeout(this.homeTimer);
    this.fn = undefined;
  }

  private goHome() {
    clearTimeout(this.homeTimer);
    const from = this.pose;
    this.run(ms => homePose(from, ms / HOME_MS), HOME_MS, () => this.stop(restPose(homePose(from, 1).q)));
  }

  private run(fn: (ms: number) => Pose, duration = Infinity, done?: () => void) {
    this.fn = fn;
    this.t0 = performance.now();
    this.end = duration;
    cancelAnimationFrame(this.raf);
    const tick = (now: number) => {
      if (this.fn !== fn) return;
      const ms = now - this.t0;
      if (ms >= this.end) return done ? done() : undefined; // roll() finishes on its own timer
      this.pose = fn(ms);
      this.draw(this.pose, true);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stop(p: Pose) {
    this.fn = undefined;
    cancelAnimationFrame(this.raf);
    this.pose = p;
    this.draw(p, !this.home);
  }
}
