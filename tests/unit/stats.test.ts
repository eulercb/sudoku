import { describe, expect, it } from 'vitest';
import {
  dayKey,
  effectiveStreak,
  emptyStats,
  hydrateStats,
  medianMs,
  recordStart,
  recordWin,
  winRate,
} from '../../src/store/statsSlice';

const day = (iso: string) => new Date(`${iso}T12:00:00`);

describe('streaks', () => {
  it('starts at 1 on the first win', () => {
    const stats = recordWin(emptyStats(), 'easy', 60_000, day('2026-07-01'));
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(1);
    expect(stats.lastWinDay).toBe('2026-07-01');
  });

  it('grows on consecutive days, stays flat within a day', () => {
    let stats = recordWin(emptyStats(), 'easy', 60_000, day('2026-07-01'));
    stats = recordWin(stats, 'easy', 60_000, day('2026-07-01'));
    expect(stats.currentStreak).toBe(1);
    stats = recordWin(stats, 'hard', 60_000, day('2026-07-02'));
    expect(stats.currentStreak).toBe(2);
    stats = recordWin(stats, 'easy', 60_000, day('2026-07-03'));
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it('resets after a missed day but keeps the longest', () => {
    let stats = recordWin(emptyStats(), 'easy', 60_000, day('2026-07-01'));
    stats = recordWin(stats, 'easy', 60_000, day('2026-07-02'));
    stats = recordWin(stats, 'easy', 60_000, day('2026-07-05'));
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(2);
  });

  it('handles month boundaries', () => {
    let stats = recordWin(emptyStats(), 'easy', 60_000, day('2026-06-30'));
    stats = recordWin(stats, 'easy', 60_000, day('2026-07-01'));
    expect(stats.currentStreak).toBe(2);
  });

  it('effectiveStreak lapses when the last win is older than yesterday', () => {
    const stats = recordWin(emptyStats(), 'easy', 60_000, day('2026-07-01'));
    expect(effectiveStreak(stats, day('2026-07-01'))).toBe(1);
    expect(effectiveStreak(stats, day('2026-07-02'))).toBe(1);
    expect(effectiveStreak(stats, day('2026-07-03'))).toBe(0);
  });
});

describe('per-tier records', () => {
  it('tracks starts, wins, best and median', () => {
    let stats = recordStart(emptyStats(), 'medium');
    stats = recordStart(stats, 'medium');
    stats = recordWin(stats, 'medium', 300_000, day('2026-07-01'));
    stats = recordWin(stats, 'medium', 200_000, day('2026-07-01'));
    stats = recordWin(stats, 'medium', 400_000, day('2026-07-01'));

    const t = stats.perTier.medium;
    expect(t.started).toBe(2);
    expect(t.wins).toBe(3);
    expect(t.bestMs).toBe(200_000);
    expect(medianMs(t.timesMs)).toBe(300_000);
    expect(winRate(t)).toBe(1.5); // more wins than starts only in synthetic data
    expect(stats.perTier.easy.wins).toBe(0);
  });

  it('median of an even count averages the middle pair', () => {
    expect(medianMs([100, 200, 300, 400])).toBe(250);
    expect(medianMs([])).toBeNull();
  });
});

describe('hydrateStats', () => {
  it('round-trips its own shape and tolerates junk', () => {
    let stats = recordWin(emptyStats(), 'expert', 500_000, day('2026-07-01'));
    stats = recordStart(stats, 'expert');
    expect(hydrateStats(JSON.parse(JSON.stringify(stats)))).toEqual(stats);
    expect(hydrateStats(undefined)).toEqual(emptyStats());
    expect(hydrateStats({ perTier: { easy: { wins: 'NaN' } } }).perTier.easy.wins).toBe(0);
  });
});

describe('dayKey', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(dayKey(day('2026-07-02'))).toBe('2026-07-02');
    expect(dayKey(day('2026-01-09'))).toBe('2026-01-09');
  });
});
