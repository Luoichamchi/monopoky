import type { Variant } from '../types.ts';

/** Traditional Vietnamese rules: 6 to leave the stable, no jumping, land exactly to kick, stop exactly on the gate. */
export const classic: Variant = {
  id: 'classic',
  name: 'Cổ điển',
  desc: 'Luật cờ cá ngựa truyền thống: đổ 6 để xuất chuồng, không nhảy qua quân khác, đá khi đi đúng ô.',
  exitOn: [6],
};
