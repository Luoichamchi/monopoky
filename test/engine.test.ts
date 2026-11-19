import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseAction } from '../src/ai/bots.ts';
import { GATE, STABLE, absOf, cloneState } from '../src/core/board.ts';
import { applyRoll, createGame, legalActions, step, target } from '../src/core/engine.ts';
import type { Ctx, GameState } from '../src/core/types.ts';

export function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const two = (variant = 'classic') =>
  createGame(variant, [{ name: 'A', seat: 0 }, { name: 'B', seat: 2 }], seeded(1));
const ctx = (s: GameState): Ctx => ({ rng: seeded(2), ev: [], roll: v => applyRoll(s, v, ctx(s)) });

test('exit needs 6, otherwise auto-pass to next player', () => {
  const s = two();
  applyRoll(s, 3, ctx(s));
  assert.equal(s.turn, 1);
  applyRoll(s, 6, ctx(s));
  assert.deepEqual(legalActions(s).map(a => a.type), ['move', 'move', 'move', 'move']);
});

test('no jumping, exact landing kicks, gate exactness, home climbing', () => {
  const s = two();
  const [a, b] = [s.horses[0], s.horses[4]];
  a.pos = 10;
  b.pos = (absOf(0, 13) - absOf(2, 0) + 52) % 52; // B horse 3 squares ahead of A
  assert.equal(target(s, a, 4), null, 'cannot jump over');
  assert.equal(target(s, a, 3), 13, 'can land to kick');
  s.dice = 3; s.phase = 'move';
  step(s, { type: 'move', horse: 0 }, seeded(3));
  assert.equal(b.pos, STABLE);
  a.pos = GATE - 2;
  assert.equal(target(s, a, 3), null, 'must stop exactly on gate');
  a.pos = GATE;
  assert.equal(target(s, a, 4), GATE + 4);
  a.pos = GATE + 4;
  assert.equal(target(s, a, 5), GATE + 5);
  assert.equal(target(s, a, 6), null);
});

test('win when 4 horses on home steps 3..6', () => {
  const s = two();
  [56, 55, 54].forEach((p, i) => (s.horses[i].pos = p));
  s.horses[3].pos = GATE;
  s.dice = 3; s.phase = 'move';
  const ev = step(s, { type: 'move', horse: 3 }, seeded(1));
  assert.equal(s.winner, 0);
  assert.equal(ev.at(-1)?.t, 'win');
});

test('party: tiles are symmetric, shield blocks kicks', () => {
  const s = two('party');
  const kinds = Object.entries(s.tiles);
  assert.equal(kinds.length, 24);
  for (const [abs, k] of kinds) assert.equal(s.tiles[(+abs + 13) % 52], k);
  const [a, b] = [s.horses[0], s.horses[4]];
  a.pos = 0;
  b.pos = (absOf(0, 2) - absOf(2, 0) + 52) % 52;
  b.shield = 2;
  assert.equal(target(s, a, 2), null);
});

test('party: freeze card locks one horse for its owner\'s next turn, not the whole turn', () => {
  const s = two('party');
  s.tiles = {}; // no tile side effects
  const [a, b1, b2] = [s.horses[0], s.horses[4], s.horses[5]];
  a.pos = 20; b1.pos = 10; b2.pos = 30;
  s.players[0].cards = ['freeze'];
  step(s, { type: 'card', card: 'freeze', target: b1.id }, seeded(1));
  assert.equal(b1.frozen, 2);
  s.dice = 1; s.phase = 'move';
  step(s, { type: 'move', horse: a.id }, seeded(1)); // A ends turn → B's turn
  assert.equal(s.turn, 1, 'B still gets a turn');
  s.dice = 1; s.phase = 'move';
  const moves = legalActions(s).filter(x => x.type === 'move').map(x => (x as { horse: number }).horse);
  assert.ok(!moves.includes(b1.id), 'frozen horse cannot move');
  assert.ok(moves.includes(b2.id), 'other horses can');
  step(s, { type: 'move', horse: b2.id }, seeded(1)); // B → A
  s.dice = 1; s.phase = 'move';
  step(s, { type: 'move', horse: a.id }, seeded(1)); // A → B: thawed
  assert.equal(b1.frozen, 0);
});

test('party: bomb kicks enemies within 2 squares, the horse that stops on it is safe', () => {
  const s = two('party');
  const bomb = 20;
  s.tiles = { [bomb]: 'bomb' };
  const rel = (seat: number, abs: number) => (abs - absOf(seat, 0) + 52) % 52;
  const [a, b1, b2, b3] = [s.horses[0], s.horses[4], s.horses[5], s.horses[6]];
  a.pos = rel(0, bomb) - 3;
  b1.pos = rel(2, bomb + 1); b2.pos = rel(2, bomb + 2); b3.pos = rel(2, bomb + 3);
  s.dice = 3; s.phase = 'move';
  step(s, { type: 'move', horse: a.id }, seeded(1));
  assert.equal(a.pos, rel(0, bomb), 'trigger horse stays on the bomb');
  assert.equal(b1.pos, STABLE);
  assert.equal(b2.pos, STABLE);
  assert.notEqual(b3.pos, STABLE, '3 squares away is out of range');
});

for (const variant of ['classic', 'party'])
  test(`${variant}: full random 4p games finish without errors`, () => {
    for (let g = 0; g < 20; g++) {
      const rng = seeded(g + 10);
      const s = createGame(variant, [0, 1, 2, 3].map(seat => ({ name: `P${seat}`, seat })), rng);
      let n = 0;
      while (s.phase !== 'over' && n++ < 20000) step(s, chooseAction(cloneState(s), n % 2 ? 'normal' : 'easy', { rng }), rng);
      assert.equal(s.phase, 'over', 'game should end');
      for (const h of s.horses) assert.ok(h.pos >= STABLE && h.pos <= GATE + 6);
    }
  });
