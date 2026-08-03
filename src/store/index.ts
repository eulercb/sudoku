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
import type { ActionEntry } from '../game/actionLog';
import { emptyActionStats, recordAction } from '../game/actionLog';
import { CELLS, colOf, rowOf, cellIndex } from '../game/board';
import { findConflicts, findMistakes, isSolved } from '../game/checks';
import type { Command } from '../game/commands';
import { applyCommand, revertCommand } from '../game/commands';
import type { Digit, Tier } from '../game/types';
import { newPuzzle } from '../puzzles';
import { vibrate } from '../pwa/haptics';
import type { GameState } from './gameSlice';
import { canUndo, emptyGame, fromPersistedGame, HISTORY_LIMIT } from './gameSlice';
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
  /** The Notes button: a plain on/off switch over corner pencil marks. */
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
  /** What to write to the action log; commit stamps the game clock on it. */
  action?: Omit<ActionEntry, 'at'>;
}

export const useStore = create<Store>()((set, get) => {
  /** Apply a command: history, mistake counting, haptics, win detection. */
  const commit = (command: Command, meta: CommitMeta = {}): void => {
    const { game, settings, stats } = get();
    const cells = applyCommand(game.cells, command);
    const past = [...game.past, command].slice(-HISTORY_LIMIT);

    // Cells this command actually filled, and how many of them contradict the
    // solution. The wrong count always accrues so the post-game report can be
    // honest; only warn mode surfaces it during play, so no oracle leaks.
    let filled = 0;
    let wrongCount = 0;
    if (meta.placed) {
      for (const patch of command.patches) {
        if (
          patch.after.value !== meta.placed.digit ||
          patch.before.value === patch.after.value ||
          !meta.placed.indices.includes(patch.index)
        ) {
          continue;
        }
        filled += 1;
        if (game.solution[patch.index] !== patch.after.value) wrongCount += 1;
      }
    }
    const warning = settings.mistakeChecking === 'warn';
    const mistakes = warning ? game.mistakes + wrongCount : game.mistakes;
    const wrong = warning && wrongCount > 0;

    let conflicted = false;
    if (meta.placed && settings.conflictHighlight === 'on-error') {
      const conflicts = findConflicts(cells.values);
      conflicted = meta.placed.indices.some((i) => conflicts.has(i));
    }

    const at = foldElapsed(game);
    const won = game.status === 'playing' && isSolved(cells.values, game.solution);
    const elapsedMs = won ? at : game.elapsedMs;

    const actionStats = meta.action
      ? recordAction(game.actionStats, {
          ...meta.action,
          at,
          cells: meta.action.cells ?? (meta.placed ? filled : command.patches.length),
          ...(meta.placed ? { wrong: wrongCount } : {}),
        })
      : game.actionStats;

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
        // A new move is what buys back a capped undo allowance.
        undoStreak: 0,
        actionStats,
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

  /** Log an action that isn't a board command (undo, check, pause…). */
  const logAction = (entry: Omit<ActionEntry, 'at'>): void => {
    const { game } = get();
    set({
      game: {
        ...game,
        actionStats: recordAction(game.actionStats, { ...entry, at: foldElapsed(game) }),
      },
    });
  };

  /** Flag mistakes/conflicts without logging — both Check and Hint use it. */
  const runCheck = (): void => {
    const { game, settings } = get();
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
  };

  const applyDigitTo = (digit: Digit, targets: readonly number[]): void => {
    const { game, settings } = get();
    if (game.status !== 'playing' || targets.length === 0) return;
    const editable = (i: number) => isEditable(game, i);

    // Hand-edited pencil marks only exist in user-managed candidate mode;
    // with auto-candidates on, digits always place values (note mode is
    // forced off elsewhere, this is the safety net for stale state).
    if (game.noteMode !== 'off' && !settings.autoCandidates) {
      const command = toggleMark(game.cells, targets, editable, digit);
      if (command) commit(command, { action: { type: 'note', digit } });
      return;
    }

    const command = placeValue(game.cells, targets, editable, digit, {
      autoRemovePeers: settings.autoRemovePeers && !settings.autoCandidates,
    });
    if (command) {
      commit(command, {
        placed: { digit, indices: [...targets] },
        action: { type: 'place', digit },
      });
    }
  };

  const eraseAt = (targets: readonly number[]): void => {
    const { game } = get();
    if (game.status !== 'playing' || targets.length === 0) return;
    const command = eraseCells(game.cells, targets, (i) => isEditable(game, i));
    if (command) commit(command, { action: { type: 'erase' } });
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
          },
          past: [],
          future: [],
          elapsedMs: 0,
          lastTickAt: null,
          mistakes: 0,
          hintsUsed: 0,
          undoStreak: 0,
          // The same puzzle from scratch: its record starts over too.
          actionStats: emptyActionStats(),
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
      logAction({ type: 'pause' });
    },

    resume() {
      const { game } = get();
      if (game.status === 'paused') {
        set({ game: { ...game, status: 'playing', lastTickAt: null } });
        logAction({ type: 'resume' });
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

    togglePencil() {
      const { game, settings } = get();
      // The pencil doesn't exist while the app manages candidates.
      if (settings.autoCandidates && game.noteMode === 'off') return;
      set({ game: { ...game, noteMode: game.noteMode === 'off' ? 'corner' : 'off' } });
      logAction({ type: 'pencil' });
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
      const { game, settings } = get();
      if (game.status !== 'playing' || game.past.length === 0) return;
      // The cap is self-imposed friction, not data loss: the history stays
      // whole, but stepping further back requires making a move first.
      if (!canUndo(game, settings.undoLimit)) return;
      const command = game.past[game.past.length - 1]!;
      set({
        game: {
          ...game,
          cells: revertCommand(game.cells, command),
          past: game.past.slice(0, -1),
          future: [command, ...game.future],
          undoStreak: game.undoStreak + 1,
          actionStats: recordAction(game.actionStats, {
            type: 'undo',
            at: foldElapsed(game),
            cells: command.patches.length,
          }),
          checkFlagged: [],
        },
      });
    },

    redo() {
      const { game } = get();
      if (game.status !== 'playing' || game.future.length === 0) return;
      const command = game.future[0]!;
      const cells = applyCommand(game.cells, command);
      const at = foldElapsed(game);
      const won = isSolved(cells.values, game.solution);
      const elapsedMs = won ? at : game.elapsedMs;
      set({
        game: {
          ...game,
          cells,
          past: [...game.past, command],
          future: game.future.slice(1),
          // Redo walks back toward the furthest point, so it repays the cap.
          undoStreak: Math.max(0, game.undoStreak - 1),
          actionStats: recordAction(game.actionStats, {
            type: 'redo',
            at,
            cells: command.patches.length,
          }),
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
      if (command) commit(command, { action: { type: 'auto-notes' } });
    },

    clearNotes() {
      const { game } = get();
      if (game.status !== 'playing') return;
      const command = clearAllNotes(game.cells);
      if (command) commit(command, { action: { type: 'clear-notes' } });
    },

    clearBoard() {
      const { game } = get();
      if (game.status !== 'playing') return;
      const command = buildClearBoard(game.cells, (i) => isEditable(game, i));
      if (command) commit(command, { action: { type: 'clear-board' } });
    },

    hint() {
      const { game, settings } = get();
      if (game.status !== 'playing') return;
      if (settings.hintStyle === 'check-entries') {
        // One press, one logged action: the check rides along under 'hint'.
        runCheck();
        set({ game: { ...get().game, hintsUsed: get().game.hintsUsed + 1 } });
        logAction({ type: 'hint' });
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
        commit(command, { countsAsHint: true, action: { type: 'hint', digit, cells: 1 } });
        set({ game: { ...get().game, selection: [target] } });
      }
    },

    checkNow() {
      if (get().game.status !== 'playing') return;
      runCheck();
      logAction({ type: 'check' });
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
