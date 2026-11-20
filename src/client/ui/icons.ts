const paths = {
  back: 'M19 12H5m6-6-6 6 6 6',
  star: 'M12 1l2.5 8.5L23 12l-8.5 2.5L12 23l-2.5-8.5L1 12l8.5-2.5Z',
  flag: 'M5 21V3m0 1c5-4 10 4 15 0v10c-5 4-10-4-15 0',
  hoof: 'M6 4C0 12 5 21 12 21s12-9 6-17l-4 2c4 6 2 10-2 10S6 12 10 6Z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.7 1l-.3 2h-4l-.3-2a7 7 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3L3 9.3l2-3.4 1.9.7a7 7 0 0 1 1.7-1l.3-2h4l.3 2a7 7 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5 M12 17.5h.01',
};

export function icon(name: keyof typeof paths) {
  return `<svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
}
