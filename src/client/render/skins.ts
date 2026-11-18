// Per-variant visuals for special tiles and cards. Names/descriptions live with the rules in core/variants.
export const TILE_SKIN: Record<string, { icon: string; color: string }> = {
  boost: { icon: '⚡', color: '#ffe14d' },
  trap: { icon: '🕳️', color: '#b08968' },
  portal: { icon: '🌀', color: '#b28dff' },
  gift: { icon: '🎁', color: '#ff8fc7' },
  shield: { icon: '🛡️', color: '#7fd8ff' },
  ice: { icon: '❄️', color: '#bdf0ff' },
  bomb: { icon: '💣', color: '#ff7a59' },
};

export const CARD_SKIN: Record<string, string> = { reroll: '🎲', freeze: '🧊', shield: '🛡️', lasso: '🪢' };

/** Engraved symbols on the 2D board, centered on a 24-unit tile. */
export const TILE_ENGRAVING: Record<string, string> = {
  boost: 'M2 -10L-7 1h6l-2 9 10-13H1z',
  trap: 'M-9 0q9-6 18 0q-9 7-18 0zm3 5q6 4 12 0 M-1 -8v5m-3-2 3 3 3-3',
  portal: 'M8 2c-1 9-17 9-17-2 0-9 16-11 17-2 1 7-11 9-12 2 0-4 6-5 7-1',
  gift: 'M-7 0h14v8H-7z M-9-4H9v4H-9z M0-4v12 M0-4c-11 0-7-10-3-5zm0 0c11 0 7-10 3-5z',
  shield: 'M0-9l8 3v5q0 6-8 10-8-4-8-10v-5z M-3 0l2 3 5-6',
  ice: 'M0-9V9 M-8-5 8 5 M-8 5 8-5 M-3-7l3 3 3-3 M-3 7l3-3 3 3',
  bomb: 'M3-5a7 7 0 1 1-4-1l1-3 4 1z M4-8q1-5 5-2 M-5 0l2-2',
};
