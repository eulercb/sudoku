import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';

interface SudokuDB extends DBSchema {
  /** Single-row stores: the active game, settings, and lifetime stats. */
  game: { key: string; value: unknown };
  settings: { key: string; value: unknown };
  stats: { key: string; value: unknown };
}

const DB_NAME = 'sudoku';
const DB_VERSION = 1;
export const ACTIVE_KEY = 'active';

let dbPromise: Promise<IDBPDatabase<SudokuDB>> | null = null;

function db(): Promise<IDBPDatabase<SudokuDB>> {
  dbPromise ??= openDB<SudokuDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('game');
      database.createObjectStore('settings');
      database.createObjectStore('stats');
    },
  });
  return dbPromise;
}

export type StoreName = 'game' | 'settings' | 'stats';

export async function readRecord(store: StoreName): Promise<unknown> {
  try {
    return await (await db()).get(store, ACTIVE_KEY);
  } catch {
    return undefined; // Private mode / blocked storage — run from memory.
  }
}

export async function writeRecord(store: StoreName, value: unknown): Promise<void> {
  try {
    await (await db()).put(store, value, ACTIVE_KEY);
  } catch {
    // Best-effort persistence.
  }
}

export async function deleteRecord(store: StoreName): Promise<void> {
  try {
    await (await db()).delete(store, ACTIVE_KEY);
  } catch {
    // Best-effort persistence.
  }
}
