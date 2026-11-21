// Head-to-head of two duel bot setups (2 players, seats swap every game):  node test/duel-ab.ts [games=400] [A] [B]
// A setup = a level plus weight overrides, e.g. "hard" or "normal:trap=2,trapLine=3" or "base:normal" (the committed bots).
import { chooseAction as current } from '../src/ai/bots.ts';
import { DRAFT_VALUE } from '../src/ai/duel.ts';
import { DW } from '../src/ai/evaluate.ts';
import { cloneState } from '../src/core/board.ts';
import { createGame, step } from '../src/core/engine.ts';
import type { Action, BotLevel, GameState } from '../src/core/types.ts';
import { viewState } from '../src/core/view.ts';

type Pick = (s: GameState, level: BotLevel) => Action;
const [games = '400', A = 'normal', B = 'normal'] = process.argv.slice(2);
const baseDir = process.env.BASE; // a copy of src/ with the old bots (git archive)
const old: Pick | undefined = baseDir ? (await import(`${baseDir}/src/ai/bots.ts`)).chooseAction : undefined;

function setup(spec: string) {
  const [lv, over = ''] = spec.split(':').length > 2 || spec.startsWith('base') ? [spec, ''] : spec.split(':');
  const w: Record<string, number> = {};
  for (const kv of over.split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    w[k] = +v;
  }
  const base = lv.startsWith('base');
  const level = (base ? lv.split(':')[1] : lv) as BotLevel;
  return { level, w, pick: (base ? old! : current) as Pick };
}
const sa = setup(A), sb = setup(B);
const dw0 = { ...DW }, dv0 = { ...DRAFT_VALUE };
function apply(w: Record<string, number>) {
  Object.assign(DW, dw0);
  for (const k of Object.keys(DRAFT_VALUE)) delete DRAFT_VALUE[k];
  Object.assign(DRAFT_VALUE, dv0);
  if (w.nodraft) for (const k of Object.keys(DRAFT_VALUE)) DRAFT_VALUE[k] = 0;
  for (const [k, v] of Object.entries(w)) if (k !== 'nodraft') (k in DW ? ((DW as Record<string, number>)[k] = v) : (DRAFT_VALUE[k] = v));
}

let winsA = 0, turns = 0;
const t0 = performance.now();
for (let g = 0; g < +games; g++) {
  const aFirst = g % 2 === 0;
  const who = aFirst ? [sa, sb] : [sb, sa];
  const s = createGame('duel', [{ name: '0', seat: 0, bot: who[0].level }, { name: '1', seat: 2, bot: who[1].level }], Math.random);
  let n = 0;
  while (s.phase !== 'over' && n++ < 60000) {
    const me = who[s.turn];
    apply(me.w);
    const a = me.pick(viewState(cloneState(s), s.turn), me.level);
    for (const e of step(s, a, Math.random)) if (e.t === 'turn' && s.phase !== 'draft') turns++;
  }
  if (s.winner === (aFirst ? 0 : 1)) winsA++;
}
const p = winsA / +games, se = Math.sqrt((p * (1 - p)) / +games);
console.log(`${A}  vs  ${B}: A wins ${(100 * p).toFixed(1)}% ±${(196 * se).toFixed(1)}  (${games} games, ${(turns / +games / 2).toFixed(0)} turns/player, ${((performance.now() - t0) / +games).toFixed(0)} ms/game)`);
