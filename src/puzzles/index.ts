import { getSudoku } from 'sudoku-gen';
import { parseGrid } from '../game/board';
import type { CellValue, Tier } from '../game/types';

/**
 * Puzzle supply. sudoku-gen's difficulty tiers are technique-derived
 * (QQWing-graded seeds), so labels are honest — never clue-count. This
 * wrapper is the swap point for the optional bespoke engine (CLAUDE.md §
 * "Puzzle supply"): anything that returns a NewPuzzle can replace it.
 */

export interface NewPuzzle {
  id: string;
  tier: Tier;
  givens: CellValue[];
  solution: CellValue[];
}

export function newPuzzle(tier: Tier): NewPuzzle {
  const { puzzle, solution } = getSudoku(tier);
  return {
    id: `${tier}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    tier,
    givens: parseGrid(puzzle),
    solution: parseGrid(solution),
  };
}
