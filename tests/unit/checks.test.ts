import { describe, expect, it } from 'vitest';
import { cellIndex } from '../../src/game/board';
import {
  digitCounts,
  findConflicts,
  findMistakes,
  isComplete,
  isSolved,
} from '../../src/game/checks';
import type { CellValue, Digit } from '../../src/game/types';
import { fixtureGivens, fixtureSolution } from '../fixtures';

describe('conflicts', () => {
  it('finds none on a clean board', () => {
    expect(findConflicts(fixtureGivens()).size).toBe(0);
    expect(findConflicts(fixtureSolution()).size).toBe(0);
  });

  it('flags duplicates in a row, column and box', () => {
    const values: CellValue[] = new Array(81).fill(0);
    values[cellIndex(0, 0)] = 5;
    values[cellIndex(0, 8)] = 5; // same row
    let conflicts = findConflicts(values);
    expect(conflicts).toContain(cellIndex(0, 0));
    expect(conflicts).toContain(cellIndex(0, 8));

    values[cellIndex(0, 8)] = 0;
    values[cellIndex(7, 0)] = 5; // same column
    conflicts = findConflicts(values);
    expect(conflicts).toContain(cellIndex(7, 0));

    values[cellIndex(7, 0)] = 0;
    values[cellIndex(1, 1)] = 5; // same box
    conflicts = findConflicts(values);
    expect(conflicts).toContain(cellIndex(1, 1));
    expect(conflicts.size).toBe(2);
  });
});

describe('completion', () => {
  it('detects solved boards only when they match the solution', () => {
    const solution = fixtureSolution();
    expect(isComplete(solution)).toBe(true);
    expect(isSolved(solution, fixtureSolution())).toBe(true);

    const givens = fixtureGivens();
    expect(isComplete(givens)).toBe(false);
    expect(isSolved(givens, solution)).toBe(false);

    const wrong = solution.slice();
    // Swap two cells: complete but not the solution.
    [wrong[0], wrong[1]] = [wrong[1]!, wrong[0]!];
    expect(isComplete(wrong)).toBe(true);
    expect(isSolved(wrong, solution)).toBe(false);
  });
});

describe('mistakes', () => {
  it('reports non-empty cells that differ from the solution', () => {
    const solution = fixtureSolution();
    const values = fixtureGivens();
    expect(findMistakes(values, solution)).toEqual([]);

    const emptyIndex = values.indexOf(0);
    const rightDigit = solution[emptyIndex]! as Digit;
    const wrongDigit = ((rightDigit % 9) + 1) as Digit;
    values[emptyIndex] = wrongDigit;
    expect(findMistakes(values, solution)).toEqual([emptyIndex]);

    values[emptyIndex] = rightDigit;
    expect(findMistakes(values, solution)).toEqual([]);
  });
});

describe('digit counts', () => {
  it('counts placements per digit', () => {
    const counts = digitCounts(fixtureSolution());
    for (let d = 1; d <= 9; d++) expect(counts[d]).toBe(9);
    const empty = digitCounts(new Array<CellValue>(81).fill(0));
    for (let d = 1; d <= 9; d++) expect(empty[d]).toBe(0);
  });
});
