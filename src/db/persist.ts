import type { Store } from '../store';
import { toPersistedGame } from '../store/gameSlice';
import { readRecord, writeRecord } from './db';

/**
 * Autosave. Every board mutation, setting change, or stats update is written
 * (debounced) to IndexedDB so a reload resumes seamlessly. Timer-only changes
 * are throttled hard — the elapsed time is flushed every ~15s and whenever
 * the page hides, which is when it actually matters.
 *
 * There is deliberately ONE active game: concurrent tabs share the same
 * record last-writer-wins. That matches the product model (a personal,
 * single-screen mobile game) and keeps persistence dumb and robust.
 */

const DEBOUNCE_MS = 300;
const TIMER_FLUSH_MS = 15_000;

export interface HydrationData {
  game?: unknown;
  settings?: unknown;
  stats?: unknown;
}

export async function loadPersisted(): Promise<HydrationData> {
  const [game, settings, stats] = await Promise.all([
    readRecord('game'),
    readRecord('settings'),
    readRecord('stats'),
  ]);
  return { game, settings, stats };
}

type StoreApi = {
  getState(): Store;
  subscribe(listener: (state: Store, prev: Store) => void): () => void;
};

export function startPersistence(store: StoreApi): () => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastSavedElapsed = store.getState().game.elapsedMs;

  const write = () => {
    const state = store.getState();
    lastSavedElapsed = state.game.elapsedMs;
    void writeRecord('game', toPersistedGame(state.game));
    void writeRecord('settings', state.settings);
    void writeRecord('stats', state.stats);
  };

  const schedule = () => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      write();
    }, DEBOUNCE_MS);
  };

  const unsubscribe = store.subscribe((state, prev) => {
    if (!state.hydrated) return;
    const game = state.game;
    const prevGame = prev.game;
    const meaningfulGameChange =
      game.cells !== prevGame.cells ||
      game.puzzleId !== prevGame.puzzleId ||
      game.status !== prevGame.status ||
      game.past !== prevGame.past ||
      game.future !== prevGame.future ||
      game.mistakes !== prevGame.mistakes ||
      game.hintsUsed !== prevGame.hintsUsed ||
      game.noteMode !== prevGame.noteMode ||
      game.winDismissed !== prevGame.winDismissed;
    const otherChange = state.settings !== prev.settings || state.stats !== prev.stats;
    const timerDue =
      game.elapsedMs !== prevGame.elapsedMs &&
      Math.abs(game.elapsedMs - lastSavedElapsed) >= TIMER_FLUSH_MS;

    if (meaningfulGameChange || otherChange || timerDue) schedule();
  });

  const flush = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (store.getState().hydrated) write();
  };

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
    flush();
  };
}
