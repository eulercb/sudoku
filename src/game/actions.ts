import { PEERS } from './board';
import { computeCandidates } from './candidates';
import type { Command } from './commands';
import { PatchBuilder } from './commands';
import { addNote, EMPTY_NOTES, hasNote, removeNote } from './notes';
import type { CellsState, Digit } from './types';

/**
 * Pure builders for every mutating gameplay action. Each returns a Command
 * (or null when the action is a no-op) that the store pushes onto the
 * history stack — the store itself never mutates cells directly.
 */

export interface PlaceOptions {
  /** Strip the placed digit from peers' pencil marks (setting). */
  autoRemovePeers: boolean;
}

/** Place a digit in every editable selected cell (tap-again-to-clear per cell). */
export function placeValue(
  cells: CellsState,
  selection: readonly number[],
  editable: (i: number) => boolean,
  digit: Digit,
  options: PlaceOptions,
): Command | null {
  const builder = new PatchBuilder(cells);
  for (const i of selection) {
    if (!editable(i)) continue;
    if (builder.current(i).value === digit) {
      builder.set(i, { value: 0 });
      continue;
    }
    builder.set(i, { value: digit, corner: EMPTY_NOTES, center: EMPTY_NOTES });
    if (options.autoRemovePeers) {
      for (const p of PEERS[i]!) {
        const snap = builder.current(p);
        if (snap.value !== 0) continue;
        if (hasNote(snap.corner, digit) || hasNote(snap.center, digit)) {
          builder.set(p, {
            corner: removeNote(snap.corner, digit),
            center: removeNote(snap.center, digit),
          });
        }
      }
    }
  }
  return builder.build();
}

/**
 * Toggle a pencil mark across the selection. If the digit is present in every
 * eligible cell it is removed everywhere, otherwise added everywhere — the
 * standard multi-cell semantics. Cells with a value are skipped.
 */
export function toggleMark(
  cells: CellsState,
  selection: readonly number[],
  editable: (i: number) => boolean,
  digit: Digit,
  kind: 'corner' | 'center',
): Command | null {
  const builder = new PatchBuilder(cells);
  const targets = selection.filter((i) => editable(i) && builder.current(i).value === 0);
  if (targets.length === 0) return null;
  const everyHas = targets.every((i) => hasNote(builder.current(i)[kind], digit));
  for (const i of targets) {
    const mask = builder.current(i)[kind];
    const next = everyHas ? removeNote(mask, digit) : addNote(mask, digit);
    builder.set(i, { [kind]: next });
  }
  return builder.build();
}

/**
 * Erase across the selection. Cells with a value lose the value; cells with
 * only notes lose their notes.
 */
export function eraseCells(
  cells: CellsState,
  selection: readonly number[],
  editable: (i: number) => boolean,
): Command | null {
  const builder = new PatchBuilder(cells);
  for (const i of selection) {
    if (!editable(i)) continue;
    const snap = builder.current(i);
    if (snap.value !== 0) {
      builder.set(i, { value: 0 });
    } else {
      builder.set(i, { corner: EMPTY_NOTES, center: EMPTY_NOTES });
    }
  }
  return builder.build();
}

/** Fill every empty cell's center marks with its computed candidates. */
export function fillAllCandidates(cells: CellsState): Command | null {
  const builder = new PatchBuilder(cells);
  const candidates = computeCandidates(cells.values);
  for (let i = 0; i < candidates.length; i++) {
    if (cells.values[i] === 0) builder.set(i, { center: candidates[i]! });
  }
  return builder.build();
}

/** Clear all pencil marks everywhere. */
export function clearAllNotes(cells: CellsState): Command | null {
  const builder = new PatchBuilder(cells);
  for (let i = 0; i < cells.values.length; i++) {
    builder.set(i, { corner: EMPTY_NOTES, center: EMPTY_NOTES });
  }
  return builder.build();
}

/** Reset every non-given cell to empty (restart puzzle keeps the same board). */
export function clearBoard(cells: CellsState, editable: (i: number) => boolean): Command | null {
  const builder = new PatchBuilder(cells);
  for (let i = 0; i < cells.values.length; i++) {
    if (editable(i)) builder.set(i, { value: 0, corner: EMPTY_NOTES, center: EMPTY_NOTES });
  }
  return builder.build();
}

/** Reveal the solution digit in one cell (the reveal-a-cell hint). */
export function revealCell(
  cells: CellsState,
  index: number,
  solutionDigit: Digit,
  options: PlaceOptions,
): Command | null {
  return placeValueAt(cells, index, solutionDigit, options);
}

function placeValueAt(
  cells: CellsState,
  index: number,
  digit: Digit,
  options: PlaceOptions,
): Command | null {
  const builder = new PatchBuilder(cells);
  builder.set(index, { value: digit, corner: EMPTY_NOTES, center: EMPTY_NOTES });
  if (options.autoRemovePeers) {
    for (const p of PEERS[index]!) {
      const snap = builder.current(p);
      if (snap.value !== 0) continue;
      builder.set(p, {
        corner: removeNote(snap.corner, digit),
        center: removeNote(snap.center, digit),
      });
    }
  }
  return builder.build();
}
