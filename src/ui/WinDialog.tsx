import { useMemo, useRef } from 'react';
import { summarizeActions } from '../game/actionLog';
import { useStore } from '../store';
import { effectiveStreak } from '../store/statsSlice';
import { TIER_LABELS, formatTime } from './format';
import { useFocusTrap } from './useFocusTrap';
import styles from './WinDialog.module.css';

export function WinDialog() {
  const tier = useStore((s) => s.game.tier);
  const elapsedMs = useStore((s) => s.game.elapsedMs);
  const hintsUsed = useStore((s) => s.game.hintsUsed);
  const actionStats = useStore((s) => s.game.actionStats);
  const stats = useStore((s) => s.stats);
  const newGame = useStore((s) => s.newGame);
  const setOpenSheet = useStore((s) => s.setOpenSheet);
  const dismissWin = useStore((s) => s.dismissWin);

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef);

  const isBest = stats.perTier[tier].bestMs === elapsedMs;
  const streak = effectiveStreak(stats, new Date());
  const summary = useMemo(() => summarizeActions(actionStats), [actionStats]);

  /**
   * The solve breakdown. Mistakes and hints always show (0 of each is the
   * point of pride); the rest appear only when the player used them, so a
   * clean solve stays a clean card. Hints come from the game's own counter so
   * a save made before action tracking still reports them.
   */
  const facts: readonly { label: string; value: number; always?: boolean }[] = [
    { label: 'Mistakes', value: summary.mistakes, always: true },
    { label: 'Hints', value: hintsUsed, always: true },
    { label: 'Undos', value: summary.undos },
    { label: 'Redos', value: summary.redos },
    { label: 'Auto', value: summary.autoNotes },
    { label: 'Checks', value: summary.checks },
    { label: 'Notes', value: summary.noteEdits },
    { label: 'Erases', value: summary.erases },
    { label: 'Cleared', value: summary.clearedNotes + summary.clearedBoard },
    { label: 'Actions', value: summary.total, always: true },
  ];
  const shown = facts.filter((f) => f.always || f.value > 0);

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

        <dl className={styles.breakdown} aria-label="Solve breakdown">
          {shown.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <dt className={styles.factLabel}>{fact.label}</dt>
              <dd className={`${styles.factValue} tabular`}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        {streak > 1 && <p className={styles.streak}>{streak}-day streak</p>}

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
