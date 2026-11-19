// Special squares. Effects trigger once when a horse *stops* on the square (no chaining).
import { GATE, TRACK, absOf, absOfHorse, horseAt, kick, onTrack, seatOf, slide } from '../../board.ts';
import type { Ctx, GameState, Horse, Rng } from '../../types.ts';
import { CARD_KINDS, MAX_HAND, freeze } from './cards.ts';

export const TILE_INFO: Record<string, { name: string; desc: string }> = {
  boost: { name: 'Tăng tốc', desc: 'Lao thêm tối đa 3 ô (không vượt quân khác).' },
  trap: { name: 'Hố bùn', desc: 'Trượt lùi tối đa 3 ô.' },
  portal: { name: 'Cổng dịch chuyển', desc: 'Bay tới cổng kế tiếp phía trước, đá luôn quân địch đang đứng đó.' },
  gift: { name: 'Hộp quà', desc: `Nhận 1 thẻ bài (tối đa ${MAX_HAND}).` },
  shield: { name: 'Khiên', desc: 'Không thể bị đá trong 3 lượt.' },
  ice: { name: 'Băng giá', desc: 'Ngựa bị đóng băng, không được đi ở lượt kế tiếp.' },
  bomb: { name: 'Bom', desc: 'Nổ tung: mọi ngựa địch trong bán kính 2 ô về chuồng (khiên đỡ được).' },
};

const pick = <T>(arr: T[], rng: Rng) => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** One random pattern, copied to all 4 quadrants so every seat faces the same board (fair). */
export function placeTiles(s: GameState, rng: Rng) {
  // offsets inside a quadrant, relative to that quadrant's start square; 0 = start, 11 = next seat's gate
  const offsets = shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 12], rng).slice(0, 6);
  const kinds = shuffle(['portal', 'gift', 'boost', 'trap', 'bomb', pick(['shield', 'ice'], rng)], rng);
  for (let q = 0; q < 4; q++) offsets.forEach((o, i) => (s.tiles[absOf(q, o)] = kinds[i]));
}

export function onLand(s: GameState, h: Horse, ctx: Ctx) {
  const here = absOfHorse(s, h);
  const tile = s.tiles[here];
  if (!tile) return;
  ctx.ev.push({ t: 'tile', horse: h.id, tile });
  const player = s.players[h.owner];
  switch (tile) {
    case 'boost':
    case 'trap': {
      const path = slide(s, h, tile === 'boost' ? 1 : -1, 3);
      if (path.length) ctx.ev.push({ t: 'move', horse: h.id, path });
      break;
    }
    case 'portal': {
      const seat = seatOf(s, h.owner);
      for (let p = h.pos + 1; p <= GATE; p++) {
        if (s.tiles[absOf(seat, p)] !== 'portal') continue;
        const occ = horseAt(s, absOf(seat, p));
        if (occ && (occ.owner === h.owner || occ.shield > 0)) break;
        ctx.ev.push({ t: 'move', horse: h.id, path: [p], jump: true });
        if (occ) kick(occ, h, ctx);
        h.pos = p;
        break;
      }
      break;
    }
    case 'gift':
      if (player.cards.length < MAX_HAND) {
        const card = pick(CARD_KINDS, ctx.rng);
        player.cards.push(card);
        ctx.ev.push({ t: 'gain', player: h.owner, card });
      }
      break;
    case 'shield':
      h.shield = 3;
      ctx.ev.push({ t: 'shield', horse: h.id, on: true });
      break;
    case 'ice':
      freeze(h, ctx);
      break;
    case 'bomb':
      for (const o of s.horses) {
        if (o.owner === h.owner || !onTrack(o)) continue;
        const d = Math.abs(absOfHorse(s, o) - here);
        if (Math.min(d, TRACK - d) > 2) continue;
        if (o.shield > 0) {
          o.shield = 0;
          ctx.ev.push({ t: 'shield', horse: o.id, on: false });
        } else kick(o, h, ctx);
      }
      break;
  }
}
