export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 0 means empty. */
export type CellValue = 0 | Digit;

export type Tier = 'easy' | 'medium' | 'hard' | 'expert';

export const TIERS: readonly Tier[] = ['easy', 'medium', 'hard', 'expert'];

export const DIGITS: readonly Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * The mutable per-cell state of a board: values plus pencil marks.
 * Notes are digit bitmasks (bit 1 << d set means digit d is noted) — compact,
 * cheap to compare, and directly serializable. See src/game/notes.ts.
 */
export interface CellsState {
  values: CellValue[];
  corner: number[];
  center: number[];
}
