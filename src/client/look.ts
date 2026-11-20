// The player's visual choices (per browser, also in online games: it never affects other players).
import type { TemplateKind } from './render/renderer.ts';
import { save, store } from './ui/dom.ts';

export interface Look {
  board: TemplateKind;
  dice: TemplateKind;
  follow: boolean; // 3D board turns to whoever's turn it is (false = view locked)
}

const stored = store<Partial<Look>>('ccn.look', {});
export const look: Look = {
  board: stored.board === '2d' ? '2d' : '3d',
  dice: '3d', // 2D dice hidden for now (still used when WebGL is missing)
  follow: stored.follow === true, // locked by default
};
export const saveLook = () => save('ccn.look', look);

