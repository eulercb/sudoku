import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { effectiveStreak } from '../store/statsSlice';
import { TIER_LABELS, formatTime } from './format';
import styles from './WinDialog.module.css';

export function WinDialog() {
  const tier = useStore((s) => s.game.tier);
  const elapsedMs = useStore((s) => s.game.elapsedMs);
  const mistakes = useStore((s) => s.game.mistakes);
  const hintsUsed = useStore((s) => s.game.hintsUsed);
  const stats = useStore((s) => s.stats);
  const warnMode = useStore((s) => s.settings.mistakeChecking === 'warn');
  const newGame = useStore((s) => s.newGame);
  const setOpenSheet = useStore((s) => s.setOpenSheet);
  const dismissWin = useStore((s) => s.dismissWin);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const isBest = stats.perTier[tier].bestMs === elapsedMs;
  const streak = effectiveStreak(stats, new Date());

  return (
    <div className={styles.root}>
      <div className={styles.scrim} aria-hidden="true" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="Puzzle solved"
        tabIndex={-1}
        className={styles.card}
      >
        <p className={styles.kicker}>{TIER_LABELS[tier]} solved</p>
        <p className={`${styles.time} tabular`}>{formatTime(elapsedMs)}</p>
        {isBest && <p className={styles.best}>New best time</p>}

        <div className={styles.facts}>
          {warnMode && (
            <span>
              {mistakes} mistake{mistakes === 1 ? '' : 's'}
            </span>
          )}
          <span>
            {hintsUsed} hint{hintsUsed === 1 ? '' : 's'}
          </span>
          {streak > 1 && <span>{streak}-day streak</span>}
        </div>

        <div className={styles.actions}>
          <button className={styles.primary} onClick={() => newGame(tier)}>
            Play again
          </button>
          <button className={styles.secondary} onClick={() => setOpenSheet('newGame')}>
            Change level
          </button>
          <button className={styles.quiet} onClick={dismissWin}>
            Admire the board
          </button>
        </div>
      </div>
    </div>
  );
}
