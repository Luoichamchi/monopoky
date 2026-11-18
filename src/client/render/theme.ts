// Visual theme. Swap this file (or add another theme) to restyle the whole game.
export const THEME = {
  ink: '#2a1a4a', // anime cel outline
  paper: '#fffaf3',
  seats: [
    { name: 'Sakura', main: '#ff4d8d', light: '#ffd0e2', dark: '#c81e63' },
    { name: 'Sora', main: '#3b9bff', light: '#cfe6ff', dark: '#1d5fd1' },
    { name: 'Midori', main: '#22c97a', light: '#c6f6dc', dark: '#11804a' },
    { name: 'Hikari', main: '#ffb21e', light: '#ffeab3', dark: '#c47800' },
  ],
  sfx: ['BAM!', 'POW!', 'DOKAN!', 'BOOM!', 'ZUBA!'],
  horseGlyph: '♞',
};
export const seatColor = (seat: number) => THEME.seats[seat];
