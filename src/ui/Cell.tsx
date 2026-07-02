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

/**
 * Corner marks fill anchor slots in reading order (Snyder style): corners
 * first, then edges, center last — so they only reach the middle when the
 * cell already holds nine marks and never sit on top of center marks.
 */
const CORNER_AREAS = ['tl', 'tr', 'bl', 'br', 'tc', 'bc', 'ml', 'mr', 'mc'] as const;

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
      id={`cell-${index}`}
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
              {cornerDigits.map((d, slot) => (
                <i key={d} className={styles[`c-${CORNER_AREAS[slot]!}`]}>
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
