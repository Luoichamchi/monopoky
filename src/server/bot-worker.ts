// Worker thread: runs one bot search at a time for src/server/bots.ts.
import { parentPort } from 'node:worker_threads';
import { chooseAction } from '../ai/bots.ts';

parentPort!.on('message', ({ id, s, level }) => {
  try {
    parentPort!.postMessage({ id, action: chooseAction(s, level) });
  } catch (e) {
    parentPort!.postMessage({ id, error: String(e) });
  }
});
