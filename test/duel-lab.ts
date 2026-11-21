// Duel mode lab: bots play many games, we count what every card does.
//   node test/duel-lab.ts [games=400] [players=2] [level=normal] [draft=bot|random]
// "random" draft spreads cards evenly over decks, so the win-rate column means something.
import { chooseAction } from '../src/ai/bots.ts';
import { W, evaluate } from '../src/ai/evaluate.ts';
import { cloneState } from '../src/core/board.ts';
import { createGame, step } from '../src/core/engine.ts';
import type { BotLevel, GameEvent, GameState } from '../src/core/types.ts';
import { DUEL_CARDS as C } from '../src/core/variants/duel/cards.ts';
import { viewState } from '../src/core/view.ts';

const [games = '400', players = '2', level = 'normal', draft = 'bot'] = process.argv.slice(2);
const N = +games, NP = +players;

interface Row { drafted: number; won: number; drawn: number; played: number; asCombo: number; gain: number; gainN: number; reacted: number }
const rows: Record<string, Row> = {};
const row = (c: string) => (rows[c] ??= { drafted: 0, won: 0, drawn: 0, played: 0, asCombo: 0, gain: 0, gainN: 0, reacted: 0 });
const tally = { turns: 0, kicks: 0, endure: 0, pass: 0, discards: 0, windows: 0, reacts: 0, legendsGot: 0, legendsPlayed: 0, placed: 0, sprung: 0, faded: 0, blocked: 0, rolls: 0, rollsWithPlay: 0, combos: 0, comboSize: 0 };
const trapKinds: Record<string, { placed: number; sprung: number }> = {};
const comboKinds: Record<string, number> = {};
let ms = 0;

/** Position value without the cards in hand (a played card should not count as a loss). */
const board = (s: GameState, p: number) => {
  const k = W.card;
  W.card = 0;
  const v = evaluate(s, p);
  W.card = k;
  return v;
};

for (let g = 0; g < N; g++) {
  const s = createGame('duel', Array.from({ length: NP }, (_, i) => ({ name: `P${i}`, seat: NP === 2 ? i * 2 : i, bot: level as BotLevel })), Math.random);
  let pending: { p: number; cards: string[]; before: number } | undefined;
  const t0 = performance.now();
  let n = 0;
  while (s.phase !== 'over' && n++ < 50000) {
    const p = s.turn;
    const a = s.phase === 'draft' && draft === 'random' ? { type: 'pick' as const, card: '' } : chooseAction(viewState(cloneState(s), p), level as BotLevel, {});
    if (s.phase === 'move' && a.type === 'play') pending = { p, cards: a.picks.map(x => x.card), before: board(s, p) };
    if (a.type === 'endure') tally.endure++;
    if (a.type === 'pass') tally.pass++;
    if (a.type === 'discard') tally.discards++;
    if (a.type === 'roll' && s.duel) {
      // would any card be playable on this face? (measured after the roll below)
    }
    const ev: GameEvent[] = step(s, a, Math.random);
    for (const e of ev) {
      if (e.t === 'turn' && s.phase !== 'draft') tally.turns++;
      if (e.t === 'kick') tally.kicks++;
      if (e.t === 'draw') row(e.card).drawn++;
      if (e.t === 'react') (tally.reacts++, row(e.card).reacted++);
      if (e.t === 'legend') tally.legendsGot++;
      if (e.t === 'trap' && e.on) (tally.placed++, ((trapKinds[e.kind] ??= { placed: 0, sprung: 0 }).placed++));
      if (e.t === 'spring') (tally.sprung++, trapKinds[e.kind].sprung++);
          if (e.t === 'play') {
        for (const pk of e.picks) row(pk.card).played++;
        if (e.picks.length > 1) {
          tally.combos++;
          tally.comboSize += e.picks.length;
          const key = [...new Set(e.picks.map(x => x.card))].sort().join('+');
          comboKinds[key] = (comboKinds[key] ?? 0) + 1;
          for (const pk of e.picks) row(pk.card).asCombo++;
        }
        if (C[e.picks[0].card].kind === 'legend') tally.legendsPlayed++;
      }
    }
    if (s.phase === 'react' && a.type === 'play') tally.windows++;
    if (a.type === 'roll' && s.phase === 'move' && s.duel) {
      tally.rolls++;
      // a play is possible if the hand holds a card of this face, a trap, or a held legend
      const hand = s.players[s.turn].cards;
      if (hand.some(c => C[c].point === s.dice || C[c].kind === 'trap')) tally.rollsWithPlay++;
    }
    if (pending && s.phase !== 'react') {
      const d = board(s, pending.p) - pending.before;
      for (const c of new Set(pending.cards)) (row(c).gain += d), row(c).gainN++;
      pending = undefined;
    }
  }
  ms += performance.now() - t0;
  s.duel!.lists.forEach((list, p) => {
    for (const c of new Set(list)) {
      row(c).drafted++;
      if (s.winner === p) row(c).won++;
    }
  });
  tally.faded = tally.placed - tally.sprung;
}

if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify({ N, NP, rows, tally, trapKinds }));
const f = (x: number, d = 1) => x.toFixed(d);
console.log(`${N} games, ${NP} players, ${level} bots, ${draft} draft, ${f(ms / N, 0)} ms/game`);
console.log(`turns/player ${f(tally.turns / N / NP)}  kicks/game ${f(tally.kicks / N)}  plays have a card ${f((100 * tally.rollsWithPlay) / tally.rolls, 0)}% of rolls`);
console.log(`endure/game ${f(tally.endure / N)}  pass/game ${f(tally.pass / N)}  discards/game ${f(tally.discards / N)}`);
console.log(`reaction windows/game ${f(tally.windows / N, 2)}  reacted ${f((100 * tally.reacts) / Math.max(1, tally.windows), 0)}%`);
console.log(`legends got/game ${f(tally.legendsGot / N, 2)}  played ${f(tally.legendsPlayed / N, 2)}`);
console.log(`traps placed/game ${f(tally.placed / N, 2)}  sprung ${f((100 * tally.sprung) / Math.max(1, tally.placed), 0)}%  `);
console.log(`combos/game ${f(tally.combos / N, 2)}  avg size ${f(tally.comboSize / Math.max(1, tally.combos), 2)}`);
console.log('trap kinds:', Object.entries(trapKinds).map(([k, v]) => `${k} ${v.placed}/${f((100 * v.sprung) / v.placed, 0)}%`).join('  '));
console.log('top combos:', Object.entries(comboKinds).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}×${v}`).join('  '));
console.log('\ncard            pt kind   drafted  win%   drawn  played  play/draw  combo%  gain/play  reacted');
for (const [c, r] of Object.entries(rows).sort((a, b) => (b[1].gainN ? b[1].gain / b[1].gainN : -99) - (a[1].gainN ? a[1].gain / a[1].gainN : -99))) {
  const d = C[c];
  console.log(
    `${d.name.padEnd(15)} ${String(d.point).padStart(2)} ${d.kind.padEnd(6)} ${String(r.drafted).padStart(7)} ${f((100 * r.won) / Math.max(1, r.drafted)).padStart(6)} ${String(r.drawn).padStart(7)} ${String(r.played).padStart(7)} ${f(r.played / Math.max(1, r.drawn), 2).padStart(10)} ${f((100 * r.asCombo) / Math.max(1, r.played), 0).padStart(7)} ${f(r.gainN ? r.gain / r.gainN : 0).padStart(10)} ${String(r.reacted).padStart(8)}`,
  );
}
