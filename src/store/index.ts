import { create } from 'zustand';
import {
  clearAllNotes,
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
  tick(deltaMs: number): void;
  dismissWin(): void;

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
  applyDigit(digit: Digit): void;
  erase(): void;
  undo(): void;
  redo(): void;

  // Assists
  fillNotes(): void;
  clearNotes(): void;
  hint(): void;
  checkNow(): void;

  // Settings, stats & UI
  setSetting<K extends keyof SettingsState>(key: K, value: SettingsState[K]): void;
  resetStats(): void;
  setOpenSheet(sheet: SheetName): void;
}

const isEditable = (game: GameState, index: number): boolean => game.givens[index] === 0;

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

    let nextStats: StatsState = stats;
    if (won) {
      nextStats = recordWin(stats, game.tier, game.elapsedMs, new Date());
    }

    set({
      game: {
        ...game,
        cells,
        past,
        future: [],
        mistakes,
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

    if (game.noteMode !== 'off') {
      // Hand-edited pencil marks only exist in user-managed candidate mode.
      if (settings.autoCandidates) return;
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
      set({
        game: fromPersistedGame(data.game) ?? emptyGame(),
        settings: hydrateSettings(data.settings),
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
      if (game.status === 'playing') set({ game: { ...game, status: 'paused' } });
    },

    resume() {
      const { game } = get();
      if (game.status === 'paused') set({ game: { ...game, status: 'playing' } });
    },

    tick(deltaMs) {
      const { game } = get();
      if (game.status !== 'playing') return;
      set({ game: { ...game, elapsedMs: game.elapsedMs + deltaMs } });
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
      const { game } = get();
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

    applyDigit(digit) {
      applyDigitTo(digit, get().game.selection);
    },

    erase() {
      const { game, settings } = get();
      if (settings.inputMode === 'number-first' && game.selection.length === 0) {
        get().toggleArmedErase();
        return;
      }
      eraseAt(game.selection);
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
      set({
        game: {
          ...game,
          cells,
          past: [...game.past, command],
          future: game.future.slice(1),
          checkFlagged: [],
          status: won ? 'won' : game.status,
        },
        ...(won ? { stats: recordWin(get().stats, game.tier, game.elapsedMs, new Date()) } : {}),
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
      const flagged = new Set<number>(findMistakes(game.cells.values, game.solution));
      if (settings.conflictHighlight !== 'off') {
        for (const i of findConflicts(game.cells.values)) flagged.add(i);
      }
      set({ game: { ...game, checkFlagged: [...flagged] } });
    },

    setSetting(key, value) {
      set((state) => ({ settings: { ...state.settings, [key]: value } }));
    },

    resetStats() {
      set({ stats: emptyStats() });
    },

    setOpenSheet(sheet) {
      set({ openSheet: sheet });
    },
  };
});
