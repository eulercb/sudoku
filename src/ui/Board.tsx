import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useStore } from '../store';
import { Cell } from './Cell';
import styles from './Board.module.css';
import {
  useActiveDigit,
  useCenterMasks,
  useConflicts,
  usePeerSet,
  useWrongCells,
} from './useDerived';
import { PlayIcon } from './icons';

const cellFromPoint = (x: number, y: number): number | null => {
  const el = document.elementFromPoint(x, y)?.closest('[data-index]');
  if (!el) return null;
  const index = Number((el as HTMLElement).dataset.index);
  return Number.isInteger(index) ? index : null;
};

/** Is the number-first eraser or a digit armed right now? */
const armedTool = (): boolean => {
  const s = useStore.getState();
  return (
    s.settings.inputMode === 'number-first' &&
    s.game.status === 'playing' &&
    (s.game.armedDigit !== null || s.game.armedErase)
  );
};

export function Board() {
  const values = useStore((s) => s.game.cells.values);
  const corner = useStore((s) => s.game.cells.corner);
  const givens = useStore((s) => s.game.givens);
  const selection = useStore((s) => s.game.selection);
  const checkFlagged = useStore((s) => s.game.checkFlagged);
  const status = useStore((s) => s.game.status);
  const highlightSame = useStore((s) => s.settings.highlightSameDigit);
  const autoCandidates = useStore((s) => s.settings.autoCandidates);
  const tapCell = useStore((s) => s.tapCell);
  const selectCell = useStore((s) => s.selectCell);
  const resume = useStore((s) => s.resume);

  const centerMasks = useCenterMasks();
  const conflicts = useConflicts();
  const wrongCells = useWrongCells();
  const peers = usePeerSet();
  const activeDigit = useActiveDigit();

  const selectionSet = new Set(selection);
  const flaggedSet = new Set(checkFlagged);
  const hidden = status === 'paused' || status === 'idle';
  const cursor = selection[selection.length - 1];

  const drag = useRef<{ pointerId: number; visited: Set<number> } | null>(null);
  const lastPointerTap = useRef<{ index: number; at: number } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (hidden) return;
      const index = cellFromPoint(e.clientX, e.clientY);
      if (index === null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { pointerId: e.pointerId, visited: new Set([index]) };
      lastPointerTap.current = { index, at: performance.now() };
      tapCell(index, e.ctrlKey || e.metaKey || e.shiftKey);
    },
    [hidden, tapCell],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const index = cellFromPoint(e.clientX, e.clientY);
      if (index === null || d.visited.has(index)) return;
      d.visited.add(index);
      if (armedTool()) {
        // Number-first: dragging paints the armed digit/eraser cell by cell.
        tapCell(index);
      } else {
        selectCell(index, 'append');
      }
    },
    [selectCell, tapCell],
  );

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  }, []);

  // Fallback for interactions that only synthesize click events (e.g.
  // screen-reader double-tap). Skipped when the pointer path just ran.
  const onClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (hidden) return;
      const el = (e.target as HTMLElement).closest('[data-index]');
      const index = el ? Number((el as HTMLElement).dataset.index) : NaN;
      if (!Number.isInteger(index)) return;
      const last = lastPointerTap.current;
      if (last && last.index === index && performance.now() - last.at < 700) return;
      lastPointerTap.current = { index, at: performance.now() };
      tapCell(index);
    },
    [hidden, tapCell],
  );

  return (
    <div className={styles.wrap}>
      <div
        role="grid"
        aria-label="Sudoku board"
        tabIndex={0}
        aria-activedescendant={cursor !== undefined ? `cell-${cursor}` : undefined}
        className={`${styles.board} ${status === 'won' ? styles.won : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={onClick}
      >
        {Array.from({ length: 9 }, (_, r) => (
          <div key={r} role="row" className={styles.row}>
            {Array.from({ length: 9 }, (_, c) => {
              const i = r * 9 + c;
              const v = values[i]!;
              return (
                <Cell
                  key={c}
                  index={i}
                  value={v}
                  given={givens[i] !== 0}
                  cornerMask={autoCandidates ? 0 : corner[i]!}
                  centerMask={centerMasks[i]!}
                  selected={selectionSet.has(i)}
                  peer={peers.has(i)}
                  sameDigit={
                    highlightSame &&
                    activeDigit !== null &&
                    v === activeDigit &&
                    !selectionSet.has(i)
                  }
                  flagged={conflicts.has(i) || wrongCells.has(i) || flaggedSet.has(i)}
                  hidden={hidden}
                />
              );
            })}
          </div>
        ))}
        <div className={styles.lines} aria-hidden="true" />
        {status === 'paused' && (
          <button className={styles.overlay} onClick={resume} aria-label="Resume game">
            <PlayIcon />
            <span>Paused</span>
          </button>
        )}
      </div>
    </div>
  );
}
