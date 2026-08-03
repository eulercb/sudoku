import { describe, expect, it } from 'vitest';
import {
  ACTION_LOG_LIMIT,
  emptyActionStats,
  hydrateActionStats,
  recordAction,
  summarizeActions,
} from '../../src/game/actionLog';
import type { ActionStats } from '../../src/game/actionLog';

const play = (...entries: Parameters<typeof recordAction>[1][]): ActionStats =>
  entries.reduce(recordAction, emptyActionStats());

describe('action log', () => {
  it('starts empty, with every counter at zero', () => {
    const stats = emptyActionStats();
    expect(stats.log).toHaveLength(0);
    expect(summarizeActions(stats).total).toBe(0);
    expect(summarizeActions(stats).mistakes).toBe(0);
  });

  it('appends entries without mutating the previous record', () => {
    const before = emptyActionStats();
    const after = recordAction(before, { type: 'undo', at: 10 });
    expect(before.log).toHaveLength(0);
    expect(after.log).toEqual([{ type: 'undo', at: 10 }]);
    expect(after.counts.undo).toBe(1);
  });

  it('accumulates filled cells and wrong entries as they are recorded', () => {
    const stats = play(
      { type: 'place', at: 1, digit: 4, cells: 2, wrong: 1 },
      { type: 'place', at: 2, digit: 7, cells: 1, wrong: 0 },
      { type: 'hint', at: 3, digit: 9, cells: 1 },
      // Note edits touch cells but fill nothing.
      { type: 'note', at: 4, digit: 5, cells: 3 },
    );
    expect(stats.cellsFilled).toBe(4);
    expect(stats.wrongEntries).toBe(1);
  });

  it('summarizes every tracked action type', () => {
    const stats = play(
      { type: 'place', at: 1, digit: 1, cells: 1, wrong: 1 },
      { type: 'undo', at: 2 },
      { type: 'undo', at: 3 },
      { type: 'redo', at: 4 },
      { type: 'auto-notes', at: 5, cells: 40 },
      { type: 'hint', at: 6, cells: 1 },
      { type: 'check', at: 7 },
      { type: 'erase', at: 8, cells: 1 },
      { type: 'note', at: 9, digit: 2, cells: 1 },
      { type: 'clear-notes', at: 10 },
      { type: 'clear-board', at: 11 },
      { type: 'pencil', at: 12 },
      { type: 'pause', at: 13 },
      { type: 'resume', at: 14 },
    );
    const summary = summarizeActions(stats);
    expect(summary).toMatchObject({
      total: 14,
      numbers: 2,
      mistakes: 1,
      undos: 2,
      redos: 1,
      autoNotes: 1,
      hints: 1,
      checks: 1,
      erases: 1,
      noteEdits: 1,
      clearedNotes: 1,
      clearedBoard: 1,
      pencilToggles: 1,
      pauses: 1,
    });
  });

  it('caps the timeline but keeps the counters exact', () => {
    let stats = emptyActionStats();
    const total = ACTION_LOG_LIMIT + 25;
    for (let i = 0; i < total; i++) {
      stats = recordAction(stats, { type: 'place', at: i, cells: 1, wrong: 1 });
    }
    expect(stats.log).toHaveLength(ACTION_LOG_LIMIT);
    expect(stats.dropped).toBe(25);
    // The oldest entries rolled off the front, the newest are still there.
    expect(stats.log[0]!.at).toBe(25);
    expect(stats.log[stats.log.length - 1]!.at).toBe(total - 1);
    // Counters never under-report, whatever the log dropped.
    expect(summarizeActions(stats)).toMatchObject({
      total,
      numbers: total,
      mistakes: total,
    });
  });
});

describe('action log hydration', () => {
  it('returns an empty record for junk', () => {
    expect(hydrateActionStats(undefined)).toEqual(emptyActionStats());
    expect(hydrateActionStats(null)).toEqual(emptyActionStats());
    expect(hydrateActionStats('nope')).toEqual(emptyActionStats());
    expect(hydrateActionStats({ log: 'nope', counts: 7 })).toEqual(emptyActionStats());
  });

  it('round-trips a played record through JSON', () => {
    const stats = play(
      { type: 'place', at: 1, digit: 3, cells: 1, wrong: 1 },
      { type: 'undo', at: 2, cells: 1 },
    );
    expect(hydrateActionStats(JSON.parse(JSON.stringify(stats)))).toEqual(stats);
  });

  it('drops malformed entries and negative or unknown counters', () => {
    const restored = hydrateActionStats({
      log: [{ type: 'undo', at: 1 }, { type: 'teleport', at: 2 }, { at: 3 }, null, 'nope'],
      counts: { undo: 1, redo: -4, teleport: 99 },
      cellsFilled: 'lots',
      wrongEntries: 2,
      dropped: 0,
    });
    expect(restored.log).toEqual([{ type: 'undo', at: 1 }]);
    expect(restored.counts.undo).toBe(1);
    expect(restored.counts.redo).toBe(0);
    expect('teleport' in restored.counts).toBe(false);
    expect(restored.cellsFilled).toBe(0);
    expect(restored.wrongEntries).toBe(2);
  });
});
