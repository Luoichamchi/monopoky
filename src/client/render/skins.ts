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
