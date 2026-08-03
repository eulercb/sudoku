import type { ActionStats } from '../game/actionLog';
import { emptyActionStats, hydrateActionStats } from '../game/actionLog';
import type { CellSnapshot, Command } from '../game/commands';
import type { CellsState, CellValue, Digit, Tier } from '../game/types';
import { TIERS } from '../game/types';

/** Pencil marks are corner (Snyder) marks only; the pencil is a plain toggle. */
export type NoteMode = 'off' | 'corner';
export type GameStatus = 'idle' | 'playing' | 'paused' | 'won';

export interface GameState {
  puzzleId: string | null;
  tier: Tier;
  /** 0 where the cell is not a given; givens are immutable. */
  givens: CellValue[];
  solution: CellValue[];
  cells: CellsState;
  past: Command[];
  future: Command[];
  /** Selected cell indices; the last one is the keyboard cursor anchor. */
  selection: number[];
  noteMode: NoteMode;
  /** Digit armed in number-first input mode. */
  armedDigit: Digit | null;
  armedErase: boolean;
  elapsedMs: number;
  /**
   * performance.now() of the last timer fold while playing, or null when the
   * clock is not accruing. Transitions out of 'playing' fold the pending
   * fraction into elapsedMs so no in-flight time is lost.
   */
  lastTickAt: number | null;
  mistakes: number;
  hintsUsed: number;
  /**
   * Net undo depth below the furthest point reached: +1 per undo, −1 per redo,
   * back to 0 on any new move. `settings.undoLimit` caps it; the history stays
   * whole either way.
   */
  undoStreak: number;
  /** Everything the player did this game, for the post-game report. */
  actionStats: ActionStats;
  status: GameStatus;
  /** Cells flagged by an explicit "check" action; cleared on next edit. */
  checkFlagged: number[];
  winDismissed: boolean;
}

export const HISTORY_LIMIT = 500;

/**
 * Is another undo available? `undoLimit` of 0 means unlimited; any other value
 * caps how far below the furthest point the player may step before making a
 * move. Nothing is dropped from `past` either way.
 */
export const canUndo = (game: GameState, undoLimit: number): boolean =>
  game.past.length > 0 && (undoLimit === 0 || game.undoStreak < undoLimit);

const EMPTY_BOARD: CellValue[] = new Array<CellValue>(81).fill(0);

export const emptyCells = (): CellsState => ({
  values: EMPTY_BOARD.slice(),
  corner: new Array<number>(81).fill(0),
});

export const emptyGame = (): GameState => ({
  puzzleId: null,
  tier: 'easy',
  givens: EMPTY_BOARD.slice(),
  solution: EMPTY_BOARD.slice(),
  cells: emptyCells(),
  past: [],
  future: [],
  selection: [],
  noteMode: 'off',
  armedDigit: null,
  armedErase: false,
  elapsedMs: 0,
  lastTickAt: null,
  mistakes: 0,
  hintsUsed: 0,
  undoStreak: 0,
  actionStats: emptyActionStats(),
  status: 'idle',
  checkFlagged: [],
  winDismissed: false,
});

/** Fields worth persisting; selection, armed input and the tick anchor are transient. */
export type PersistedGame = Omit<
  GameState,
  'selection' | 'armedDigit' | 'armedErase' | 'checkFlagged' | 'lastTickAt'
>;

export function toPersistedGame(game: GameState): PersistedGame {
  const {
    selection: _s,
    armedDigit: _d,
    armedErase: _e,
    checkFlagged: _c,
    lastTickAt: _t,
    ...rest
  } = game;
  return rest;
}

const isCellValueArray = (a: unknown): a is CellValue[] =>
  Array.isArray(a) && a.length === 81 && a.every((v) => typeof v === 'number' && v >= 0 && v <= 9);

const isMaskArray = (a: unknown): a is number[] =>
  Array.isArray(a) && a.length === 81 && a.every((v) => typeof v === 'number');

const isCommandArray = (a: unknown): a is Command[] =>
  Array.isArray(a) &&
  a.every((c) => c && typeof c === 'object' && Array.isArray((c as Partial<Command>).patches));

const STATUSES: readonly GameStatus[] = ['idle', 'playing', 'paused', 'won'];
/** 'center' is a retired mode kept here so older saves still hydrate. */
const NOTE_MODES: readonly string[] = ['off', 'corner', 'center'];

/**
 * Saves written before center marks were retired carry a parallel `center`
 * mask per cell (on the board and inside every history snapshot). Fold those
 * marks into the corner mask so nothing the player noted is lost and undo
 * stays an exact inverse.
 */
function mergeLegacyCenter(cells: CellsState & { center?: unknown }): CellsState {
  const legacy = cells.center;
  if (!isMaskArray(legacy)) return { values: cells.values, corner: cells.corner };
  return {
    values: cells.values,
    corner: cells.corner.map((mask, i) => mask | legacy[i]!),
  };
}

function mergeLegacyCenterInCommands(commands: Command[]): Command[] {
  const fold = (snap: CellSnapshot & { center?: unknown }): CellSnapshot => ({
    value: snap.value,
    corner: snap.corner | (typeof snap.center === 'number' ? snap.center : 0),
  });
  return commands.map((command) => ({
    patches: command.patches.map((patch) => ({
      index: patch.index,
      before: fold(patch.before),
      after: fold(patch.after),
    })),
  }));
}

/**
 * Rebuild a GameState from an untrusted persisted record. Anything
 * structurally off (corrupted write, future schema) yields null and the
 * app starts fresh instead of crashing on first input.
 */
export function fromPersistedGame(persisted: unknown): GameState | null {
  if (!persisted || typeof persisted !== 'object') return null;
  const p = persisted as Partial<PersistedGame>;
  if (
    !p.puzzleId ||
    typeof p.puzzleId !== 'string' ||
    !TIERS.includes(p.tier as Tier) ||
    !isCellValueArray(p.givens) ||
    !isCellValueArray(p.solution) ||
    !p.cells ||
    !isCellValueArray(p.cells.values) ||
    !isMaskArray(p.cells.corner) ||
    !isCommandArray(p.past) ||
    !isCommandArray(p.future) ||
    typeof p.elapsedMs !== 'number' ||
    !Number.isFinite(p.elapsedMs) ||
    typeof p.mistakes !== 'number' ||
    typeof p.hintsUsed !== 'number' ||
    !STATUSES.includes(p.status as GameStatus) ||
    !NOTE_MODES.includes(p.noteMode as string)
  ) {
    return null;
  }
  const base = emptyGame();
  const game: GameState = {
    ...base,
    ...p,
    cells: mergeLegacyCenter(p.cells),
    past: mergeLegacyCenterInCommands(p.past),
    future: mergeLegacyCenterInCommands(p.future),
    // The retired 'center' submode lands on the one pencil mode that is left.
    noteMode: p.noteMode === 'off' ? 'off' : 'corner',
    undoStreak:
      typeof p.undoStreak === 'number' && Number.isFinite(p.undoStreak) && p.undoStreak > 0
        ? Math.floor(p.undoStreak)
        : 0,
    // Saves written before action tracking simply start their log here.
    actionStats: hydrateActionStats(p.actionStats),
    winDismissed: p.winDismissed === true,
    selection: [],
    armedDigit: null,
    armedErase: false,
    checkFlagged: [],
    lastTickAt: null,
  };
  // A game persisted mid-play resumes paused so the player re-enters calmly.
  if (game.status === 'playing') game.status = 'paused';
  return game;
}
