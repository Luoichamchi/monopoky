export const BOARD_THEMES = {
  spirit: 'Ảnh Mã',
  cloud: 'Đảo trên mây',
  atlas: 'Tinh bàn Thiên Mã',
  original: 'Anime nguyên bản',
} as const;

export type BoardTheme = keyof typeof BOARD_THEMES;

export function isBoardTheme(value: unknown): value is BoardTheme {
  return typeof value === 'string' && Object.hasOwn(BOARD_THEMES, value);
}
