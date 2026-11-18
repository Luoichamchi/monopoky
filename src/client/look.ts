// The player's visual choices (per browser, also in online games: it never affects other players).
import type { TemplateKind } from './render/renderer.ts';
import { BOARD_THEMES, isBoardTheme, type BoardTheme } from './render/board-themes.ts';
import { save, store } from './ui/dom.ts';

export interface Look {
  board: TemplateKind;
  dice: TemplateKind;
  theme: BoardTheme;
}

const stored = store<Partial<Look>>('ccn.look', {});
export const look: Look = {
  board: stored.board === '3d' ? '3d' : '2d',
  dice: stored.dice === '3d' ? '3d' : '2d',
  theme: isBoardTheme(stored.theme) ? stored.theme : 'spirit',
};
export const saveLook = () => save('ccn.look', look);

export function themeSelect() {
  const options = Object.entries(BOARD_THEMES).map(([id, label]) =>
    `<option value="${id}" ${look.theme === id ? 'selected' : ''}>${label}</option>`);
  return `<label class="theme-choice" ${look.board === '3d' ? 'hidden' : ''}>Chủ đề 2D <select data-theme-select>${options.join('')}</select></label>`;
}
