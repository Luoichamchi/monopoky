import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame, isLegal } from '../src/core/engine.ts';
import { think } from '../src/server/bots.ts';
import { GameSession, type Update } from '../src/session.ts';

test('expert bot thinks on a worker thread: legal move, event loop stays free', async () => {
  const s = createGame('party', [0, 1, 2, 3].map(seat => ({ name: `P${seat}`, seat })), Math.random);
  s.phase = 'move';
  s.dice = 6;
  let worst = 0, last = performance.now();
  const tick = setInterval(() => ((worst = Math.max(worst, performance.now() - last)), (last = performance.now())), 5);
  const moves = await Promise.all([1, 2, 3].map(() => think(structuredClone(s), 'expert')));
  clearInterval(tick);
  for (const a of moves) assert.ok(isLegal(s, a), JSON.stringify(a));
  assert.ok(worst < 100, `event loop blocked ${worst.toFixed(0)}ms`);
});

test('a bot answer that arrives after stop() is dropped', async () => {
  let updates = 0;
  let release!: () => void;
  const slow = () => new Promise<never>((_, reject) => (release = () => reject(new Error('late'))));
  const g = new GameSession('classic', [{ name: 'A', seat: 0, bot: 'easy' }, { name: 'B', seat: 2, bot: 'easy' }], (_: Update) => updates++, Math.random, slow);
  g.start(); // update #1, bot scheduled
  await new Promise(r => setTimeout(r, 600)); // bot timer fired, waiting on `slow`
  g.stop();
  release(); // falls back to inline thinking, but the session was stopped: nothing applied
  await new Promise(r => setTimeout(r, 50));
  assert.equal(updates, 1);
});
