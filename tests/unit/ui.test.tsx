import { act, render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cell } from '../../src/ui/Cell';
import { NumberPad } from '../../src/ui/NumberPad';
import { App } from '../../src/ui/App';
import { useStore } from '../../src/store';
import { digitsToNotes } from '../../src/game/notes';
import type { Digit } from '../../src/game/types';
import { fixtureGivens, fixtureSolution } from '../fixtures';

vi.mock('../../src/puzzles', () => ({
  newPuzzle: (tier: 'easy' | 'medium' | 'hard' | 'expert') => ({
    id: `${tier}-fixture`,
    tier,
    givens: fixtureGivens(),
    solution: fixtureSolution(),
  }),
}));

const s = () => useStore.getState();

/** Fill every empty cell with its solution digit, winning the fixture. */
const solveFixture = () => {
  const solution = fixtureSolution();
  const givens = fixtureGivens();
  act(() => {
    for (let i = 0; i < 81; i++) {
      if (givens[i] === 0) {
        s().selectCell(i);
        s().applyDigit(solution[i]! as Digit);
      }
    }
  });
};

beforeEach(() => {
  act(() => {
    s().hydrate({});
  });
});

describe('Cell', () => {
  const base = {
    index: 0,
    value: 0 as const,
    given: false,
    cornerMask: 0,
    selected: false,
    peer: false,
    sameDigit: false,
    flagged: false,
    hidden: false,
  };

  it('renders a value', () => {
    render(<Cell {...base} value={7} />);
    expect(screen.getByRole('gridcell')).toHaveTextContent('7');
  });

  it('renders corner marks for empty cells', () => {
    render(<Cell {...base} cornerMask={digitsToNotes([1, 4, 9])} />);
    const cell = screen.getByRole('gridcell');
    expect(cell).toHaveTextContent('149');
    expect(cell).toHaveAccessibleName(/notes 1 4 9/);
  });

  it('gives every corner mark the fixed slot class of its digit', () => {
    render(<Cell {...base} cornerMask={digitsToNotes([1, 5, 9])} />);
    const marks = Array.from(screen.getByRole('gridcell').querySelectorAll('i'));
    expect(marks.map((m) => m.textContent)).toEqual(['1', '5', '9']);
    for (const mark of marks) {
      expect(mark.className).toContain(`d-${mark.textContent}`);
    }
  });

  it('keeps a digit in its own slot regardless of the other marks', () => {
    const { rerender } = render(<Cell {...base} cornerMask={digitsToNotes([9])} />);
    const only = screen.getByRole('gridcell').querySelector('i')!;
    expect(only.textContent).toBe('9');
    expect(only.className).toContain('d-9');

    rerender(<Cell {...base} cornerMask={digitsToNotes([2, 9])} />);
    const nine = Array.from(screen.getByRole('gridcell').querySelectorAll('i')).find(
      (m) => m.textContent === '9',
    )!;
    expect(nine.className).toContain('d-9');
  });

  it('hides content while paused', () => {
    render(<Cell {...base} value={7} hidden />);
    expect(screen.getByRole('gridcell')).toHaveTextContent('');
  });
});

describe('NumberPad', () => {
  it('shows remaining counts and fades completed digits', () => {
    act(() => s().newGame('easy'));
    render(<NumberPad />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(9);

    // Fixture has some 9s placed; count the remainder.
    const nines = fixtureGivens().filter((v) => v === 9).length;
    expect(screen.getByRole('button', { name: /enter 9/i })).toHaveTextContent(String(9 - nines));
  });

  it('feeds digits into the selected cell', () => {
    const i = fixtureGivens().indexOf(0);
    const d = fixtureSolution()[i]! as Digit;
    act(() => {
      s().newGame('easy');
      s().selectCell(i);
    });
    render(<NumberPad />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`enter ${d}`, 'i') }));
    expect(s().game.cells.values[i]).toBe(d);
  });
});

describe('App', () => {
  it('shows a minimal resting screen with a start affordance when idle', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /start a game/i })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /sudoku board/i })).toBeInTheDocument();
  });

  it('starts a game from the new-game sheet', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /start a game/i }));
    expect(s().openSheet).toBe('newGame');
    fireEvent.click(screen.getByRole('button', { name: /easy/i }));
    expect(s().game.status).toBe('playing');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens settings from the menu and toggles a setting', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    const timerSwitch = screen.getByRole('switch', { name: /show timer/i });
    expect(timerSwitch).toBeChecked();
    fireEvent.click(timerSwitch);
    expect(s().settings.showTimer).toBe(false);
  });

  it('folds the hint style away when the hint button is hidden', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByRole('radio', { name: /reveal a cell/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: /show hint button/i }));
    expect(s().settings.showHintButton).toBe(false);
    expect(screen.queryByRole('radio', { name: /reveal a cell/i })).not.toBeInTheDocument();
  });

  it('sets the undo limit from the settings sheet', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(s().settings.undoLimit).toBe(0);
    fireEvent.click(screen.getByRole('radio', { name: '3' }));
    expect(s().settings.undoLimit).toBe(3);
  });

  it('shows the win dialog when the game is won', () => {
    act(() => s().newGame('easy'));
    render(<App />);
    solveFixture();
    expect(screen.getByRole('alertdialog', { name: /solved/i })).toBeInTheDocument();
    expect(screen.getByText(/play again/i)).toBeInTheDocument();
  });

  it('reports the solve breakdown on the win dialog', () => {
    act(() => s().newGame('easy'));
    render(<App />);
    act(() => {
      const i = fixtureGivens().indexOf(0);
      s().selectCell(i);
      s().applyDigit(((fixtureSolution()[i]! % 9) + 1) as Digit); // wrong
      s().undo();
      s().fillNotes();
    });
    solveFixture();

    const breakdown = screen.getByRole('alertdialog').querySelector('dl')!;
    const read = (label: string) =>
      Array.from(breakdown.querySelectorAll('div'))
        .find((row) => row.querySelector('dt')?.textContent === label)
        ?.querySelector('dd')?.textContent;

    expect(read('Mistakes')).toBe('1');
    expect(read('Undos')).toBe('1');
    expect(read('Auto')).toBe('1');
    expect(read('Hints')).toBe('0');
    // Unused assists stay off the card.
    expect(read('Checks')).toBeUndefined();
  });

  it('hides the hint button when the setting is off', () => {
    act(() => s().newGame('easy'));
    render(<App />);
    expect(screen.getByRole('button', { name: /hint/i })).toBeInTheDocument();
    act(() => s().setSetting('showHintButton', false));
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('switches the number pad between one row and a 3×3 block', () => {
    act(() => s().newGame('easy'));
    const { container } = render(<App />);
    const pad = () => screen.getByRole('toolbar', { name: /number pad/i });
    expect(pad().className).not.toMatch(/grid/);

    act(() => s().setSetting('padLayout', 'grid'));
    expect(pad().className).toMatch(/grid/);
    // The board reads the layout to budget its own height.
    expect(container.querySelector('[data-pad="grid"]')).toBeInTheDocument();
  });

  it('disables undo once the configured limit is reached', () => {
    act(() => {
      s().newGame('easy');
      s().setSetting('undoLimit', 3);
      const empties = fixtureGivens().flatMap((v, i) => (v === 0 ? [i] : []));
      for (const i of empties.slice(0, 5)) {
        s().selectCell(i);
        s().applyDigit(fixtureSolution()[i]! as Digit);
      }
    });
    render(<App />);

    const undo = () => screen.getByRole('button', { name: /undo/i });
    for (let n = 0; n < 3; n++) {
      expect(undo()).toBeEnabled();
      fireEvent.click(undo());
    }
    expect(undo()).toBeDisabled();
    expect(undo()).toHaveAccessibleName(/limit reached/i);
    // The history is intact — two commands are still waiting.
    expect(s().game.past).toHaveLength(2);
  });
});
