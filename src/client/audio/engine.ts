// Shared Web Audio plumbing for music.ts and sfx.ts: one AudioContext, one bus per part, synth primitives.
export type Bus = 'music' | 'sfx';
const VOLUME: Record<Bus, number> = { music: 0.16, sfx: 0.55 };

let ctx: AudioContext | undefined;
const buses = {} as Record<Bus, GainNode>;
let noiseBuf: AudioBuffer | undefined;

export const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

function ac(): AudioContext | undefined {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return undefined; // no Web Audio: stay silent
  }
  const master = ctx.createDynamicsCompressor();
  master.connect(ctx.destination);
  for (const b of Object.keys(VOLUME) as Bus[]) {
    buses[b] = ctx.createGain();
    buses[b].gain.value = VOLUME[b];
    buses[b].connect(master);
  }
  return ctx;
}

/** Browsers only allow audio after a user gesture: call from pointer/key handlers. */
export function unlock() {
  const c = ac();
  if (c?.state === 'suspended') c.resume();
}

/** Output node of a part, or undefined when audio is unavailable. */
export const bus = (b: Bus): GainNode | undefined => (ac() ? buses[b] : undefined);
export const now = () => ctx?.currentTime ?? 0;

export interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  to?: number; // glide to this frequency
  at?: number; // delay in seconds
}

export function tone(out: AudioNode, freq: number, dur: number, o: ToneOpts = {}) {
  const c = ctx!;
  const t = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.15, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export interface NoiseOpts {
  vol?: number;
  at?: number;
  freq?: number;
  q?: number;
  filter?: BiquadFilterType;
}

export function noise(out: AudioNode, dur: number, o: NoiseOpts = {}) {
  const c = ctx!;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.value = o.freq ?? 2000;
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}
