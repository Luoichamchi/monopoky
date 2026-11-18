const paths = {
  back: 'M19 12H5m6-6-6 6 6 6',
  star: 'M12 1l2.5 8.5L23 12l-8.5 2.5L12 23l-2.5-8.5L1 12l8.5-2.5Z',
  sound: 'M3 9h4l5-4v14l-5-4H3z M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  mute: 'M3 9h4l5-4v14l-5-4H3z m13 0 6 6m0-6-6 6',
  music: 'M9 17V6l11-2v11 M9 17a3 3 0 1 1-3-3h3m11 1a3 3 0 1 1-3-3h3',
  layers: 'm2 8 10-5 10 5-10 5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  book: 'M12 6Q8 3 2 5v14q6-2 10 1 4-3 10-1V5q-6-2-10 1v14',
  flag: 'M5 21V3m0 1c5-4 10 4 15 0v10c-5 4-10-4-15 0',
  hoof: 'M6 4C0 12 5 21 12 21s12-9 6-17l-4 2c4 6 2 10-2 10S6 12 10 6Z',
};

export function icon(name: keyof typeof paths) {
  return `<svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
}
