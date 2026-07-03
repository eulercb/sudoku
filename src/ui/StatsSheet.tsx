import { useState } from 'react';
import { useStore } from '../store';
import { TIERS } from '../game/types';
import { effectiveStreak, medianMs, winRate } from '../store/statsSlice';
import { TIER_LABELS, formatPercent, formatTime } from './format';
import { Sheet } from './Sheet';
import styles from './StatsSheet.module.css';

export function StatsSheet({ onClose }: { onClose: () => void }) {
  const stats = useStore((s) => s.stats);
  const resetStats = useStore((s) => s.resetStats);
  const [confirmReset, setConfirmReset] = useState(false);

  const streak = effectiveStreak(stats, new Date());
  const anyGames = TIERS.some((t) => stats.perTier[t].started > 0);

  return (
    <Sheet title="Statistics" onClose={onClose}>
      <div className={styles.streaks}>
        <div className={styles.streak}>
          <span className={`${styles.streakNumber} tabular`}>{streak}</span>
          <span className={styles.streakLabel}>day streak</span>
        </div>
        <div className={styles.streak}>
          <span className={`${styles.streakNumber} tabular`}>{stats.longestStreak}</span>
          <span className={styles.streakLabel}>longest streak</span>
        </div>
      </div>

      {anyGames ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Difficulty</span>
              </th>
              <th scope="col">Wins</th>
              <th scope="col">Rate</th>
              <th scope="col">Best</th>
              <th scope="col">Median</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((tier) => {
              const t = stats.perTier[tier];
              const rate = winRate(t);
              const median = medianMs(t.timesMs);
              return (
                <tr key={tier}>
                  <th scope="row">{TIER_LABELS[tier]}</th>
                  <td className="tabular">{t.wins}</td>
                  <td className="tabular">{rate === null ? '–' : formatPercent(rate)}</td>
                  <td className="tabular">{t.bestMs === null ? '–' : formatTime(t.bestMs)}</td>
                  <td className="tabular">{median === null ? '–' : formatTime(median)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className={styles.empty}>Solve your first puzzle and your record starts here.</p>
      )}

      {anyGames && (
        <button
          className={`${styles.reset} ${confirmReset ? styles.resetArmed : ''}`}
          onClick={() => {
            if (confirmReset) {
              resetStats();
              setConfirmReset(false);
            } else {
              setConfirmReset(true);
            }
          }}
        >
          {confirmReset ? 'Tap again to erase all statistics' : 'Reset statistics'}
        </button>
      )}
    </Sheet>
  );
}
