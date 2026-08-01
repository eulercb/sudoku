import type { CellsState, CellValue } from './types';

/**
 * Undo/redo is a history of patch-based commands. Every mutating action
 * (place, erase, note edit, fill notes, clear, hint…) captures, per touched
 * cell, the full before/after snapshot, so undo and redo are exact inverses
 * regardless of which settings produced the change.
 */

export interface CellSnapshot {
  value: CellValue;
  corner: number;
}

export interface CellPatch {
  index: number;
  before: CellSnapshot;
  after: CellSnapshot;
}

export interface Command {
  patches: CellPatch[];
}

export const snapshotAt = (cells: CellsState, index: number): CellSnapshot => ({
  value: cells.values[index]!,
  corner: cells.corner[index]!,
});

const sameSnapshot = (a: CellSnapshot, b: CellSnapshot): boolean =>
  a.value === b.value && a.corner === b.corner;

/**
 * Collects patches for one command. Later writes to the same cell merge into
 * one patch (keeping the original `before`), so a command stays a set of
 * per-cell before/after pairs.
 */
export class PatchBuilder {
  private patches = new Map<number, CellPatch>();

  constructor(private readonly base: CellsState) {}

  private entry(index: number): CellPatch {
    let patch = this.patches.get(index);
    if (!patch) {
      const before = snapshotAt(this.base, index);
      patch = { index, before, after: { ...before } };
      this.patches.set(index, patch);
    }
    return patch;
  }

  current(index: number): CellSnapshot {
    const patch = this.patches.get(index);
    return patch ? patch.after : snapshotAt(this.base, index);
  }

  set(index: number, change: Partial<CellSnapshot>): void {
    const patch = this.entry(index);
    patch.after = { ...patch.after, ...change };
  }

  /** The finished command, or null if nothing actually changed. */
  build(): Command | null {
    const patches = [...this.patches.values()].filter((p) => !sameSnapshot(p.before, p.after));
    return patches.length > 0 ? { patches } : null;
  }
}

const applyPatches = (cells: CellsState, command: Command, dir: 'after' | 'before'): CellsState => {
  const values = cells.values.slice();
  const corner = cells.corner.slice();
  for (const patch of command.patches) {
    const snap = patch[dir];
    values[patch.index] = snap.value;
    corner[patch.index] = snap.corner;
  }
  return { values, corner };
};

export const applyCommand = (cells: CellsState, command: Command): CellsState =>
  applyPatches(cells, command, 'after');

export const revertCommand = (cells: CellsState, command: Command): CellsState =>
  applyPatches(cells, command, 'before');
