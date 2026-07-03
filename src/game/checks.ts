import { CELLS, UNITS } from './board';
import type { CellValue } from './types';

/**
 * Indices of all cells involved in a rule violation (a duplicated digit
 * within a row, column, or box).
 */
export function findConflicts(values: readonly CellValue[]): Set<number> {
  const conflicts = new Set<number>();
  for (const unit of UNITS) {
    const byDigit = new Map<number, number[]>();
    for (const i of unit) {
      const v = values[i]!;
      if (v === 0) continue;
      const list = byDigit.get(v);
      if (list) list.push(i);
      else byDigit.set(v, [i]);
    }
    for (const cells of byDigit.values()) {
      if (cells.length > 1) for (const i of cells) conflicts.add(i);
    }
  }
  return conflicts;
}

export function isComplete(values: readonly CellValue[]): boolean {
  return values.every((v) => v !== 0);
}

export function isSolved(values: readonly CellValue[], solution: readonly CellValue[]): boolean {
  for (let i = 0; i < CELLS; i++) {
    if (values[i] !== solution[i]) return false;
  }
  return true;
}

/** Indices of non-empty cells whose value differs from the solution. */
export function findMistakes(
  values: readonly CellValue[],
  solution: readonly CellValue[],
): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    const v = values[i]!;
    if (v !== 0 && v !== solution[i]) out.push(i);
  }
  return out;
}

/** How many cells hold each digit (index 1–9; index 0 unused). */
export function digitCounts(values: readonly CellValue[]): number[] {
  const counts = new Array<number>(10).fill(0);
  for (const v of values) counts[v]!++;
  counts[0] = 0;
  return counts;
}
