import { useMemo } from 'react';
import { PEERS } from '../game/board';
import { computeCandidates } from '../game/candidates';
import { digitCounts, findConflicts, findMistakes } from '../game/checks';
import type { Digit } from '../game/types';
import { useStore } from '../store';

/**
 * Derived board state, memoized on the underlying array references so the
 * 81 cells re-render only when something actually changed.
 */

export function useConflicts(): Set<number> {
  const values = useStore((s) => s.game.cells.values);
  const enabled = useStore((s) => s.settings.conflictHighlight === 'on-error');
  return useMemo(() => (enabled ? findConflicts(values) : new Set<number>()), [values, enabled]);
}

/** Wrong-vs-solution cells, live (the warn-on-mistake setting). */
export function useWrongCells(): Set<number> {
  const values = useStore((s) => s.game.cells.values);
  const solution = useStore((s) => s.game.solution);
  const enabled = useStore((s) => s.settings.mistakeChecking === 'warn');
  return useMemo(
    () => (enabled ? new Set(findMistakes(values, solution)) : new Set<number>()),
    [values, solution, enabled],
  );
}

export function useDigitCounts(): number[] {
  const values = useStore((s) => s.game.cells.values);
  return useMemo(() => digitCounts(values), [values]);
}

/** Center-mark display masks: derived candidates in auto mode, user notes otherwise. */
export function useCenterMasks(): number[] {
  const values = useStore((s) => s.game.cells.values);
  const userCenter = useStore((s) => s.game.cells.center);
  const auto = useStore((s) => s.settings.autoCandidates);
  return useMemo(() => (auto ? computeCandidates(values) : userCenter), [values, userCenter, auto]);
}

/** The digit to emphasize: the cursor cell's value, or the armed digit. */
export function useActiveDigit(): Digit | null {
  const values = useStore((s) => s.game.cells.values);
  const selection = useStore((s) => s.game.selection);
  const armed = useStore((s) => s.game.armedDigit);
  const numberFirst = useStore((s) => s.settings.inputMode === 'number-first');
  return useMemo(() => {
    if (numberFirst && armed !== null) return armed;
    const cursor = selection[selection.length - 1];
    if (cursor === undefined) return null;
    const v = values[cursor]!;
    return v === 0 ? null : v;
  }, [values, selection, armed, numberFirst]);
}

/** Peer cells of the current selection (for the peer highlight). */
export function usePeerSet(): Set<number> {
  const selection = useStore((s) => s.game.selection);
  const enabled = useStore((s) => s.settings.highlightPeers);
  return useMemo(() => {
    const peers = new Set<number>();
    if (!enabled) return peers;
    for (const i of selection) {
      for (const p of PEERS[i]!) peers.add(p);
    }
    for (const i of selection) peers.delete(i);
    return peers;
  }, [selection, enabled]);
}
