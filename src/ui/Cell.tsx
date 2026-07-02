import { memo } from 'react';
import { colOf, rowOf } from '../game/board';
import { notesToDigits } from '../game/notes';
import type { CellValue } from '../game/types';
import styles from './Cell.module.css';

interface CellProps {
  index: number;
  value: CellValue;
  given: boolean;
  cornerMask: number;
  centerMask: number;
  selected: boolean;
  peer: boolean;
  sameDigit: boolean;
  flagged: boolean;
  hidden: boolean;
}

/** Fixed 3×3 anchor per digit, so corner marks always sit in the same spot. */
const CORNER_AREAS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'] as const;

export const Cell = memo(function Cell({
  index,
  value,
  given,
  cornerMask,
  centerMask,
  selected,
  peer,
  sameDigit,
  flagged,
  hidden,
}: CellProps) {
  const row = rowOf(index);
  const col = colOf(index);
  const cornerDigits = value === 0 ? notesToDigits(cornerMask) : [];
  const centerDigits = value === 0 ? notesToDigits(centerMask) : [];

  const classes = [styles.cell];
  if (selected) classes.push(styles.selected!);
  else if (sameDigit) classes.push(styles.same!);
  else if (peer) classes.push(styles.peer!);
  if (flagged) classes.push(styles.flagged!);
  if (given) classes.push(styles.given!);

  let label = `Row ${row + 1}, column ${col + 1}`;
  if (!hidden) {
    if (value !== 0) label += given ? `, given ${value}` : `, ${value}`;
    else if (centerDigits.length + cornerDigits.length > 0) {
      label += `, notes ${[...cornerDigits, ...centerDigits].join(' ')}`;
    } else label += ', empty';
  }

  return (
    <div
      role="gridcell"
      data-index={index}
      aria-selected={selected}
      aria-label={label}
      className={classes.join(' ')}
      style={{ '--wave': row + col } as React.CSSProperties}
    >
      {hidden ? null : value !== 0 ? (
        <span className={styles.value}>{value}</span>
      ) : (
        <>
          {cornerDigits.length > 0 && (
            <span className={styles.corner} aria-hidden="true">
              {cornerDigits.map((d) => (
                <i key={d} className={styles[`c-${CORNER_AREAS[d - 1]!}`]}>
                  {d}
                </i>
              ))}
            </span>
          )}
          {centerDigits.length > 0 && (
            <span className={styles.center} data-count={centerDigits.length} aria-hidden="true">
              {centerDigits.join('')}
            </span>
          )}
        </>
      )}
    </div>
  );
});
