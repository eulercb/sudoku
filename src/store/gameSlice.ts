import type { Command } from '../game/commands';
import type { CellsState, CellValue, Digit, Tier } from '../game/types';

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
  mistakes: 0,
  hintsUsed: 0,
  status: 'idle',
  checkFlagged: [],
  winDismissed: false,
});

/** Fields worth persisting; selection and armed input are transient. */
export type PersistedGame = Omit<
  GameState,
  'selection' | 'armedDigit' | 'armedErase' | 'checkFlagged'
>;

export function toPersistedGame(game: GameState): PersistedGame {
  const { selection: _s, armedDigit: _d, armedErase: _e, checkFlagged: _c, ...rest } = game;
  return rest;
}

export function fromPersistedGame(persisted: unknown): GameState | null {
  if (!persisted || typeof persisted !== 'object') return null;
  const p = persisted as Partial<PersistedGame>;
  if (
    !p.puzzleId ||
    !p.cells ||
    !Array.isArray(p.givens) ||
    p.givens.length !== 81 ||
    !Array.isArray(p.solution) ||
    p.solution.length !== 81 ||
    !Array.isArray(p.cells.values) ||
    p.cells.values.length !== 81
  ) {
    return null;
  }
  const base = emptyGame();
  const game: GameState = {
    ...base,
    ...p,
    selection: [],
    armedDigit: null,
    armedErase: false,
    checkFlagged: [],
  };
  // A game persisted mid-play resumes paused so the player re-enters calmly.
  if (game.status === 'playing') game.status = 'paused';
  return game;
}
