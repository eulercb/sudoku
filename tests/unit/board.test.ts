import { describe, expect, it } from 'vitest';
import {
  CELLS,
  UNITS,
  PEERS,
  boxOf,
  cellIndex,
  colOf,
  gridToString,
  parseGrid,
  rowOf,
} from '../../src/game/board';
import { FIXTURE_PUZZLE, fixtureGivens } from '../fixtures';

describe('board geometry', () => {
  it('maps between (row, col) and index', () => {
    expect(cellIndex(0, 0)).toBe(0);
    expect(cellIndex(8, 8)).toBe(80);
    expect(rowOf(40)).toBe(4);
    expect(colOf(40)).toBe(4);
    for (let i = 0; i < CELLS; i++) {
      expect(cellIndex(rowOf(i), colOf(i))).toBe(i);
    }
  });

  it('computes box membership', () => {
    expect(boxOf(0)).toBe(0);
    expect(boxOf(cellIndex(4, 4))).toBe(4);
    expect(boxOf(cellIndex(8, 0))).toBe(6);
    expect(boxOf(cellIndex(2, 5))).toBe(1);
  });

  it('has 27 units of 9 distinct cells covering the board thrice', () => {
    expect(UNITS).toHaveLength(27);
    const seen = new Array(CELLS).fill(0);
    for (const unit of UNITS) {
      expect(unit).toHaveLength(9);
      expect(new Set(unit).size).toBe(9);
      for (const i of unit) seen[i]!++;
    }
    expect(seen.every((n) => n === 3)).toBe(true);
  });

  it('gives every cell exactly 20 peers, symmetrically', () => {
    expect(PEERS).toHaveLength(CELLS);
    for (let i = 0; i < CELLS; i++) {
      expect(PEERS[i]).toHaveLength(20);
      expect(PEERS[i]).not.toContain(i);
      for (const p of PEERS[i]!) {
        expect(PEERS[p]).toContain(i);
      }
    }
  });

  it('parses all blank conventions and round-trips', () => {
    const givens = fixtureGivens();
    expect(givens).toHaveLength(81);
    expect(givens[2]).toBe(0);
    expect(givens[0]).toBe(9);
    const dotted = FIXTURE_PUZZLE.replaceAll('-', '.');
    expect(parseGrid(dotted)).toEqual(givens);
    expect(parseGrid(FIXTURE_PUZZLE.replaceAll('-', '0'))).toEqual(givens);
    expect(gridToString(givens)).toBe(dotted);
  });

  it('rejects malformed grids', () => {
    expect(() => parseGrid('123')).toThrow(/81/);
    expect(() => parseGrid('x'.repeat(81))).toThrow(/Invalid grid character/);
  });
});
