import { useStore } from '../store';
import { DIGITS } from '../game/types';
import styles from './NumberPad.module.css';
import { useDigitCounts } from './useDerived';

export function NumberPad() {
  const padDigit = useStore((s) => s.padDigit);
  const armedDigit = useStore((s) => s.game.armedDigit);
  const numberFirst = useStore((s) => s.settings.inputMode === 'number-first');
  const removeCompleted = useStore((s) => s.settings.removeCompletedDigits);
  const noteMode = useStore((s) => s.game.noteMode);
  const playing = useStore((s) => s.game.status === 'playing');
  const grid = useStore((s) => s.settings.padLayout === 'grid');
  const counts = useDigitCounts();

  return (
    <div
      className={`${styles.pad} ${grid ? styles.grid : ''}`}
      role="toolbar"
      aria-label="Number pad"
    >
      {DIGITS.map((d) => {
        const remaining = 9 - counts[d]!;
        const done = remaining <= 0;
        const gone = done && removeCompleted;
        return (
          <button
            key={d}
            className={`${styles.key} ${gone ? styles.gone : ''} ${noteMode !== 'off' ? styles.noteKey : ''}`}
            disabled={!playing || gone}
            aria-label={`${noteMode !== 'off' ? 'Note' : 'Enter'} ${d}${done ? ', all placed' : ''}`}
            {...(numberFirst ? { 'aria-pressed': armedDigit === d } : {})}
            data-armed={numberFirst && armedDigit === d ? 'true' : undefined}
            onClick={() => padDigit(d)}
          >
            <span className={styles.digit}>{d}</span>
            <span className={`${styles.count} tabular`} aria-hidden="true">
              {done ? '' : remaining}
            </span>
          </button>
        );
      })}
    </div>
  );
}
