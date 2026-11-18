// Bot strength check: node test/bench.ts [variant] [games] [expertBudgetMs]
// Plays level A vs level B (2 players, opposite seats, alternating who starts) and prints A's win rate.
import { chooseAction } from '../src/ai/bots.ts';
import { cloneState } from '../src/core/board.ts';
import { createGame, step } from '../src/core/engine.ts';
import type { BotLevel } from '../src/core/types.ts';

const [variant = 'classic', games = '200', budget = '15'] = process.argv.slice(2);
function play(a: BotLevel, b: BotLevel, aFirst: boolean): boolean {
  const lv = aFirst ? [a, b] : [b, a];
  const s = createGame(variant, [{ name: '0', seat: 0, bot: lv[0] }, { name: '1', seat: 2, bot: lv[1] }], Math.random);
  while (s.phase !== 'over') step(s, chooseAction(cloneState(s), s.players[s.turn].bot!, { budgetMs: +budget }), Math.random);
  return s.winner === (aFirst ? 0 : 1);
}
const pairs: [BotLevel, BotLevel][] = [['normal', 'easy'], ['hard', 'normal'], ['expert', 'hard']];
for (const [a, b] of pairs) {
  const n = a === 'expert' ? Math.ceil(+games / 4) : +games;
  let w = 0;
  const t = performance.now();
  for (let g = 0; g < n; g++) w += +play(a, b, g % 2 === 0);
  console.log(`${variant}: ${a} vs ${b}: ${((100 * w) / n).toFixed(1)}% (${n} games, ${((performance.now() - t) / 1000).toFixed(1)}s)`);
}
