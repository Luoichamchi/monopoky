import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REST, qAxis, seeded, shakePose, tossPath, topFace, type Table } from '../src/client/dice/motion.ts';
import { sanitizeAction } from '../src/session.ts';
import { createGame, step } from '../src/core/engine.ts';

const table: Table = { minX: -9, maxX: 1, minZ: -6, maxZ: 3 };
const T = 1400;

test('every throw lands flat on the value the rules chose, inside the table', () => {
  for (let seed = 1; seed < 60; seed++)
    for (let value = 1; value <= 6; value++) {
      const power = (seed % 7) / 6;
      const pose = tossPath({ power, angle: (seed % 5) - 2, seed }, value, table, Math.PI, T, shakePose(seed / 10, power, qAxis([1, 2, 3], seed)));
      const end = pose(T);
      assert.equal(topFace(end.q).value, value);
      assert.ok(topFace(end.q).flat > 0.999, 'lies flat');
      assert.equal(end.y, REST);
      for (let ms = 0; ms <= T; ms += 20) {
        const p = pose(ms);
        assert.ok(p.x >= table.minX - 1e-9 && p.x <= table.maxX + 1e-9 && p.z >= table.minZ - 1e-9 && p.z <= table.maxZ + 1e-9);
        assert.ok(p.y >= REST - 1e-9);
      }
    }
});

test('the throw starts where the hand let go and slows down until it stops', () => {
  const start = shakePose(0.8, 1);
  const pose = tossPath({ power: 1, angle: 0, seed: 7 }, 4, { minX: -40, maxX: 40, minZ: -40, maxZ: 40 }, 0, T, start);
  pose(0).q.forEach((v, i) => assert.ok(Math.abs(v - start.q[i]) < 1e-9));
  for (const k of ['x', 'y', 'z'] as const) assert.ok(Math.abs(pose(0)[k] - start[k]) < 1e-9, k);
  const speed = (ms: number) => Math.hypot(pose(ms + 10).x - pose(ms).x, pose(ms + 10).z - pose(ms).z);
  for (let ms = 0; ms < T * 0.8; ms += 100) assert.ok(speed(ms + 100) <= speed(ms) + 1e-9, `slower at ${ms + 100}ms`);
  assert.equal(speed(T - 10), 0);
});

test('roll carries a throw: the player\'s (sanitized) or a random one for bots', () => {
  assert.deepEqual(sanitizeAction({ type: 'roll', toss: { power: 9, angle: -10, seed: 3.7 } }), { type: 'roll', toss: { power: 1, angle: -Math.PI, seed: 3 } });
  assert.deepEqual(sanitizeAction({ type: 'roll', toss: { power: 'x' } }), { type: 'roll' });
  const s = createGame('classic', [{ name: 'A', seat: 0 }, { name: 'B', seat: 2 }], seeded(1));
  const toss = { power: 0.5, angle: 0.2, seed: 42 };
  const ev = step(s, { type: 'roll', toss }, seeded(5));
  assert.deepEqual(ev[0].t === 'roll' && ev[0].toss, toss);
  const s2 = createGame('classic', [{ name: 'A', seat: 0 }, { name: 'B', seat: 2 }], seeded(1));
  const ev2 = step(s2, { type: 'roll' }, seeded(5));
  assert.ok(ev2[0].t === 'roll' && ev2[0].toss.power >= 0.35 && ev2[0].toss.power <= 0.75);
});
