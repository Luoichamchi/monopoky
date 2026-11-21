// Duel mode rules (docs/rulebook.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GATE, STABLE, absOf } from '../src/core/board.ts';
import { createGame, isLegal, legalActions, step } from '../src/core/engine.ts';
import type { Action, GameState, Pick } from '../src/core/types.ts';
import { viewEvents, viewState } from '../src/core/view.ts';

function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Two players (seats 0 and 2) after an automatic draft, player 0 to move with die `dice` and the given hand. */
function ready(dice: number, hand: string[], hand1: string[] = []): GameState {
  const rng = seeded(7);
  const s = createGame('duel', [{ name: 'A', seat: 0 }, { name: 'B', seat: 2 }], rng);
  while (s.phase === 'draft') step(s, { type: 'pick', card: '' }, rng);
  s.players[0].cards = [...hand];
  s.players[1].cards = [...hand1];
  s.phase = 'move';
  s.dice = dice;
  s.turn = 0;
  return s;
}
const play = (...picks: Pick[]): Action => ({ type: 'play', picks });
const put = (s: GameState, id: number, pos: number) => (s.horses[id].pos = pos);
const rng = seeded(3);

test('draft: snake order, 12 cards each, then 4 in hand (+1 for the first turn)', () => {
  const s = createGame('duel', [{ name: 'A', seat: 0 }, { name: 'B', seat: 2 }], rng);
  assert.equal(s.phase, 'draft');
  assert.deepEqual(s.duel!.order.slice(0, 4), [0, 1, 1, 0]);
  while (s.phase === 'draft') step(s, { type: 'pick', card: '' }, rng);
  assert.equal(s.phase, 'roll');
  assert.deepEqual(s.duel!.lists.map(l => l.length), [12, 12]);
  assert.deepEqual(s.players.map(p => p.cards.length), [5, 4]);
});

test('a single card needs its own face; a combo of N cards needs face N', () => {
  const s = ready(1, ['tichluc', 'daykeo', 'tichluc', 'tichluc']);
  put(s, 0, 5);
  put(s, 4, 30);
  assert.ok(isLegal(s, play({ card: 'tichluc', t: [0] })));
  assert.ok(!isLegal(s, play({ card: 'daykeo', t: [4] })), 'Dây Kéo is a 3');
  s.dice = 3;
  assert.ok(isLegal(s, play({ card: 'daykeo', t: [4] })));
  const three = play(...[0, 1, 2].map(() => ({ card: 'tichluc', t: [0] })));
  assert.ok(isLegal(s, three), '3 cards on a 3');
  s.dice = 2;
  assert.ok(!isLegal(s, three));
  s.dice = 3;
  step(s, three, rng);
  assert.equal(s.horses[0].pos, 5 + 6, 'Tích Lực ×3 = 6 squares');
  assert.ok(!legalActions(s).some(a => a.type === 'play'), 'one play per turn');
});

test('high cards combo on low faces: 2 × Hộ Thuẫn (4) on a 2', () => {
  const s = ready(2, ['hothuan', 'hothuan']);
  put(s, 0, 5);
  step(s, play({ card: 'hothuan', t: [0] }, { card: 'hothuan', t: [0] }), rng);
  assert.equal(s.horses[0].fx?.guard, 2);
});

test('Mở Rộng doubles the reach of the plain card it joins', () => {
  const s = ready(2, ['hoandoi', 'morong']);
  put(s, 0, 5); // abs 6
  put(s, 4, 10); // seat 2: abs 37 → 21 squares away
  s.horses[4].pos = (absOf(0, 5) + 18 - absOf(2, 0) + 52) % 52; // 18 squares ahead of horse 0
  assert.ok(!isLegal(s, play({ card: 'morong', t: [] }, { card: 'morong', t: [] })), 'nothing to multiply');
  s.dice = 2;
  const swap = play({ card: 'hoandoi', t: [0, 4] }, { card: 'morong', t: [] });
  assert.ok(isLegal(s, swap), 'reach 20');
  s.players[0].cards = ['hoandoi'];
  assert.ok(!isLegal(s, play({ card: 'hoandoi', t: [0, 4] })), 'alone: reach 10');
});

test('controls are paid with horse turns: frozen horse can only endure, every layer drops at once', () => {
  const s = ready(3, ['bangphong', 'bangphong', 'bangphong'], []);
  put(s, 0, 3);
  put(s, 4, 20);
  step(s, play(...[0, 1, 2].map(() => ({ card: 'bangphong', t: [4] }))), rng);
  assert.equal(s.horses[4].fx?.ice, 3);
  // player 1's turn: horse 4 cannot move normally, may endure
  s.turn = 1;
  s.phase = 'move';
  s.dice = 4;
  s.duel!.plays = 0;
  const acts = legalActions(s);
  assert.ok(!acts.some(a => a.type === 'move' && a.horse === 4));
  assert.ok(acts.some(a => a.type === 'endure' && a.horse === 4));
  step(s, { type: 'endure', horse: 4 }, rng);
  assert.equal(s.horses[4].fx?.ice, 2);
  assert.equal(s.horses[4].pos, 20, 'ice: stands still');
});

test('Giải Trừ clears every control layer', () => {
  const s = ready(1, ['giaitru']);
  put(s, 0, 8);
  s.horses[0].fx = { ice: 2, chain: 1 };
  step(s, play({ card: 'giaitru', t: [0] }), rng);
  assert.equal(s.horses[0].fx, undefined);
});

test('traps: only an enemy that stops on the square sets it off; the owner never does', () => {
  const s = ready(4, ['bhoden']);
  put(s, 0, 10);
  const spot = absOf(0, 14);
  step(s, play({ card: 'bhoden', t: [spot] }), rng);
  assert.equal(s.duel!.traps.length, 1);
  // own horse 1 stops on it: nothing
  put(s, 1, 13);
  s.phase = 'move';
  s.dice = 1;
  step(s, { type: 'move', horse: 1 }, rng);
  assert.equal(s.horses[1].pos, 14);
  assert.equal(s.duel!.traps.length, 1);
  // enemy horse passing over: nothing; stopping: back to the stable
  put(s, 1, 0);
  const rel = (abs: number) => (abs - absOf(2, 0) + 52) % 52;
  s.turn = 1;
  s.phase = 'move';
  s.duel!.plays = 0;
  put(s, 4, rel(spot) - 2);
  s.dice = 3;
  step(s, { type: 'move', horse: 4 }, rng);
  assert.equal(s.duel!.traps.length, 1, 'passed over');
  put(s, 4, rel(spot) - 2);
  s.turn = 1;
  s.phase = 'move';
  s.dice = 2;
  const ev = step(s, { type: 'move', horse: 4 }, rng);
  assert.equal(s.horses[4].pos, STABLE);
  assert.ok(ev.some(e => e.t === 'spring' && e.kind === 'bhoden'));
});

test('hidden: other hands, deck order and trap kinds are "?" in a player view', () => {
  const s = ready(4, ['bhoden', 'tichluc'], ['ne', 'daykeo']);
  put(s, 0, 10);
  const ev = step(s, play({ card: 'bhoden', t: [absOf(0, 14)] }), rng);
  const v1 = viewState(s, 1);
  assert.deepEqual(v1.players[0].cards, ['?']);
  assert.deepEqual(v1.players[1].cards, ['ne', 'daykeo']);
  assert.equal(v1.duel!.traps[0].kind, '?');
  assert.ok(v1.duel!.decks[1].every(c => c === '?'));
  assert.equal(viewState(s, 0).duel!.traps[0].kind, 'bhoden');
  assert.ok(viewEvents(ev, 1).some(e => e.t === 'trap' && e.kind === '?'));
  assert.equal(s.duel!.traps[0].kind, 'bhoden', 'the real state is untouched');
});

test('reaction: the target answers with a same-face Phản card and the play is cancelled', () => {
  const s = ready(1, ['phakhien'], ['ne']);
  put(s, 0, 3);
  put(s, 4, 20);
  s.horses[4].fx = { guard: 1 };
  s.horses[4].shield = 1;
  step(s, play({ card: 'phakhien', t: [4] }), rng);
  assert.equal(s.phase, 'react');
  assert.equal(s.turn, 1);
  assert.deepEqual(legalActions(s), [{ type: 'react', card: '' }, { type: 'react', card: 'ne' }]);
  step(s, { type: 'react', card: 'ne' }, rng);
  assert.equal(s.phase, 'move');
  assert.equal(s.turn, 0);
  assert.equal(s.horses[4].fx?.guard, 1, 'shield kept');
});

test('no reaction window when the target has no card of that face', () => {
  const s = ready(3, ['daykeo'], ['ne']);
  put(s, 0, 3);
  put(s, 4, 20);
  step(s, play({ card: 'daykeo', t: [4] }), rng);
  assert.equal(s.phase, 'move');
  assert.equal(s.horses[4].pos, 16);
});

test('three identical rolls give that face\'s legend', () => {
  const s = ready(1, []);
  s.phase = 'roll';
  s.duel!.streak[0] = [5, 2];
  const r = (v: number) => () => (v - 0.5) / 6;
  step(s, { type: 'roll' }, r(5));
  assert.equal(s.duel!.legend[0], 'l5');
});

test('law 5: horses in the home column are out of reach; card moves stop at the gate', () => {
  const s = ready(1, ['tichluc']);
  put(s, 0, GATE - 1);
  s.players[0].cards = ['tichluc', 'tichluc', 'tichluc'];
  s.dice = 3;
  step(s, play(...[0, 1, 2].map(() => ({ card: 'tichluc', t: [0] }))), rng);
  assert.equal(s.horses[0].pos, GATE);
  const t = ready(3, ['daykeo']);
  put(t, 0, 3);
  put(t, 4, GATE + 2);
  assert.ok(!isLegal(t, play({ card: 'daykeo', t: [4] })));
});
