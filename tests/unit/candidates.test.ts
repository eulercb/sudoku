import { describe, expect, it } from 'vitest';
import { PEERS } from '../../src/game/board';
import { computeCandidates } from '../../src/game/candidates';
import { hasNote, notesToDigits } from '../../src/game/notes';
import type { CellValue, Digit } from '../../src/game/types';
import { fixtureGivens, fixtureSolution } from '../fixtures';

describe('computeCandidates', () => {
  it('gives filled cells no candidates', () => {
    const values = fixtureGivens();
    const candidates = computeCandidates(values);
    for (let i = 0; i < 81; i++) {
      if (values[i] !== 0) expect(candidates[i]).toBe(0);
    }
  });

  it('excludes exactly the digits present among peers', () => {
    const values = fixtureGivens();
    const candidates = computeCandidates(values);
    for (let i = 0; i < 81; i++) {
      if (values[i] !== 0) continue;
      const peerDigits = new Set<CellValue>(
        PEERS[i]!.map((p) => values[p]!).filter((v) => v !== 0),
      );
      for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]) {
        expect(hasNote(candidates[i]!, d)).toBe(!peerDigits.has(d));
      }
    }
  });

  it('always includes the true solution digit', () => {
    const values = fixtureGivens();
    const solution = fixtureSolution();
    const candidates = computeCandidates(values);
    for (let i = 0; i < 81; i++) {
      if (values[i] === 0) {
        expect(notesToDigits(candidates[i]!)).toContain(solution[i]);
      }
    }
  });
});
