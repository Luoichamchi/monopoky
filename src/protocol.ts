// Shapes exchanged between server and client (besides core types).
import type { BotLevel } from './core/types.ts';

export type SeatKind = 'human' | 'off' | BotLevel;

export interface RoomView {
  id: string;
  variant: string;
  started: boolean;
  isHost: boolean;
  mySeat: number; // -1 = spectator
  seats: { kind: SeatKind; name?: string; avatar?: string; connected?: boolean }[];
  playerOf: number[]; // seat -> player index
}

/** Who can stand on a mountain (public/models/avatars/<id>.glb). Players carry the id; clients draw it. */
export const AVATARS = [
  { id: 'ordeval', name: 'Ordeval' },
  { id: 'seraphielle', name: 'Seraphielle' },
  { id: 'aurencast', name: 'Aurencast' },
  { id: 'noxariel', name: 'Noxariel' },
  { id: 'nocturne', name: 'Nocturne' },
  { id: 'velmirie', name: 'Velmirie' },
  { id: 'succubus', name: 'Succubus' },
  { id: 'queen', name: 'Queen' },
];
export const isAvatar = (id: unknown): id is string => AVATARS.some(a => a.id === id);

/** Bots, players without a (valid) avatar and later duplicates get a free one at random. Mutates and returns `players`. */
export function assignAvatars<T extends { avatar?: string; bot?: unknown }>(players: T[], rng: () => number = Math.random): T[] {
  const taken = new Set<string>();
  const keep = (p: T) => !p.bot && isAvatar(p.avatar) && !taken.has(p.avatar) && !!taken.add(p.avatar);
  const rest = players.filter(p => !keep(p));
  for (const p of rest) {
    const free = AVATARS.filter(a => !taken.has(a.id));
    p.avatar = free[Math.floor(rng() * free.length)].id; // 8 avatars ≥ 4 seats: never empty
    taken.add(p.avatar);
  }
  return players;
}

export const BOT_NAMES = ['Neko', 'Kitsune', 'Tanuki', 'Usagi'];
export const BOT_LABEL: Record<BotLevel, string> = { easy: 'Dễ', normal: 'Thường', hard: 'Khó', expert: 'Siêu cấp' };
