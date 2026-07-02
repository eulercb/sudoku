import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startPersistence } from '../../src/db/persist';
import { writeRecord } from '../../src/db/db';
import { useStore } from '../../src/store';
import { fixtureGivens, fixtureSolution } from '../fixtures';
import type { Digit } from '../../src/game/types';

vi.mock('../../src/db/db', () => ({
  readRecord: vi.fn().mockResolvedValue(undefined),
  writeRecord: vi.fn().mockResolvedValue(undefined),
  deleteRecord: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/puzzles', () => ({
  newPuzzle: (tier: 'easy' | 'medium' | 'hard' | 'expert') => ({
    id: `${tier}-fixture`,
    tier,
    givens: fixtureGivens(),
    solution: fixtureSolution(),
  }),
}));

const s = () => useStore.getState();
const writes = () => vi.mocked(writeRecord).mock.calls;

describe('startPersistence', () => {
  let stop: () => void;
  let fakeNow = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeNow = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);
    s().hydrate({});
    stop = startPersistence(useStore);
    vi.mocked(writeRecord).mockClear();
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('debounces board mutations into a save of all three records', () => {
    s().newGame('easy');
    const i = fixtureGivens().indexOf(0);
    s().selectCell(i);
    s().applyDigit(fixtureSolution()[i]! as Digit);
    expect(writes()).toHaveLength(0); // debounced, not yet written
    vi.advanceTimersByTime(400);
    const stores = writes().map((c) => c[0]);
    expect(stores).toContain('game');
    expect(stores).toContain('settings');
    expect(stores).toContain('stats');
    const gameRecord = writes().find((c) => c[0] === 'game')![1] as Record<string, unknown>;
    expect(gameRecord).not.toHaveProperty('selection'); // transient dropped
    expect(gameRecord).not.toHaveProperty('lastTickAt');
  });

  it('skips timer-only changes until ~15s have accumulated', () => {
    s().newGame('easy');
    vi.advanceTimersByTime(400);
    vi.mocked(writeRecord).mockClear();

    s().timerStart();
    for (let step = 0; step < 14; step++) {
      fakeNow += 1000;
      s().timerTick();
    }
    vi.advanceTimersByTime(400);
    expect(writes()).toHaveLength(0); // 14s of ticks: below the flush window

    fakeNow += 1000;
    s().timerTick(); // 15th second crosses the window
    vi.advanceTimersByTime(400);
    expect(writes().map((c) => c[0])).toContain('game');
  });

  it('flushes immediately when the page hides', () => {
    s().newGame('easy');
    vi.advanceTimersByTime(400);
    vi.mocked(writeRecord).mockClear();

    s().timerStart();
    fakeNow += 3000;
    s().timerTick(); // small change, below the timer window

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(writes().map((c) => c[0])).toContain('game');
    const gameRecord = writes().find((c) => c[0] === 'game')![1] as { elapsedMs: number };
    expect(gameRecord.elapsedMs).toBe(3000);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  it('flushes on pagehide', () => {
    s().newGame('easy');
    window.dispatchEvent(new Event('pagehide'));
    expect(writes().map((c) => c[0])).toContain('game');
  });
});
