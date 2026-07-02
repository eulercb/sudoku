import type { CellValue } from './types';

export const SIZE = 9;
export const CELLS = 81;

export const cellIndex = (row: number, col: number): number => row * SIZE + col;
export const rowOf = (i: number): number => Math.floor(i / SIZE);
export const colOf = (i: number): number => i % SIZE;
export const boxOf = (i: number): number => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

const buildUnits = (): number[][] => {
  const units: number[][] = [];
  for (let r = 0; r < SIZE; r++) {
    units.push(Array.from({ length: SIZE }, (_, c) => cellIndex(r, c)));
  }
  for (let c = 0; c < SIZE; c++) {
    units.push(Array.from({ length: SIZE }, (_, r) => cellIndex(r, c)));
  }
  for (let b = 0; b < SIZE; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    const unit: number[] = [];
    for (let r = r0; r < r0 + 3; r++) {
      for (let c = c0; c < c0 + 3; c++) unit.push(cellIndex(r, c));
    }
    units.push(unit);
  }
  return units;
};

/** The 27 units (9 rows, 9 columns, 9 boxes), each an array of 9 cell indices. */
export const UNITS: readonly (readonly number[])[] = buildUnits();

const buildPeers = (): number[][] => {
  const peerSets: Set<number>[] = Array.from({ length: CELLS }, () => new Set<number>());
  for (const unit of UNITS) {
    for (const a of unit) {
      for (const b of unit) {
        if (a !== b) peerSets[a]!.add(b);
      }
    }
  }
  return peerSets.map((s) => [...s].sort((a, b) => a - b));
};

/** For each cell, the 20 cells sharing a row, column, or box with it. */
export const PEERS: readonly (readonly number[])[] = buildPeers();

const BLANKS = new Set(['.', '0', '-']);

/**
 * Parse an 81-character grid string. Blanks may be '.', '0', or '-'
 * (sudoku-gen uses '-').
 */
export function parseGrid(text: string): CellValue[] {
  if (text.length !== CELLS) {
    throw new Error(`Expected an 81-character grid, got ${text.length} characters`);
  }
  return [...text].map((ch) => {
    if (BLANKS.has(ch)) return 0;
    const d = ch.charCodeAt(0) - 48;
    if (d < 1 || d > 9) throw new Error(`Invalid grid character: ${JSON.stringify(ch)}`);
    return d as CellValue;
  });
}

export function gridToString(values: readonly CellValue[]): string {
  return values.map((v) => (v === 0 ? '.' : String(v))).join('');
}
