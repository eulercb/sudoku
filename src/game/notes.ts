import type { Digit } from './types';
import { DIGITS } from './types';

/** Pencil-mark sets are bitmasks: bit (1 << d) set means digit d is noted. */

export const EMPTY_NOTES = 0;

export const noteBit = (d: Digit): number => 1 << d;

export const hasNote = (mask: number, d: Digit): boolean => (mask & noteBit(d)) !== 0;

export const addNote = (mask: number, d: Digit): number => mask | noteBit(d);

export const removeNote = (mask: number, d: Digit): number => mask & ~noteBit(d);

export const toggleNote = (mask: number, d: Digit): number => mask ^ noteBit(d);

export const notesToDigits = (mask: number): Digit[] => DIGITS.filter((d) => hasNote(mask, d));

export const digitsToNotes = (digits: readonly Digit[]): number =>
  digits.reduce<number>((mask, d) => addNote(mask, d), EMPTY_NOTES);

export const countNotes = (mask: number): number => {
  let n = 0;
  for (let m = mask >> 1; m !== 0; m >>= 1) n += m & 1;
  return n;
};
