// Sound effects: dice, horse steps, kicks, special tiles, cards, UI. One short synth recipe per name.
import { save, store } from '../ui/dom.ts';
import { bus, midi, noise, tone, type NoiseOpts, type ToneOpts } from './engine.ts';

export type Sfx =
  | 'click' | 'shake' | 'roll' | 'land' | 'hop' | 'exit' | 'kick' | 'pass' | 'turn' | 'win' | 'card' | 'gain'
  // special tiles (same names as the tile kinds in core/variants/party/tiles.ts)
  | 'boost' | 'trap' | 'portal' | 'gift' | 'shield' | 'ice' | 'bomb';

const PENTA = [72, 74, 76, 79, 81, 84, 86, 88]; // C major pentatonic: each hop one note higher
let hopN = 0;
let enabled = store('ccn.sfx', true);

let out: AudioNode;
const T = (freq: number, dur: number, o?: ToneOpts) => tone(out, freq, dur, o);
const N = (dur: number, o?: NoiseOpts) => noise(out, dur, o);
const arp = (notes: number[], gap: number, o: ToneOpts, dur = 0.18) =>
  notes.forEach((n, i) => T(midi(n), dur, { ...o, at: (o.at ?? 0) + i * gap }));

const RECIPES: Record<Sfx, () => void> = {
  // ---- moves & game flow ----
  click: () => T(1100, 0.05, { type: 'triangle', vol: 0.1 }),
  shake: () => { // dice knocking together in a closed hand: two quick clicks, a bit muffled
    for (let i = 0; i < 2; i++) N(0.025, { at: i * 0.03 + Math.random() * 0.012, freq: 1400 + Math.random() * 1600, q: 5, vol: 0.28 });
  },
  roll: () => {
    for (let i = 0; i < 8; i++) N(0.035, { at: i * 0.065 + Math.random() * 0.02, freq: 1800 + Math.random() * 1800, q: 4, vol: 0.35 });
  },
  land: () => arp([67, 79], 0.06, { type: 'triangle', vol: 0.18 }, 0.12),
  hop: () => {
    const n = PENTA[hopN++ % PENTA.length];
    T(midi(n), 0.08, { vol: 0.06 });
    T(midi(n + 12), 0.06, { type: 'sine', vol: 0.05 });
  },
  exit: () => T(300, 0.22, { to: 1200, vol: 0.1 }),
  kick: () => {
    N(0.3, { freq: 500, filter: 'lowpass', vol: 0.9 });
    T(320, 0.35, { type: 'sawtooth', to: 45, vol: 0.2 });
    T(1400, 0.1, { to: 500, vol: 0.08, at: 0.02 });
  },
  pass: () => T(220, 0.3, { type: 'triangle', to: 110, vol: 0.18 }),
  turn: () => arp([79, 86], 0.1, { type: 'triangle', vol: 0.18 }, 0.2),
  win: () => {
    arp([72, 76, 79, 84, 79, 84], 0.12, { vol: 0.1 }, 0.16);
    [84, 88, 91].forEach(n => T(midi(n), 0.9, { type: 'triangle', vol: 0.12, at: 0.75 }));
  },
  card: () => {
    N(0.18, { freq: 3500, q: 2, vol: 0.3 });
    T(midi(84), 0.15, { type: 'triangle', vol: 0.14, at: 0.1 });
  },
  gain: () => arp([84, 88, 91, 96], 0.06, { type: 'triangle', vol: 0.12 }),

  // ---- special tiles ----
  boost: () => T(380, 0.3, { type: 'sawtooth', to: 1700, vol: 0.08 }),
  trap: () => {
    T(520, 0.4, { type: 'triangle', to: 110, vol: 0.18 });
    N(0.3, { freq: 300, filter: 'lowpass', vol: 0.3, at: 0.1 });
  },
  portal: () => {
    T(180, 0.55, { type: 'sine', to: 1400, vol: 0.18 });
    T(270, 0.55, { type: 'triangle', to: 2000, vol: 0.07, at: 0.06 });
  },
  gift: () => arp([79, 84, 88, 91, 96], 0.05, { type: 'triangle', vol: 0.12 }),
  shield: () => arp([76, 83], 0.1, { type: 'triangle', vol: 0.15 }, 0.3),
  ice: () => {
    arp([96, 93, 91, 88], 0.07, { type: 'sine', vol: 0.1 }, 0.2);
    N(0.35, { freq: 9000, filter: 'highpass', vol: 0.12 });
  },
  bomb: () => {
    N(0.9, { freq: 350, filter: 'lowpass', vol: 1 });
    T(140, 0.8, { type: 'sawtooth', to: 30, vol: 0.28 });
  },
};

export const sfx = {
  get enabled() {
    return enabled;
  },
  setEnabled(on: boolean) {
    save('ccn.sfx', (enabled = on));
  },
  play(name: Sfx) {
    const b = enabled && bus('sfx');
    if (!b || !RECIPES[name]) return;
    out = b;
    RECIPES[name]();
  },
  /** Restart the rising hop melody at the start of each move. */
  resetHop() {
    hopN = 0;
  },
};
