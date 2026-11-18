// The player's visual choices (per browser, also in online games: it never affects other players).
import type { TemplateKind } from './render/renderer.ts';
import { save, store } from './ui/dom.ts';

export interface Look {
  board: TemplateKind;
  dice: TemplateKind;
}

export const look: Look = { board: '2d', dice: '2d', ...store<Partial<Look>>('ccn.look', {}) };
export const saveLook = () => save('ccn.look', look);
