import { describe, expect, it } from 'vitest';
import { PatchBuilder, applyCommand, revertCommand } from '../../src/game/commands';
import { digitsToNotes } from '../../src/game/notes';
import type { CellsState } from '../../src/game/types';

const freshCells = (): CellsState => ({
  values: new Array(81).fill(0),
  corner: new Array(81).fill(0),
  center: new Array(81).fill(0),
});

describe('PatchBuilder', () => {
  it('returns null when nothing changed', () => {
    const cells = freshCells();
    const builder = new PatchBuilder(cells);
    expect(builder.build()).toBeNull();
    builder.set(0, { value: 0 }); // same as before
    expect(builder.build()).toBeNull();
  });

  it('merges repeated writes to one cell into a single patch', () => {
    const cells = freshCells();
    const builder = new PatchBuilder(cells);
    builder.set(4, { value: 3 });
    builder.set(4, { value: 7 });
    builder.set(4, { corner: digitsToNotes([1]) });
    const command = builder.build()!;
    expect(command.patches).toHaveLength(1);
    expect(command.patches[0]!.before).toEqual({ value: 0, corner: 0, center: 0 });
    expect(command.patches[0]!.after).toEqual({ value: 7, corner: digitsToNotes([1]), center: 0 });
  });

  it('reads through pending writes with current()', () => {
    const cells = freshCells();
    const builder = new PatchBuilder(cells);
    expect(builder.current(9).value).toBe(0);
    builder.set(9, { value: 5 });
    expect(builder.current(9).value).toBe(5);
  });
});

describe('apply / revert', () => {
  it('round-trips: revert(apply(x)) === x', () => {
    const cells = freshCells();
    cells.values[10] = 4;
    cells.center[11] = digitsToNotes([2, 3]);

    const builder = new PatchBuilder(cells);
    builder.set(10, { value: 0 });
    builder.set(11, { center: 0, corner: digitsToNotes([9]) });
    builder.set(12, { value: 8 });
    const command = builder.build()!;

    const applied = applyCommand(cells, command);
    expect(applied.values[10]).toBe(0);
    expect(applied.corner[11]).toBe(digitsToNotes([9]));
    expect(applied.values[12]).toBe(8);

    const reverted = revertCommand(applied, command);
    expect(reverted).toEqual(cells);
  });

  it('does not mutate its input', () => {
    const cells = freshCells();
    const builder = new PatchBuilder(cells);
    builder.set(0, { value: 1 });
    const command = builder.build()!;
    applyCommand(cells, command);
    expect(cells.values[0]).toBe(0);
  });
});
