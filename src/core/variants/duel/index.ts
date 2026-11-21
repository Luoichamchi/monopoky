// "Đấu bài": classic movement + a drafted deck, dice faces unlock cards (docs/rulebook.md).
import { onTrack } from '../../board.ts';
import { target } from '../../engine.ts';
import type { Action, Ctx, DuelState, GameState, Rng, Variant } from '../../types.ts';
import { classic } from '../classic.ts';
import { DECK_SIZE, DUEL_CARDS as C, MAX_HAND, START_HAND } from './cards.ts';
import {
  cardMove, controlled, discardRandom, draw, duel, grantLegend, kickable, landed, lead, removeTrap, setFx, shuffle,
} from './effects.ts';
import { playList, reactions, reflect, resolve, validPlay, victims } from './play.ts';

function setup(s: GameState, _rng: Rng) {
  const n = s.players.length;
  const order: number[] = [];
  for (let r = 0; r < DECK_SIZE; r++) {
    const round = [...Array(n).keys()];
    order.push(...(r % 2 ? round.reverse() : round)); // snake: the last picker of a round picks first in the next
  }
  const each = <T>(f: () => T) => Array.from({ length: n }, f);
  s.duel = {
    pool: Object.fromEntries(Object.entries(C).filter(([, c]) => c.copies > 0).map(([id, c]) => [id, c.copies])),
    order,
    lists: each(() => []),
    decks: each(() => []),
    discards: each(() => []),
    plays: 1,
    extra: 0,
    noMove: -1,
    traps: [],
    streak: each(() => [0, 0]),
    prevStreak: [0, 0],
    legend: each(() => ''),
    legendsTaken: [],
    sealed: each(() => 0),
    aegis: each(() => 0),
    links: [],
    known: each(() => []),
  } satisfies DuelState;
  s.phase = 'draft';
  s.turn = order[0];
}

function pick(s: GameState, card: string, ctx: Ctx) {
  const d = duel(s);
  const open = Object.keys(d.pool).filter(k => d.pool[k] > 0);
  if (!card) card = open[Math.floor(ctx.rng() * open.length)];
  d.pool[card]--;
  d.lists[s.turn].push(card);
  ctx.ev.push({ t: 'pick', player: s.turn, card });
  d.order.shift();
  if (d.order.length) return void (s.turn = d.order[0]);
  // draft over: everyone shuffles their 12 cards and draws 4
  s.players.forEach((_, p) => {
    d.decks[p] = shuffle([...d.lists[p]], ctx.rng);
    draw(s, p, START_HAND, ctx);
  });
  s.phase = 'roll';
  s.turn = 0;
  ctx.ev.push({ t: 'begin' }, { t: 'turn', player: 0 });
  startTurn(s, ctx);
}

/** A player turn begins (law 1A): player-turn timers tick, traps age, draw 1. */
function startTurn(s: GameState, ctx: Ctx): boolean {
  const d = duel(s);
  const p = s.turn;
  for (const h of s.horses) {
    const f = h.fx;
    if (h.owner !== p || !f) continue;
    if (f.guardT && --f.guardT === 0) setFx(h, 'guard', 0, ctx);
    if (f.armorT && --f.armorT === 0) setFx(h, 'armor', 0, ctx);
    if (f.immune) setFx(h, 'immune', f.immune - 1, ctx);
  }
  for (const tr of [...d.traps]) if (tr.owner === p && --tr.left <= 0) removeTrap(s, tr, ctx);
  if (d.sealed[p] > 0 && --d.sealed[p] === 0) ctx.ev.push({ t: 'seal', player: p, on: false });
  if (d.aegis[p] > 0) d.aegis[p]--;
  d.plays = 1;
  d.extra = 0;
  d.noMove = -1;
  draw(s, p, 1, ctx);
  return false;
}

/** Give this roll to a controlled horse (law 11): it obeys its strongest control, then every control loses a layer. */
function endure(s: GameState, horse: number, ctx: Ctx) {
  const d = duel(s);
  const h = s.horses[horse];
  const f = h.fx!;
  if (f.ice) {
    // stands still
  } else if (f.rev) cardMove(s, h, -1, s.dice, ctx, false);
  else if (f.chain && s.dice <= 2 && target(s, h, s.dice) !== null) ctx.move(h, s.dice);
  for (const k of ['ice', 'rev', 'chain'] as const) if (h.fx?.[k]) setFx(h, k, h.fx[k]! - 1, ctx);
  tickLinks(s, h.id, ctx);
  if (s.phase !== 'over') ctx.endTurn(s.dice === 6);
}

function tickLinks(s: GameState, leader: number, ctx: Ctx) {
  const d = duel(s);
  for (const l of [...d.links]) {
    if (l.leader !== leader || --l.left > 0) continue;
    d.links = d.links.filter(x => x !== l);
    ctx.ev.push({ t: 'link', leader: l.leader, follower: l.follower, on: false });
  }
}

function play(s: GameState, picks: Extract<Action, { type: 'play' }>['picks'], ctx: Ctx) {
  const d = duel(s);
  const p = s.turn;
  for (const pk of picks) {
    if (C[pk.card].kind === 'legend') d.legend[p] = '';
    else s.players[p].cards.splice(s.players[p].cards.indexOf(pk.card), 1);
  }
  d.plays--;
  const face = s.dice;
  ctx.ev.push({ t: 'play', player: p, picks, face });
  if (C[picks[0].card].kind !== 'legend') {
    const queue = victims(s, p, picks).filter(q => reactions(s, q, face).length);
    if (queue.length) {
      d.pending = { by: p, picks, face, queue };
      s.phase = 'react';
      s.turn = queue[0];
      return;
    }
  }
  settle(s, p, picks, ctx);
}

/** Resolve, then the played cards go to the discard pile (traps too: the board token stands for them). */
function settle(s: GameState, by: number, picks: Extract<Action, { type: 'play' }>['picks'], ctx: Ctx) {
  resolve(s, by, picks, ctx);
  for (const pk of picks) if (C[pk.card].kind !== 'legend') duel(s).discards[by].push(pk.card);
}

function react(s: GameState, card: string, ctx: Ctx) {
  const d = duel(s);
  const pend = d.pending!;
  const me = s.turn;
  const back = () => {
    s.turn = pend.by;
    s.phase = 'move';
    d.pending = undefined;
  };
  if (!card) {
    pend.queue.shift();
    if (pend.queue.length) return void (s.turn = pend.queue[0]);
    back();
    return settle(s, pend.by, pend.picks, ctx);
  }
  const hand = s.players[me].cards;
  hand.splice(hand.indexOf(card), 1);
  d.discards[me].push(card);
  ctx.ev.push({ t: 'react', player: me, card });
  back();
  const by = pend.by;
  const toDiscard = () => pend.picks.forEach(pk => C[pk.card].kind !== 'legend' && d.discards[by].push(pk.card));
  switch (card) {
    case 'hapthu':
      draw(s, me, 1, ctx);
      break;
    case 'batlui': {
      const h = lead(s, by);
      if (h) cardMove(s, h, -1, 2, ctx, false);
      break;
    }
    case 'hoagiai':
      discardRandom(s, by, ctx);
      break;
    case 'chiemdoat':
      for (const pk of pend.picks) {
        s.players[me].cards.push(pk.card);
        ctx.ev.push({ t: 'steal', from: by, to: me, card: pk.card });
      }
      return;
    case 'phandon':
      resolve(s, me, reflect(s, by, me, pend.picks), ctx);
      break;
  }
  toDiscard();
}

function onRoll(s: GameState, value: number, ctx: Ctx) {
  const d = duel(s);
  const p = s.turn;
  d.noMove = -1;
  d.prevStreak = [...d.streak[p]];
  const st = d.streak[p];
  d.streak[p] = st[0] === value ? [value, st[1] + 1] : [value, 1];
  if (d.streak[p][1] >= 3) {
    d.streak[p] = [0, 0];
    grantLegend(s, p, value, ctx);
  }
}

export const duelMode: Variant = {
  ...classic,
  id: 'duel',
  name: 'Đấu bài',
  desc: 'Chọn 12 lá bài trước trận. Mặt xúc xắc mở khoá lá bài cùng điểm: combo, bẫy giấu mặt, phản đòn và lá huyền thoại khi đổ trùng 3 lần.',
  setup,
  onTurnStart: startTurn,
  onLand: landed,
  canKick: kickable,
  canMove: (s, h) => !controlled(h) && h.id !== duel(s).noMove,
  onRoll,
  onMoved(s, h, steps, ctx) {
    const d = duel(s);
    if (!onTrack(h)) {
      // reached the home column (law 5): any link with it ends
      for (const l of [...d.links]) if (l.leader === h.id || l.follower === h.id) {
        d.links = d.links.filter(x => x !== l);
        ctx.ev.push({ t: 'link', leader: l.leader, follower: l.follower, on: false });
      }
      return;
    }
    for (const l of d.links) if (l.leader === h.id && steps > 0) cardMove(s, s.horses[l.follower], 1, steps, ctx);
    tickLinks(s, h.id, ctx);
  },
  extraRoll(s) {
    const d = duel(s);
    if (d.extra <= 0) return false;
    d.extra--;
    return true;
  },
  actions(s, core) {
    const d = duel(s);
    const p = s.turn;
    switch (s.phase) {
      case 'draft':
        return Object.keys(d.pool).filter(k => d.pool[k] > 0).map(card => ({ type: 'pick', card }));
      case 'react':
        return [{ type: 'react', card: '' }, ...reactions(s, p, d.pending!.face).map(card => ({ type: 'react', card }) as Action)];
      case 'roll':
        if (s.players[p].cards.length > MAX_HAND) return [...new Set(s.players[p].cards)].map(card => ({ type: 'discard', card }));
        return core;
      case 'move': {
        const endure: Action[] = s.horses
          .filter(h => h.owner === p && onTrack(h) && controlled(h) && h.id !== d.noMove)
          .map(h => ({ type: 'endure', horse: h.id }));
        let base: Action[] = core.filter(a => a.type !== 'pass');
        if (!base.length && !endure.length) base = [{ type: 'pass' } as Action];
        return [...base, ...endure, ...playList(s).map(picks => ({ type: 'play', picks }) as Action)];
      }
    }
    return core;
  },
  legal(s, a) {
    if (a.type === 'play') return validPlay(s, a.picks);
    if (a.type === 'pick' && a.card === '') return s.phase === 'draft';
    return undefined;
  },
  apply(s, a, ctx) {
    switch (a.type) {
      case 'pick':
        return pick(s, a.card, ctx);
      case 'play':
        return play(s, a.picks, ctx);
      case 'react':
        return react(s, a.card, ctx);
      case 'endure':
        return endure(s, a.horse, ctx);
      case 'discard': {
        const hand = s.players[s.turn].cards;
        hand.splice(hand.indexOf(a.card), 1);
        duel(s).discards[s.turn].push(a.card);
        ctx.ev.push({ t: 'discard', player: s.turn, card: a.card });
      }
    }
  },
};

