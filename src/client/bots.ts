// Bot moves for offline games. The expert's search takes up to 0.5 s: in a Web Worker so smoke and dice keep moving.
// Faster levels (< 3 ms) stay inline. If the worker can't start or breaks, the session thinks inline instead.
import { chooseAction } from '../ai/bots.ts';
import type { Action } from '../core/types.ts';
import type { Think } from '../session.ts';

type Job = { resolve: (a: Action) => void; reject: (e: unknown) => void };
let worker: Worker | undefined;
const jobs = new Map<number, Job>();
let seq = 0;

function start() {
  const w = new Worker(new URL('./bot-worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = ({ data: { id, action, error } }) => {
    const job = jobs.get(id);
    jobs.delete(id);
    if (error) job?.reject(new Error(error));
    else job?.resolve(action);
  };
  w.onerror = e => {
    worker = undefined; // a fresh one on the next expert move
    w.terminate();
    jobs.forEach(j => j.reject(e));
    jobs.clear();
  };
  return w;
}

export const think: Think = (s, level) => {
  if (level !== 'expert') return chooseAction(s, level);
  const w = (worker ??= start());
  const id = ++seq;
  return new Promise<Action>((resolve, reject) => {
    jobs.set(id, { resolve, reject });
    w.postMessage({ id, s, level });
  });
};
