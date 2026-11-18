// Item cards: collected from gift tiles, played on your own turn. Every card targets a horse (or -1).
import { onTrack, slide } from '../../board.ts';
import type { Action, Ctx, GameState } from '../../types.ts';

export const MAX_HAND = 2;

export const CARD_INFO: Record<string, { name: string; desc: string; phase: 'roll' | 'move' }> = {
  reroll: { name: 'Đổ lại', desc: 'Sau khi đổ, bỏ kết quả và đổ lại.', phase: 'move' },
  freeze: { name: 'Đóng băng', desc: 'Chọn 1 ngựa địch: chủ của nó mất lượt kế tiếp.', phase: 'roll' },
  shield: { name: 'Khiên thần', desc: 'Ngựa của bạn trên đường đua không thể bị đá trong 3 lượt.', phase: 'roll' },
  lasso: { name: 'Dây kéo', desc: 'Kéo 1 ngựa địch trên đường đua lùi tối đa 4 ô.', phase: 'roll' },
};
export const CARD_KINDS = Object.keys(CARD_INFO);

export function cardActions(s: GameState): Action[] {
  const me = s.turn;
  const out: Action[] = [];
  for (const card of new Set(s.players[me].cards)) {
    if (CARD_INFO[card].phase !== s.phase) continue;
    if (card === 'reroll') out.push({ type: 'card', card, target: -1 });
    for (const h of s.horses) {
      const enemy = h.owner !== me;
      const ok =
        card === 'freeze' ? enemy && h.id % 4 === 0 && s.players[h.owner].frozen === 0 // one action per opponent
        : card === 'shield' ? !enemy && onTrack(h) && h.shield === 0
        : card === 'lasso' ? enemy && onTrack(h) && h.pos > 0 && h.shield === 0
        : false;
      if (ok) out.push({ type: 'card', card, target: h.id });
    }
  }
  return out;
}

export function applyCard(s: GameState, a: Extract<Action, { type: 'card' }>, ctx: Ctx) {
  const p = s.players[s.turn];
  p.cards.splice(p.cards.indexOf(a.card), 1);
  ctx.ev.push({ t: 'card', player: s.turn, card: a.card, target: a.target });
  const h = s.horses[a.target];
  switch (a.card) {
    case 'reroll':
      ctx.roll(1 + Math.floor(ctx.rng() * 6));
      break;
    case 'freeze':
      s.players[h.owner].frozen++;
      break;
    case 'shield':
      h.shield = 3;
      ctx.ev.push({ t: 'shield', horse: h.id, on: true });
      break;
    case 'lasso': {
      const path = slide(s, h, -1, 4);
      if (path.length) ctx.ev.push({ t: 'move', horse: h.id, path });
      break;
    }
  }
}
