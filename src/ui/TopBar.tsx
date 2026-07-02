import { useStore } from '../store';
import { TIER_LABELS, formatTime } from './format';
import { MoreIcon, PauseIcon, PlayIcon } from './icons';
import styles from './TopBar.module.css';

export function TopBar() {
  const tier = useStore((s) => s.game.tier);
  const status = useStore((s) => s.game.status);
  const elapsedMs = useStore((s) => s.game.elapsedMs);
  const mistakes = useStore((s) => s.game.mistakes);
  const showTimer = useStore((s) => s.settings.showTimer);
  const warnMode = useStore((s) => s.settings.mistakeChecking === 'warn');
  const pause = useStore((s) => s.pause);
  const resume = useStore((s) => s.resume);
  const setOpenSheet = useStore((s) => s.setOpenSheet);

  const inGame = status !== 'idle';

  return (
    <header className={styles.bar}>
      <button
        className={styles.tier}
        onClick={() => setOpenSheet('newGame')}
        aria-label="Change difficulty, start a new game"
      >
        {inGame ? TIER_LABELS[tier] : 'Sudoku'}
      </button>

      <div className={styles.spacer} />

      {inGame && warnMode && mistakes > 0 && (
        <span className={styles.mistakes} aria-label={`${mistakes} mistakes`}>
          {mistakes} ✕
        </span>
      )}

      {inGame && showTimer && (
        <span className={`${styles.timer} tabular`} aria-label="Elapsed time">
          {formatTime(elapsedMs)}
        </span>
      )}

      {inGame && status !== 'won' && (
        <button
          className={styles.iconButton}
          onClick={status === 'paused' ? resume : pause}
          aria-label={status === 'paused' ? 'Resume' : 'Pause'}
        >
          {status === 'paused' ? <PlayIcon /> : <PauseIcon />}
        </button>
      )}

      <button className={styles.iconButton} onClick={() => setOpenSheet('menu')} aria-label="Menu">
        <MoreIcon />
      </button>
    </header>
  );
}
