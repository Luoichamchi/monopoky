import type { Variant } from '../types.ts';
import { classic } from './classic.ts';
import { party } from './party/index.ts';

// Register new game modes here.
export const VARIANTS: Variant[] = [classic, party];

export function getVariant(id: string): Variant {
  const v = VARIANTS.find(x => x.id === id);
  if (!v) throw new Error(`unknown variant ${id}`);
  return v;
}
