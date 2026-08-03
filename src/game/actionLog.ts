import type { Digit } from './types';

/**
 * A running record of everything the player does in a game, kept so the
 * post-game report can be honest about how the puzzle was solved (undos,
 * hints, Auto clicks, wrong entries…).
 *
 * It is a per-game artifact: reset with the puzzle, persisted alongside it,
 * and — like everything else here — never leaves the device.
 */

export const ACTION_TYPES = [
  'place',
  'note',
  'erase',
  'undo',
  'redo',
  'hint',
  'check',
  'auto-notes',
  'clear-notes',
  'clear-board',
  'pencil',
  'pause',
  'resume',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export interface ActionEntry {
  type: ActionType;
  /** Game clock in ms when it happened — pause-aware, never a wall clock. */
  at: number;
  /** The digit involved, for placements and pencil marks. */
  digit?: Digit;
  /** How many cells the action changed. */
  cells?: number;
  /** Of those, how many disagreed with the solution. */
  wrong?: number;
}

/**
 * The timeline is capped so a marathon session cannot grow the save without
 * bound. The counters beside it are accumulated on write and never evicted,
 * so the post-game numbers stay exact even if old entries roll off.
 */
export const ACTION_LOG_LIMIT = 2000;

export interface ActionStats {
  /** The timeline, oldest first, capped at ACTION_LOG_LIMIT entries. */
  log: ActionEntry[];
  /** Exact per-type totals, unaffected by log eviction. */
  counts: Record<ActionType, number>;
  /** Cells given a digit, by hand or by a revealed hint. */
  cellsFilled: number;
  /** Of those, how many contradicted the solution when entered. */
  wrongEntries: number;
  /** Entries evicted from the head of the log. */
  dropped: number;
}

const zeroCounts = (): Record<ActionType, number> =>
  Object.fromEntries(ACTION_TYPES.map((type) => [type, 0])) as Record<ActionType, number>;

export const emptyActionStats = (): ActionStats => ({
  log: [],
  counts: zeroCounts(),
  cellsFilled: 0,
  wrongEntries: 0,
  dropped: 0,
});

/** Types that put a digit on the board, and so feed `cellsFilled`. */
const FILLING: readonly ActionType[] = ['place', 'hint'];

/** Append one action. Pure: returns a new record, never mutates. */
export function recordAction(stats: ActionStats, entry: ActionEntry): ActionStats {
  const log = [...stats.log, entry];
  const overflow = Math.max(0, log.length - ACTION_LOG_LIMIT);
  return {
    log: overflow > 0 ? log.slice(overflow) : log,
    counts: { ...stats.counts, [entry.type]: (stats.counts[entry.type] ?? 0) + 1 },
    cellsFilled: stats.cellsFilled + (FILLING.includes(entry.type) ? (entry.cells ?? 0) : 0),
    wrongEntries: stats.wrongEntries + (entry.wrong ?? 0),
    dropped: stats.dropped + overflow,
  };
}

/** The display-ready shape the post-game report reads. */
export interface ActionSummary {
  /** Every logged action, whatever its kind. */
  total: number;
  /** Cells filled with a digit. */
  numbers: number;
  /** Entries that contradicted the solution when made. */
  mistakes: number;
  noteEdits: number;
  erases: number;
  undos: number;
  redos: number;
  hints: number;
  checks: number;
  autoNotes: number;
  clearedNotes: number;
  clearedBoard: number;
  pencilToggles: number;
  pauses: number;
}

export function summarizeActions(stats: ActionStats): ActionSummary {
  const c = stats.counts;
  return {
    total: ACTION_TYPES.reduce((n, type) => n + (c[type] ?? 0), 0),
    numbers: stats.cellsFilled,
    mistakes: stats.wrongEntries,
    noteEdits: c.note ?? 0,
    erases: c.erase ?? 0,
    undos: c.undo ?? 0,
    redos: c.redo ?? 0,
    hints: c.hint ?? 0,
    checks: c.check ?? 0,
    autoNotes: c['auto-notes'] ?? 0,
    clearedNotes: c['clear-notes'] ?? 0,
    clearedBoard: c['clear-board'] ?? 0,
    pencilToggles: c.pencil ?? 0,
    pauses: c.pause ?? 0,
  };
}

const isPositiveNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

const isEntry = (v: unknown): v is ActionEntry =>
  !!v &&
  typeof v === 'object' &&
  ACTION_TYPES.includes((v as ActionEntry).type) &&
  isPositiveNumber((v as ActionEntry).at);

/** Rebuild from an untrusted persisted record; anything odd falls back to 0. */
export function hydrateActionStats(persisted: unknown): ActionStats {
  const out = emptyActionStats();
  if (!persisted || typeof persisted !== 'object') return out;
  const p = persisted as Partial<ActionStats>;

  if (Array.isArray(p.log)) out.log = p.log.filter(isEntry).slice(-ACTION_LOG_LIMIT);
  if (p.counts && typeof p.counts === 'object') {
    for (const type of ACTION_TYPES) {
      const n = (p.counts as Record<string, unknown>)[type];
      if (isPositiveNumber(n)) out.counts[type] = n;
    }
  }
  for (const key of ['cellsFilled', 'wrongEntries', 'dropped'] as const) {
    if (isPositiveNumber(p[key])) out[key] = p[key];
  }
  return out;
}
