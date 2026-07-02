import type { Tier } from '../game/types';
import { TIERS } from '../game/types';

export interface TierStats {
  started: number;
  wins: number;
  bestMs: number | null;
  /** Solve times, most recent last, capped so the record stays small. */
  timesMs: number[];
}

export interface StatsState {
  perTier: Record<Tier, TierStats>;
  currentStreak: number;
  longestStreak: number;
  /** Local calendar day of the last win, as 'YYYY-MM-DD'. */
  lastWinDay: string | null;
}

const MAX_TIMES = 200;

const emptyTierStats = (): TierStats => ({ started: 0, wins: 0, bestMs: null, timesMs: [] });

export const emptyStats = (): StatsState => ({
  perTier: {
    easy: emptyTierStats(),
    medium: emptyTierStats(),
    hard: emptyTierStats(),
    expert: emptyTierStats(),
  },
  currentStreak: 0,
  longestStreak: 0,
  lastWinDay: null,
});

export const dayKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const previousDayKey = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d! - 1);
  return dayKey(date);
};

export function recordStart(stats: StatsState, tier: Tier): StatsState {
  const t = stats.perTier[tier];
  return {
    ...stats,
    perTier: { ...stats.perTier, [tier]: { ...t, started: t.started + 1 } },
  };
}

export function recordWin(stats: StatsState, tier: Tier, timeMs: number, now: Date): StatsState {
  const t = stats.perTier[tier];
  const timesMs = [...t.timesMs, timeMs].slice(-MAX_TIMES);
  const bestMs = t.bestMs === null ? timeMs : Math.min(t.bestMs, timeMs);
  const today = dayKey(now);

  let currentStreak = stats.currentStreak;
  if (stats.lastWinDay === today) {
    // Same day, streak unchanged.
  } else if (stats.lastWinDay === previousDayKey(today)) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }

  return {
    perTier: { ...stats.perTier, [tier]: { ...t, wins: t.wins + 1, bestMs, timesMs } },
    currentStreak,
    longestStreak: Math.max(stats.longestStreak, currentStreak),
    lastWinDay: today,
  };
}

/**
 * The streak shown in the UI: a stored streak whose last win is neither today
 * nor yesterday has already lapsed.
 */
export function effectiveStreak(stats: StatsState, now: Date): number {
  if (stats.lastWinDay === null) return 0;
  const today = dayKey(now);
  if (stats.lastWinDay === today || stats.lastWinDay === previousDayKey(today)) {
    return stats.currentStreak;
  }
  return 0;
}

export function medianMs(timesMs: readonly number[]): number | null {
  if (timesMs.length === 0) return null;
  const sorted = [...timesMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function winRate(t: TierStats): number | null {
  if (t.started === 0) return null;
  return t.wins / t.started;
}

/** Merge persisted stats over an empty record, tolerating missing fields. */
export function hydrateStats(persisted: unknown): StatsState {
  const out = emptyStats();
  if (!persisted || typeof persisted !== 'object') return out;
  const p = persisted as Partial<StatsState>;
  if (typeof p.currentStreak === 'number') out.currentStreak = p.currentStreak;
  if (typeof p.longestStreak === 'number') out.longestStreak = p.longestStreak;
  if (typeof p.lastWinDay === 'string') out.lastWinDay = p.lastWinDay;
  if (p.perTier && typeof p.perTier === 'object') {
    for (const tier of TIERS) {
      const t = (p.perTier as Record<string, unknown>)[tier];
      if (!t || typeof t !== 'object') continue;
      const src = t as Partial<TierStats>;
      const dst = out.perTier[tier];
      if (typeof src.started === 'number') dst.started = src.started;
      if (typeof src.wins === 'number') dst.wins = src.wins;
      if (typeof src.bestMs === 'number') dst.bestMs = src.bestMs;
      if (Array.isArray(src.timesMs))
        dst.timesMs = src.timesMs.filter((x) => typeof x === 'number');
    }
  }
  return out;
}
