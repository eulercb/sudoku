import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Digit } from '../../src/game/types';
import { useStore } from '../../src/store';
import { FIXTURE_PUZZLE, fixtureGivens, fixtureSolution } from '../fixtures';

vi.mock('../../src/puzzles', () => ({
  newPuzzle: (tier: 'easy' | 'medium' | 'hard' | 'expert') => ({
    id: `${tier}-fixture`,
    tier,
    givens: fixtureGivens(),
    solution: fixtureSolution(),
  }),
}));

const s = () => useStore.getState();

const firstEmpty = () => fixtureGivens().indexOf(0);

const wrongDigitFor = (index: number): Digit => {
  const right = fixtureSolution()[index]!;
  return ((right % 9) + 1) as Digit;
};

beforeEach(() => {
  s().hydrate({});
  s().newGame('easy');
});

describe('game lifecycle', () => {
  it('starts a game with givens on the board and records the start', () => {
    expect(s().game.status).toBe('playing');
    expect(s().game.cells.values).toEqual(fixtureGivens());
    expect(s().stats.perTier.easy.started).toBe(1);
  });

  it('pauses and resumes', () => {
    s().pause();
    expect(s().game.status).toBe('paused');
    s().tick(1000);
    expect(s().game.elapsedMs).toBe(0); // no time accrues while paused
    s().resume();
    s().tick(1000);
    expect(s().game.elapsedMs).toBe(1000);
  });

  it('restart resets board, timer, history and counters', () => {
    const i = firstEmpty();
    s().selectCell(i);
    s().applyDigit(wrongDigitFor(i));
    s().tick(5000);
    s().restartPuzzle();
    expect(s().game.cells.values).toEqual(fixtureGivens());
    expect(s().game.elapsedMs).toBe(0);
    expect(s().game.mistakes).toBe(0);
    expect(s().game.past).toHaveLength(0);
  });
});

describe('placement', () => {
  it('places digits into the selection', () => {
    const i = firstEmpty();
    const d = fixtureSolution()[i]! as Digit;
    s().selectCell(i);
    s().applyDigit(d);
    expect(s().game.cells.values[i]).toBe(d);
  });

  it('never writes into givens', () => {
    const givenIndex = fixtureGivens().findIndex((v) => v !== 0);
    s().selectCell(givenIndex);
    s().applyDigit(5);
    expect(s().game.cells.values[givenIndex]).toBe(fixtureGivens()[givenIndex]);
  });

  it('counts mistakes in warn mode, not when off', () => {
    const i = firstEmpty();
    s().selectCell(i);
    s().applyDigit(wrongDigitFor(i));
    expect(s().game.mistakes).toBe(1);

    s().hydrate({ settings: { mistakeChecking: 'off' } });
    s().newGame('easy');
    s().selectCell(i);
    s().applyDigit(wrongDigitFor(i));
    expect(s().game.mistakes).toBe(0);
  });

  it('undo and redo walk the command history', () => {
    const i = firstEmpty();
    const d = fixtureSolution()[i]! as Digit;
    s().selectCell(i);
    s().applyDigit(d);
    s().undo();
    expect(s().game.cells.values[i]).toBe(0);
    s().redo();
    expect(s().game.cells.values[i]).toBe(d);
  });
});

describe('notes', () => {
  it('toggles corner and center marks via note mode', () => {
    const i = firstEmpty();
    s().selectCell(i);
    s().setNoteMode('corner');
    s().applyDigit(3);
    expect(s().game.cells.corner[i]).not.toBe(0);
    s().setNoteMode('center');
    s().applyDigit(4);
    expect(s().game.cells.center[i]).not.toBe(0);
    expect(s().game.cells.values[i]).toBe(0);
  });

  it('pencil toggle remembers the last submode', () => {
    s().setNoteMode('center');
    s().togglePencil();
    expect(s().game.noteMode).toBe('off');
    s().togglePencil();
    expect(s().game.noteMode).toBe('center');
  });

  it('blocks hand-editing notes in auto-candidate mode', () => {
    s().setSetting('autoCandidates', true);
    const i = firstEmpty();
    s().selectCell(i);
    s().setNoteMode('corner');
    s().applyDigit(3);
    expect(s().game.cells.corner[i]).toBe(0);
  });

  it('fill notes writes candidates; clear notes wipes them', () => {
    s().fillNotes();
    const i = firstEmpty();
    expect(s().game.cells.center[i]).not.toBe(0);
    s().clearNotes();
    expect(s().game.cells.center[i]).toBe(0);
  });
});

describe('input modes', () => {
  it('number-first: pad arms a digit, tapping a cell applies it', () => {
    s().setSetting('inputMode', 'number-first');
    const i = firstEmpty();
    const d = fixtureSolution()[i]! as Digit;
    s().padDigit(d);
    expect(s().game.armedDigit).toBe(d);
    s().tapCell(i);
    expect(s().game.cells.values[i]).toBe(d);
    // still armed for the next cell
    expect(s().game.armedDigit).toBe(d);
  });

  it('cell-first: pad applies to the selected cell', () => {
    const i = firstEmpty();
    const d = fixtureSolution()[i]! as Digit;
    s().tapCell(i);
    s().padDigit(d);
    expect(s().game.cells.values[i]).toBe(d);
  });
});

describe('hints & checks', () => {
  it('reveal-a-cell fills the selected cell with the solution', () => {
    const i = firstEmpty();
    s().selectCell(i);
    s().hint();
    expect(s().game.cells.values[i]).toBe(fixtureSolution()[i]);
    expect(s().game.hintsUsed).toBe(1);
  });

  it('check flags wrong entries and the next edit clears the flags', () => {
    const i = firstEmpty();
    s().selectCell(i);
    s().applyDigit(wrongDigitFor(i));
    s().checkNow();
    expect(s().game.checkFlagged).toContain(i);
    s().applyDigit(fixtureSolution()[i]! as Digit);
    expect(s().game.checkFlagged).toHaveLength(0);
  });
});

describe('winning', () => {
  const solveAll = () => {
    const solution = fixtureSolution();
    const givens = fixtureGivens();
    for (let i = 0; i < 81; i++) {
      if (givens[i] === 0) {
        s().selectCell(i);
        s().applyDigit(solution[i]! as Digit);
      }
    }
  };

  it('detects the win, records stats, and locks the board', () => {
    s().tick(90_000);
    solveAll();
    expect(s().game.status).toBe('won');
    expect(s().stats.perTier.easy.wins).toBe(1);
    expect(s().stats.perTier.easy.bestMs).toBe(90_000);
    expect(s().stats.currentStreak).toBe(1);

    // Board is locked after the win.
    const anyIndex = fixtureGivens().indexOf(0);
    s().selectCell(anyIndex);
    s().erase();
    expect(s().game.cells.values[anyIndex]).toBe(fixtureSolution()[anyIndex]);
  });

  it('a wrong final cell does not win', () => {
    const solution = fixtureSolution();
    const givens = fixtureGivens();
    const empties = givens.flatMap((v, i) => (v === 0 ? [i] : []));
    for (const i of empties.slice(0, -1)) {
      s().selectCell(i);
      s().applyDigit(solution[i]! as Digit);
    }
    const last = empties[empties.length - 1]!;
    s().selectCell(last);
    s().applyDigit(wrongDigitFor(last));
    expect(s().game.status).toBe('playing');
  });
});

describe('persistence shape', () => {
  it('fixture puzzle string matches the fixture solution', () => {
    const givens = fixtureGivens();
    const solution = fixtureSolution();
    for (let i = 0; i < 81; i++) {
      if (givens[i] !== 0) expect(givens[i]).toBe(solution[i]);
    }
    expect(FIXTURE_PUZZLE).toHaveLength(81);
  });
});
