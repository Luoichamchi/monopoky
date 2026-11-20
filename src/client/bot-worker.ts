// Web Worker: runs the expert bot's search for src/client/bots.ts, off the thread that draws the game.
import { chooseAction } from '../ai/bots.ts';

self.onmessage = ({ data: { id, s, level } }) => {
  try {
    self.postMessage({ id, action: chooseAction(s, level) });
  } catch (e) {
    self.postMessage({ id, error: String(e) });
  }
};
