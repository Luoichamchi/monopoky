// Bot moves for the server. The expert's Monte-Carlo search burns up to 0.5 s of CPU per move: it runs on worker
// threads so one room thinking never freezes every other room. Faster levels (< 3 ms) stay inline: cheaper than a round trip.
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { chooseAction } from '../ai/bots.ts';
import type { Action, BotLevel, GameState } from '../core/types.ts';
import type { Think } from '../session.ts';

interface Slot {
  worker: Worker;
  jobs: Map<number, { resolve: (a: Action) => void; reject: (e: unknown) => void }>;
}

const SIZE = Math.max(1, Math.min(4, availableParallelism() - 1)); // leave a core for sockets
const slots: Slot[] = [];
let seq = 0;

function spawn(): Slot {
  const slot: Slot = { worker: new Worker(new URL('./bot-worker.ts', import.meta.url)), jobs: new Map() };
  slot.worker.on('message', ({ id, action, error }) => {
    const job = slot.jobs.get(id);
    slot.jobs.delete(id);
    if (!slot.jobs.size) slot.worker.unref(); // idle: don't hold the process open
    if (error) job?.reject(new Error(error));
    else job?.resolve(action);
  });
  const fail = (e: unknown) => {
    const i = slots.indexOf(slot);
    if (i < 0) return; // already dropped
    slots.splice(i, 1); // replaced on the next expert move, never while the process is shutting down
    slot.jobs.forEach(j => j.reject(e)); // the session falls back to thinking inline
  };
  slot.worker.on('error', fail);
  slot.worker.on('exit', code => fail(new Error(`bot worker exited (${code})`)));
  slot.worker.unref(); // idle until a job comes (after the listeners: adding one refs the worker again)
  return slot;
}

export const think: Think = (s: GameState, level: BotLevel) => {
  if (level !== 'expert') return chooseAction(s, level);
  while (slots.length < SIZE) slots.push(spawn()); // started on the first expert move
  const slot = slots.reduce((a, b) => (b.jobs.size < a.jobs.size ? b : a)); // least busy
  const id = ++seq;
  return new Promise<Action>((resolve, reject) => {
    slot.jobs.set(id, { resolve, reject });
    slot.worker.ref(); // busy: keep the process alive until the answer is back
    slot.worker.postMessage({ id, s, level });
  });
};
