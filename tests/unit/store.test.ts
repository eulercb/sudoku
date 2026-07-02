import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PEERS } from '../../src/game/board';
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

/** Drive the game clock deterministically via a mocked performance.now(). */
let fakeNow = 0;
const advance = (ms: number) => {
  fakeNow += ms;
  s().timerTick();
};

beforeEach(() => {
  fakeNow = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);
  s().hydrate({});
  s().newGame('easy');
  s().timerStart();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('game lifecycle', () => {
  it('starts a game with givens on the board and records the start', () => {
    expect(s().game.status).toBe('playing');
    expect(s().game.cells.values).toEqual(fixtureGivens());
    expect(s().stats.perTier.easy.started).toBe(1);
  });

  it('pauses and resumes, never counting paused time', () => {
    advance(1000);
    expect(s().game.elapsedMs).toBe(1000);
    s().pause();
    expect(s().game.status).toBe('paused');
    fakeNow += 5000;
    s().timerTick(); // ignored while paused
    expect(s().game.elapsedMs).toBe(1000);
    s().resume();
    s().timerStart();
    advance(1000);
    expect(s().game.elapsedMs).toBe(2000);
  });

  it('pause folds the in-flight fraction of a second', () => {
    advance(1000);
    fakeNow += 400; // 400ms accrued but not yet ticked
    s().pause();
    expect(s().game.elapsedMs).toBe(1400);
  });

  it('winning folds pending time into the recorded solve time', () => {
    advance(90_000);
    fakeNow += 250;
    const solution = fixtureSolution();
    const givens = fixtureGivens();
    for (let i = 0; i < 81; i++) {
      if (givens[i] === 0) {
        s().selectCell(i);
        s().applyDigit(solution[i]! as Digit);
      }
    }
    expect(s().game.status).toBe('won');
    expect(s().stats.perTier.easy.bestMs).toBe(90_250);
  });

  it('restart resets board, timer, history and counters', () => {
    const i = firstEmpty();
    s().selectCell(i);
    s().applyDigit(wrongDigitFor(i));
    advance(5000);
    s().restartPuzzle();
    expect(s().game.cells.values).toEqual(fixtureGivens());
    expect(s().game.elapsedMs).toBe(0);
    expect(s().game.mistakes).toBe(0);
    expect(s().game.past).toHaveLength(0);
    // The clock self-heals on the next tick and keeps counting.
    advance(1000);
    advance(1000);
    expect(s().game.elapsedMs).toBe(1000);
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

  it('auto-candidate mode forces the pencil off and keeps digits placing values', () => {
    // Pencil active, then the user enables app-managed candidates.
    s().setNoteMode('corner');
    s().setSetting('autoCandidates', true);
    expect(s().game.noteMode).toBe('off'); // never mixed, never soft-locked

    // Pencil mode cannot be re-entered while auto candidates are on.
    s().setNoteMode('center');
    expect(s().game.noteMode).toBe('off');
    s().togglePencil();
    expect(s().game.noteMode).toBe('off');

    // Digit entry still places values, and no user notes get edited.
    const i = firstEmpty();
    const d = fixtureSolution()[i]! as Digit;
    s().selectCell(i);
    s().applyDigit(d);
    expect(s().game.cells.values[i]).toBe(d);
    expect(s().game.cells.corner[i]).toBe(0);
  });

  it('hydrating auto-candidates settings normalizes a persisted pencil mode', () => {
    s().hydrate({ settings: { autoCandidates: true } });
    s().newGame('easy');
    expect(s().game.noteMode).toBe('off');
    s().setNoteMode('corner');
    expect(s().game.noteMode).toBe('off');
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

describe('number-first tools', () => {
  it('padErase arms the eraser and a second press disarms it', () => {
    s().setSetting('inputMode', 'number-first');
    s().padErase();
    expect(s().game.armedErase).toBe(true);
    const i = firstEmpty();
    const d = fixtureSolution()[i]! as Digit;
    s().armDigit(d); // arming a digit clears the eraser
    expect(s().game.armedErase).toBe(false);
    s().tapCell(i);
    expect(s().game.cells.values[i]).toBe(d);
    s().padErase();
    s().tapCell(i);
    expect(s().game.cells.values[i]).toBe(0);
    s().padErase();
    expect(s().game.armedErase).toBe(false); // disarmed, taps only select again
  });

  it('disarms the digit once all nine are placed and the pad key hides', () => {
    s().setSetting('inputMode', 'number-first');
    const solution = fixtureSolution();
    const givens = fixtureGivens();
    const d = solution[firstEmpty()]! as Digit;
    const missing = solution.flatMap((v, i) => (v === d && givens[i] === 0 ? [i] : []));
    // Place all but the last via plain selection entry.
    for (const i of missing.slice(0, -1)) {
      s().selectCell(i);
      s().applyDigit(d);
    }
    const lastCell = missing[missing.length - 1]!;
    s().padDigit(d);
    expect(s().game.armedDigit).toBe(d);
    s().tapCell(lastCell);
    expect(s().game.cells.values[lastCell]).toBe(d);
    expect(s().game.armedDigit).toBeNull();
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

  it('check respects mistakeChecking off: only rule conflicts are flagged', () => {
    s().setSetting('mistakeChecking', 'off');
    // Find a wrong-but-conflict-free entry: a digit that differs from the
    // solution yet appears nowhere among the cell's peers.
    const givens = fixtureGivens();
    const solution = fixtureSolution();
    let cell = -1;
    let wrong: Digit | null = null;
    outer: for (let i = 0; i < 81; i++) {
      if (givens[i] !== 0) continue;
      const peerDigits = new Set(PEERS[i]!.map((p) => givens[p]));
      for (let d = 1; d <= 9; d++) {
        if (d !== solution[i] && !peerDigits.has(d as Digit)) {
          cell = i;
          wrong = d as Digit;
          break outer;
        }
      }
    }
    expect(wrong).not.toBeNull();
    s().selectCell(cell);
    s().applyDigit(wrong!);
    s().checkNow();
    // Wrong against the solution, but no oracle leak: nothing is flagged.
    expect(s().game.checkFlagged).toHaveLength(0);
  });

  it('clear board wipes entries undoably', () => {
    const i = firstEmpty();
    const d = fixtureSolution()[i]! as Digit;
    s().selectCell(i);
    s().applyDigit(d);
    s().clearBoard();
    expect(s().game.cells.values).toEqual(fixtureGivens());
    s().undo();
    expect(s().game.cells.values[i]).toBe(d);
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
    advance(90_000);
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
