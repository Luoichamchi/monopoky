// Background music: a bright I–V–vi–IV chiptune loop. Swap `schedule` for a recorded track later.
import { save, store } from '../ui/dom.ts';
import { bus, midi, noise, now, tone } from './engine.ts';

const BPM = 138;
const CHORDS = [[60, 64, 67, 72], [59, 62, 67, 71], [57, 60, 64, 69], [57, 60, 65, 69]]; // C G Am F
const ROOTS = [36, 43, 45, 41];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];

let enabled = store('ccn.music', true);
let playing = false;
let timer: ReturnType<typeof setInterval> | undefined;
let nextAt = 0;
let stepN = 0;

function schedule() {
  const out = bus('music');
  if (!out) return;
  const stepDur = 60 / BPM / 2; // eighth notes
  // background tabs throttle timers: skip missed notes instead of playing them all at once
  if (nextAt < now()) nextAt = now() + 0.05;
  while (nextAt < now() + 0.2) {
    const bar = Math.floor(stepN / 8) % 4;
    const s = stepN % 8;
    const at = nextAt - now();
    if (s % 2 === 0) tone(out, midi(ROOTS[bar] + (s === 4 ? 12 : 0)), stepDur * 1.6, { type: 'triangle', vol: 0.5, at });
    tone(out, midi(CHORDS[bar][ARP[s]] + 12), stepDur * 0.9, { type: 'square', vol: 0.09, at });
    if (s % 2 === 1) noise(out, 0.04, { freq: 8000, filter: 'highpass', vol: 0.12, at });
    if (s === 0 || s === 4) noise(out, 0.12, { freq: 120, filter: 'lowpass', vol: 0.6, at }); // soft kick drum
    nextAt += stepDur;
    stepN++;
  }
}

function sync() {
  clearInterval(timer);
  timer = undefined;
  if (playing && enabled && bus('music')) {
    nextAt = now() + 0.1;
    timer = setInterval(schedule, 50); // look-ahead scheduler
  }
}

export const music = {
  get enabled() {
    return enabled;
  },
  /** User preference (persisted). */
  setEnabled(on: boolean) {
    save('ccn.music', (enabled = on));
    sync();
  },
  /** Screen wants music (game screen) or not (menu, game over). */
  play(on: boolean) {
    playing = on;
    sync();
  },
};
