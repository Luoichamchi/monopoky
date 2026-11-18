// Shapes exchanged between server and client (besides core types).
import type { BotLevel } from './core/types.ts';

export type SeatKind = 'human' | 'off' | BotLevel;

export interface RoomView {
  id: string;
  variant: string;
  started: boolean;
  isHost: boolean;
  mySeat: number; // -1 = spectator
  seats: { kind: SeatKind; name?: string; connected?: boolean }[];
  playerOf: number[]; // seat -> player index
}

export const BOT_NAMES = ['Neko', 'Kitsune', 'Tanuki', 'Usagi'];
export const BOT_LABEL: Record<BotLevel, string> = { easy: 'Dễ', normal: 'Thường', hard: 'Khó', expert: 'Siêu cấp' };
