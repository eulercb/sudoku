import type { Command } from '../game/commands';
import type { CellsState, CellValue, Digit, Tier } from '../game/types';
import { TIERS } from '../game/types';

export type NoteMode = 'off' | 'corner' | 'center';
export type NoteKind = 'corner' | 'center';
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
  /** Remembered pencil submode so the toggle returns to it. */
  lastNoteKind: NoteKind;
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
  status: GameStatus;
  /** Cells flagged by an explicit "check" action; cleared on next edit. */
  checkFlagged: number[];
  winDismissed: boolean;
}

export const HISTORY_LIMIT = 500;

const EMPTY_BOARD: CellValue[] = new Array<CellValue>(81).fill(0);

export const emptyCells = (): CellsState => ({
  values: EMPTY_BOARD.slice(),
  corner: new Array<number>(81).fill(0),
  center: new Array<number>(81).fill(0),
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
  lastNoteKind: 'corner',
  armedDigit: null,
  armedErase: false,
  elapsedMs: 0,
  lastTickAt: null,
  mistakes: 0,
  hintsUsed: 0,
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
const NOTE_MODES: readonly NoteMode[] = ['off', 'corner', 'center'];

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
    !isMaskArray(p.cells.center) ||
    !isCommandArray(p.past) ||
    !isCommandArray(p.future) ||
    typeof p.elapsedMs !== 'number' ||
    !Number.isFinite(p.elapsedMs) ||
    typeof p.mistakes !== 'number' ||
    typeof p.hintsUsed !== 'number' ||
    !STATUSES.includes(p.status as GameStatus) ||
    !NOTE_MODES.includes(p.noteMode as NoteMode)
  ) {
    return null;
  }
  const base = emptyGame();
  const game: GameState = {
    ...base,
    ...p,
    lastNoteKind: p.lastNoteKind === 'center' ? 'center' : 'corner',
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
