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

  it('shows the win dialog when the game is won', () => {
    act(() => s().newGame('easy'));
    render(<App />);
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
    expect(screen.getByRole('alertdialog', { name: /solved/i })).toBeInTheDocument();
    expect(screen.getByText(/play again/i)).toBeInTheDocument();
  });
});
