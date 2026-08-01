import { describe, expect, it } from 'vitest';
import {
  clearAllNotes,
  clearBoard,
  eraseCells,
  fillAllCandidates,
  placeValue,
  revealCell,
  toggleMark,
} from '../../src/game/actions';
import { PEERS, cellIndex } from '../../src/game/board';
import { computeCandidates } from '../../src/game/candidates';
import { applyCommand } from '../../src/game/commands';
import { digitsToNotes, hasNote } from '../../src/game/notes';
import type { CellsState, Digit } from '../../src/game/types';
import { fixtureGivens } from '../fixtures';

const freshCells = (): CellsState => ({
  values: new Array(81).fill(0),
  corner: new Array(81).fill(0),
});

const allEditable = () => true;

describe('placeValue', () => {
  it('places a digit and clears the cell notes', () => {
    const cells = freshCells();
    cells.corner[0] = digitsToNotes([1, 2]);
    const command = placeValue(cells, [0], allEditable, 5, { autoRemovePeers: false })!;
    const next = applyCommand(cells, command);
    expect(next.values[0]).toBe(5);
    expect(next.corner[0]).toBe(0);
  });

  it('tap-again clears the same digit', () => {
    const cells = freshCells();
    cells.values[0] = 5;
    const command = placeValue(cells, [0], allEditable, 5, { autoRemovePeers: false })!;
    expect(applyCommand(cells, command).values[0]).toBe(0);
  });

  it('strips the digit from peer notes when autoRemovePeers is on', () => {
    const cells = freshCells();
    const target = cellIndex(4, 4);
    const peer = PEERS[target]![0]!;
    const nonPeer = 0; // (0,0) shares nothing with (4,4)
    cells.corner[peer] = digitsToNotes([7, 8]);
    cells.corner[nonPeer] = digitsToNotes([7]);

    const command = placeValue(cells, [target], allEditable, 7, { autoRemovePeers: true })!;
    const next = applyCommand(cells, command);
    expect(hasNote(next.corner[peer]!, 7)).toBe(false);
    expect(hasNote(next.corner[peer]!, 8)).toBe(true);
    expect(hasNote(next.corner[nonPeer]!, 7)).toBe(true);
  });

  it('leaves peer notes alone when autoRemovePeers is off', () => {
    const cells = freshCells();
    const target = cellIndex(4, 4);
    const peer = PEERS[target]![0]!;
    cells.corner[peer] = digitsToNotes([7]);
    const command = placeValue(cells, [target], allEditable, 7, { autoRemovePeers: false })!;
    expect(hasNote(applyCommand(cells, command).corner[peer]!, 7)).toBe(true);
  });

  it('skips non-editable cells and returns null if nothing changes', () => {
    const cells = freshCells();
    const command = placeValue(cells, [3], () => false, 5, { autoRemovePeers: false });
    expect(command).toBeNull();
  });
});

describe('toggleMark', () => {
  it('adds to all selected cells when any lacks the digit', () => {
    const cells = freshCells();
    cells.corner[1] = digitsToNotes([4]);
    const command = toggleMark(cells, [0, 1, 2], allEditable, 4)!;
    const next = applyCommand(cells, command);
    expect(hasNote(next.corner[0]!, 4)).toBe(true);
    expect(hasNote(next.corner[1]!, 4)).toBe(true);
    expect(hasNote(next.corner[2]!, 4)).toBe(true);
  });

  it('removes from all selected cells when every cell has the digit', () => {
    const cells = freshCells();
    cells.corner[0] = digitsToNotes([4]);
    cells.corner[1] = digitsToNotes([4, 5]);
    const command = toggleMark(cells, [0, 1], allEditable, 4)!;
    const next = applyCommand(cells, command);
    expect(hasNote(next.corner[0]!, 4)).toBe(false);
    expect(hasNote(next.corner[1]!, 4)).toBe(false);
    expect(hasNote(next.corner[1]!, 5)).toBe(true);
  });

  it('never marks cells that already hold a value', () => {
    const cells = freshCells();
    cells.values[0] = 9;
    const command = toggleMark(cells, [0, 1], allEditable, 4)!;
    const next = applyCommand(cells, command);
    expect(next.corner[0]).toBe(0);
    expect(hasNote(next.corner[1]!, 4)).toBe(true);
  });

  it('toggles a mark off again on a second pass', () => {
    const cells = freshCells();
    let command = toggleMark(cells, [0], allEditable, 4)!;
    let next = applyCommand(cells, command);
    expect(hasNote(next.corner[0]!, 4)).toBe(true);
    command = toggleMark(next, [0], allEditable, 4)!;
    next = applyCommand(next, command);
    expect(hasNote(next.corner[0]!, 4)).toBe(false);
  });
});

describe('eraseCells', () => {
  it('erases values first, then notes', () => {
    const cells = freshCells();
    cells.values[0] = 5;
    cells.corner[0] = digitsToNotes([1]);
    cells.corner[1] = digitsToNotes([2]);

    // Cell 0 has a value: erase clears only the value (notes were already
    // cleared on placement in practice). Cell 1 has only notes: they go.
    const command = eraseCells(cells, [0, 1], allEditable)!;
    const next = applyCommand(cells, command);
    expect(next.values[0]).toBe(0);
    expect(next.corner[1]).toBe(0);
  });

  it('returns null on empty untouched cells', () => {
    expect(eraseCells(freshCells(), [0, 1], allEditable)).toBeNull();
  });
});

describe('fillAllCandidates / clearAllNotes / clearBoard', () => {
  it('fills every empty cell with its computed candidates as corner marks', () => {
    const cells: CellsState = { ...freshCells(), values: fixtureGivens() };
    const command = fillAllCandidates(cells)!;
    const next = applyCommand(cells, command);
    const expected = computeCandidates(cells.values);
    for (let i = 0; i < 81; i++) {
      if (cells.values[i] === 0) expect(next.corner[i]).toBe(expected[i]);
      else expect(next.corner[i]).toBe(0);
    }
  });

  it('clearAllNotes wipes every mark and keeps values', () => {
    const cells = freshCells();
    cells.values[0] = 3;
    cells.corner[1] = digitsToNotes([1]);
    cells.corner[2] = digitsToNotes([2]);
    const next = applyCommand(cells, clearAllNotes(cells)!);
    expect(next.values[0]).toBe(3);
    expect(next.corner[1]).toBe(0);
    expect(next.corner[2]).toBe(0);
  });

  it('clearBoard resets editable cells only', () => {
    const givens = fixtureGivens();
    const cells: CellsState = { ...freshCells(), values: givens.slice() };
    const emptyIndex = givens.indexOf(0);
    cells.values[emptyIndex] = 5;
    const next = applyCommand(
      cells,
      clearBoard(cells, (i) => givens[i] === 0)!,
    );
    expect(next.values[emptyIndex]).toBe(0);
    expect(next.values).toEqual(givens.map((v, i) => (givens[i] === 0 ? 0 : v)));
  });
});

describe('revealCell', () => {
  it('places the solution digit and honors autoRemovePeers', () => {
    const cells = freshCells();
    const target = 40;
    const peer = PEERS[target]![3]!;
    cells.corner[peer] = digitsToNotes([6]);
    const command = revealCell(cells, target, 6 as Digit, { autoRemovePeers: true })!;
    const next = applyCommand(cells, command);
    expect(next.values[target]).toBe(6);
    expect(next.corner[peer]).toBe(0);
  });
});
