import { classic } from '../classic.ts';
import type { Variant } from '../../types.ts';
import { applyCard, cardActions } from './cards.ts';
import { onLand, placeTiles } from './tiles.ts';

/** Party mode: classic rules + special squares + item cards. */
export const party: Variant = {
  ...classic,
  id: 'party',
  name: 'Lễ hội hỗn loạn',
  desc: 'Ô đặc biệt (tăng tốc, cổng dịch chuyển, bom, băng...) và thẻ bài chiến thuật. Xuất chuồng bằng 1 hoặc 6.',
  exitOn: [1, 6],
  setup: placeTiles,
  onLand,
  canKick: (_s, victim) => victim.shield === 0,
  onTurnStart(s, ctx) {
    for (const h of s.horses) {
      if (h.owner !== s.turn) continue;
      if (h.shield > 0 && --h.shield === 0) ctx.ev.push({ t: 'shield', horse: h.id, on: false });
      if (h.frozen > 0 && --h.frozen === 0) ctx.ev.push({ t: 'freeze', horse: h.id, on: false });
    }
    return false;
  },
  cardActions,
  applyCard,
};
