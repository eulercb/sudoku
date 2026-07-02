import { CELLS, PEERS } from './board';
import { digitsToNotes, removeNote } from './notes';
import type { CellValue, Digit } from './types';
import { DIGITS } from './types';

const ALL_DIGITS_MASK = digitsToNotes(DIGITS);

/**
 * For every empty cell, the bitmask of digits not present among its peers.
 * Filled cells get 0.
 */
export function computeCandidates(values: readonly CellValue[]): number[] {
  const out = new Array<number>(CELLS).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (values[i] !== 0) continue;
    let mask = ALL_DIGITS_MASK;
    for (const p of PEERS[i]!) {
      const v = values[p]!;
      if (v !== 0) mask = removeNote(mask, v as Digit);
    }
    out[i] = mask;
  }
  return out;
}
