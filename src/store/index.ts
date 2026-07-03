import { create } from 'zustand';
import {
  clearAllNotes,
  clearBoard as buildClearBoard,
  eraseCells,
  fillAllCandidates,
  placeValue,
  revealCell,
  toggleMark,
} from '../game/actions';
import { CELLS, colOf, rowOf, cellIndex } from '../game/board';
import { findConflicts, findMistakes, isSolved } from '../game/checks';
import type { Command } from '../game/commands';
import { applyCommand, revertCommand } from '../game/commands';
import type { Digit, Tier } from '../game/types';
import { newPuzzle } from '../puzzles';
import { vibrate } from '../pwa/haptics';
import type { GameState, NoteMode } from './gameSlice';
import { emptyGame, fromPersistedGame, HISTORY_LIMIT } from './gameSlice';
import type { SettingsState } from './settingsSlice';
import { DEFAULT_SETTINGS, hydrateSettings } from './settingsSlice';
import type { StatsState } from './statsSlice';
import { emptyStats, hydrateStats, recordStart, recordWin } from './statsSlice';

export type SheetName = 'none' | 'menu' | 'settings' | 'stats' | 'newGame';

export interface HydrationData {
  game?: unknown;
  settings?: unknown;
  stats?: unknown;
}

export interface Store {
  game: GameState;
  settings: SettingsState;
  stats: StatsState;
  openSheet: SheetName;
  hydrated: boolean;

  // Lifecycle
  hydrate(data: HydrationData): void;
  newGame(tier: Tier): void;
  restartPuzzle(): void;
  pause(): void;
  resume(): void;
  dismissWin(): void;

  // Timer: start anchors the clock, tick folds elapsed time, stop folds and
  // releases. Transitions out of 'playing' fold pending time themselves.
  timerStart(): void;
  timerTick(): void;
  timerStop(): void;

  // Selection & input
  selectCell(index: number, mode?: 'replace' | 'append' | 'toggle'): void;
  clearSelection(): void;
  moveCursor(dRow: number, dCol: number, extend?: boolean): void;
  setNoteMode(mode: NoteMode): void;
  togglePencil(): void;
  armDigit(digit: Digit): void;
  toggleArmedErase(): void;
  tapCell(index: number, additive?: boolean): void;
  padDigit(digit: Digit): void;
  /** The pad/controls erase button: arms the eraser in number-first mode. */
  padErase(): void;
  applyDigit(digit: Digit): void;
  erase(): void;
  undo(): void;
  redo(): void;

  // Assists
  fillNotes(): void;
  clearNotes(): void;
  clearBoard(): void;
  hint(): void;
  checkNow(): void;

  // Settings, stats & UI
  setSetting<K extends keyof SettingsState>(key: K, value: SettingsState[K]): void;
  resetStats(): void;
  setOpenSheet(sheet: SheetName): void;
}

const isEditable = (game: GameState, index: number): boolean => game.givens[index] === 0;

/** Fold the in-flight fraction of a second into elapsedMs. */
const foldElapsed = (game: GameState): number =>
  game.status === 'playing' && game.lastTickAt !== null
    ? game.elapsedMs + Math.max(0, performance.now() - game.lastTickAt)
    : game.elapsedMs;

interface CommitMeta {
  /** Set when the command placed this digit into these cells as values. */
  placed?: { digit: Digit; indices: number[] };
  countsAsHint?: boolean;
}

export const useStore = create<Store>()((set, get) => {
  /** Apply a command: history, mistake counting, haptics, win detection. */
  const commit = (command: Command, meta: CommitMeta = {}): void => {
    const { game, settings, stats } = get();
    const cells = applyCommand(game.cells, command);
    const past = [...game.past, command].slice(-HISTORY_LIMIT);

    let mistakes = game.mistakes;
    let wrong = false;
    if (meta.placed && settings.mistakeChecking === 'warn') {
      for (const patch of command.patches) {
        if (
          patch.after.value === meta.placed.digit &&
          patch.before.value !== patch.after.value &&
          meta.placed.indices.includes(patch.index) &&
          game.solution[patch.index] !== patch.after.value
        ) {
          mistakes += 1;
          wrong = true;
        }
      }
    }

    let conflicted = false;
    if (meta.placed && settings.conflictHighlight === 'on-error') {
      const conflicts = findConflicts(cells.values);
      conflicted = meta.placed.indices.some((i) => conflicts.has(i));
    }

    const won = game.status === 'playing' && isSolved(cells.values, game.solution);
    const elapsedMs = won ? foldElapsed(game) : game.elapsedMs;

    let nextStats: StatsState = stats;
    if (won) {
      nextStats = recordWin(stats, game.tier, elapsedMs, new Date());
    }

    // An armed digit whose ninth copy just landed disappears from the pad
    // (when hide-completed is on) — disarm it so taps don't silently place it.
    let armedDigit = game.armedDigit;
    if (
      armedDigit !== null &&
      settings.removeCompletedDigits &&
      cells.values.filter((v) => v === armedDigit).length >= 9
    ) {
      armedDigit = null;
    }

    set({
      game: {
        ...game,
        cells,
        past,
        future: [],
        mistakes,
        armedDigit,
        elapsedMs,
        lastTickAt: won ? null : game.lastTickAt,
        hintsUsed: game.hintsUsed + (meta.countsAsHint ? 1 : 0),
        checkFlagged: [],
        status: won ? 'won' : game.status,
      },
      stats: nextStats,
    });

    if (get().settings.haptics) {
      if (won) vibrate('win');
      else if (wrong || conflicted) vibrate('error');
    }
  };

  const applyDigitTo = (digit: Digit, targets: readonly number[]): void => {
    const { game, settings } = get();
    if (game.status !== 'playing' || targets.length === 0) return;
    const editable = (i: number) => isEditable(game, i);

    // Hand-edited pencil marks only exist in user-managed candidate mode;
    // with auto-candidates on, digits always place values (note mode is
    // forced off elsewhere, this is the safety net for stale state).
    if (game.noteMode !== 'off' && !settings.autoCandidates) {
      const command = toggleMark(game.cells, targets, editable, digit, game.noteMode);
      if (command) commit(command);
      return;
    }

    const command = placeValue(game.cells, targets, editable, digit, {
      autoRemovePeers: settings.autoRemovePeers && !settings.autoCandidates,
    });
    if (command) commit(command, { placed: { digit, indices: [...targets] } });
  };

  const eraseAt = (targets: readonly number[]): void => {
    const { game } = get();
    if (game.status !== 'playing' || targets.length === 0) return;
    const command = eraseCells(game.cells, targets, (i) => isEditable(game, i));
    if (command) commit(command);
  };

  return {
    game: emptyGame(),
    settings: DEFAULT_SETTINGS,
    stats: emptyStats(),
    openSheet: 'none',
    hydrated: false,

    hydrate(data) {
      const game = fromPersistedGame(data.game) ?? emptyGame();
      const settings = hydrateSettings(data.settings);
      // The two candidate modes never mix: auto-candidates implies no
      // hand-managed pencil mode.
      if (settings.autoCandidates) game.noteMode = 'off';
      set({
        game,
        settings,
        stats: hydrateStats(data.stats),
        hydrated: true,
      });
    },

    newGame(tier) {
      const puzzle = newPuzzle(tier);
      const base = emptyGame();
      set((state) => ({
        game: {
          ...base,
          puzzleId: puzzle.id,
          tier,
          givens: puzzle.givens,
          solution: puzzle.solution,
          cells: { ...base.cells, values: puzzle.givens.slice() },
          lastNoteKind: state.game.lastNoteKind,
          status: 'playing',
        },
        stats: recordStart(state.stats, tier),
        openSheet: 'none',
      }));
    },

    restartPuzzle() {
      const { game } = get();
      if (!game.puzzleId) return;
      set({
        game: {
          ...game,
          cells: {
            values: game.givens.slice(),
            corner: new Array<number>(CELLS).fill(0),
            center: new Array<number>(CELLS).fill(0),
          },
          past: [],
          future: [],
          elapsedMs: 0,
          lastTickAt: null,
          mistakes: 0,
          hintsUsed: 0,
          status: 'playing',
          checkFlagged: [],
          winDismissed: false,
        },
        openSheet: 'none',
      });
    },

    pause() {
      const { game } = get();
      if (game.status !== 'playing') return;
      set({
        game: { ...game, elapsedMs: foldElapsed(game), lastTickAt: null, status: 'paused' },
      });
    },

    resume() {
      const { game } = get();
      if (game.status === 'paused') {
        set({ game: { ...game, status: 'playing', lastTickAt: null } });
      }
    },

    timerStart() {
      const { game } = get();
      if (game.status !== 'playing') return;
      set({ game: { ...game, lastTickAt: performance.now() } });
    },

    timerTick() {
      const { game } = get();
      if (game.status !== 'playing') return;
      const now = performance.now();
      if (game.lastTickAt === null) {
        // Self-heal: the clock restarts on the next tick after e.g. restart.
        set({ game: { ...game, lastTickAt: now } });
        return;
      }
      set({
        game: {
          ...game,
          elapsedMs: game.elapsedMs + Math.max(0, now - game.lastTickAt),
          lastTickAt: now,
        },
      });
    },

    timerStop() {
      const { game } = get();
      if (game.lastTickAt === null) return;
      set({ game: { ...game, elapsedMs: foldElapsed(game), lastTickAt: null } });
    },

    dismissWin() {
      const { game } = get();
      if (game.status === 'won') set({ game: { ...game, winDismissed: true } });
    },

    selectCell(index, mode = 'replace') {
      const { game } = get();
      let selection: number[];
      if (mode === 'replace') {
        selection = [index];
      } else if (mode === 'toggle' && game.selection.includes(index)) {
        selection = game.selection.filter((i) => i !== index);
      } else {
        selection = [...game.selection.filter((i) => i !== index), index];
      }
      set({ game: { ...game, selection } });
    },

    clearSelection() {
      const { game } = get();
      if (game.selection.length > 0) set({ game: { ...game, selection: [] } });
    },

    moveCursor(dRow, dCol, extend = false) {
      const { game } = get();
      const cursor = game.selection[game.selection.length - 1] ?? cellIndex(4, 4);
      const row = Math.min(8, Math.max(0, rowOf(cursor) + dRow));
      const col = Math.min(8, Math.max(0, colOf(cursor) + dCol));
      const next = cellIndex(row, col);
      const selection = extend ? [...game.selection.filter((i) => i !== next), next] : [next];
      set({ game: { ...game, selection } });
    },

    setNoteMode(mode) {
      const { game, settings } = get();
      // Pencil modes don't exist while the app manages candidates.
      if (settings.autoCandidates && mode !== 'off') return;
      set({
        game: {
          ...game,
          noteMode: mode,
          lastNoteKind: mode === 'off' ? game.lastNoteKind : mode,
        },
      });
    },

    togglePencil() {
      const { game } = get();
      get().setNoteMode(game.noteMode === 'off' ? game.lastNoteKind : 'off');
    },

    armDigit(digit) {
      const { game } = get();
      set({
        game: {
          ...game,
          armedDigit: game.armedDigit === digit ? null : digit,
          armedErase: false,
        },
      });
    },

    toggleArmedErase() {
      const { game } = get();
      set({ game: { ...game, armedErase: !game.armedErase, armedDigit: null } });
    },

    tapCell(index, additive = false) {
      const { game, settings } = get();
      if (settings.inputMode === 'number-first' && game.status === 'playing' && !additive) {
        if (game.armedErase) {
          set({ game: { ...get().game, selection: [index] } });
          eraseAt([index]);
          return;
        }
        if (game.armedDigit !== null) {
          set({ game: { ...get().game, selection: [index] } });
          applyDigitTo(game.armedDigit, [index]);
          return;
        }
      }
      get().selectCell(index, additive ? 'toggle' : 'replace');
    },

    padDigit(digit) {
      const { settings } = get();
      if (settings.inputMode === 'number-first') {
        get().armDigit(digit);
      } else {
        get().applyDigit(digit);
      }
    },

    padErase() {
      const { settings } = get();
      if (settings.inputMode === 'number-first') {
        // The erase button is an armable tool in number-first mode; a second
        // press always disarms it.
        get().toggleArmedErase();
      } else {
        eraseAt(get().game.selection);
      }
    },

    applyDigit(digit) {
      applyDigitTo(digit, get().game.selection);
    },

    erase() {
      eraseAt(get().game.selection);
    },

    undo() {
      const { game } = get();
      if (game.status !== 'playing' || game.past.length === 0) return;
      const command = game.past[game.past.length - 1]!;
      set({
        game: {
          ...game,
          cells: revertCommand(game.cells, command),
          past: game.past.slice(0, -1),
          future: [command, ...game.future],
          checkFlagged: [],
        },
      });
    },

    redo() {
      const { game } = get();
      if (game.status !== 'playing' || game.future.length === 0) return;
      const command = game.future[0]!;
      const cells = applyCommand(game.cells, command);
      const won = isSolved(cells.values, game.solution);
      const elapsedMs = won ? foldElapsed(game) : game.elapsedMs;
      set({
        game: {
          ...game,
          cells,
          past: [...game.past, command],
          future: game.future.slice(1),
          checkFlagged: [],
          elapsedMs,
          lastTickAt: won ? null : game.lastTickAt,
          status: won ? 'won' : game.status,
        },
        ...(won ? { stats: recordWin(get().stats, game.tier, elapsedMs, new Date()) } : {}),
      });
      if (won && get().settings.haptics) vibrate('win');
    },

    fillNotes() {
      const { game, settings } = get();
      if (game.status !== 'playing' || settings.autoCandidates) return;
      const command = fillAllCandidates(game.cells);
      if (command) commit(command);
    },

    clearNotes() {
      const { game } = get();
      if (game.status !== 'playing') return;
      const command = clearAllNotes(game.cells);
      if (command) commit(command);
    },

    clearBoard() {
      const { game } = get();
      if (game.status !== 'playing') return;
      const command = buildClearBoard(game.cells, (i) => isEditable(game, i));
      if (command) commit(command);
    },

    hint() {
      const { game, settings } = get();
      if (game.status !== 'playing') return;
      if (settings.hintStyle === 'check-entries') {
        get().checkNow();
        set({ game: { ...get().game, hintsUsed: get().game.hintsUsed + 1 } });
        return;
      }

      const { cells, solution, selection } = game;
      const wrongOrEmpty = (i: number) => isEditable(game, i) && cells.values[i] !== solution[i];
      let target = selection.find(wrongOrEmpty);
      if (target === undefined) {
        const candidates: number[] = [];
        for (let i = 0; i < CELLS; i++) if (wrongOrEmpty(i)) candidates.push(i);
        if (candidates.length === 0) return;
        target = candidates[Math.floor(Math.random() * candidates.length)]!;
      }
      const digit = solution[target]! as Digit;
      const command = revealCell(cells, target, digit, {
        autoRemovePeers: settings.autoRemovePeers && !settings.autoCandidates,
      });
      if (command) {
        commit(command, { countsAsHint: true });
        set({ game: { ...get().game, selection: [target] } });
      }
    },

    checkNow() {
      const { game, settings } = get();
      if (game.status !== 'playing') return;
      const flagged = new Set<number>();
      // Solution-based checking is oracle information; a veteran who turned
      // mistake checking off gets rule conflicts only.
      if (settings.mistakeChecking !== 'off') {
        for (const i of findMistakes(game.cells.values, game.solution)) flagged.add(i);
      }
      if (settings.conflictHighlight !== 'off') {
        for (const i of findConflicts(game.cells.values)) flagged.add(i);
      }
      set({ game: { ...game, checkFlagged: [...flagged] } });
    },

    setSetting(key, value) {
      set((state) => {
        const settings = { ...state.settings, [key]: value };
        // Turning auto-candidates on retires any active pencil mode, so
        // digit entry never dead-ends (candidate modes never mix).
        if (key === 'autoCandidates' && value === true && state.game.noteMode !== 'off') {
          return { settings, game: { ...state.game, noteMode: 'off' } };
        }
        return { settings };
      });
    },

    resetStats() {
      set({ stats: emptyStats() });
    },

    setOpenSheet(sheet) {
      set({ openSheet: sheet });
    },
  };
});
