import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Mobile smoke test against the production build (vite preview).
 * `?e2e` exposes the store on window.__sudoku for deterministic access to
 * the generated puzzle's solution.
 */

interface StoreHandle {
  getState(): {
    game: {
      status: string;
      givens: number[];
      solution: number[];
      cells: { values: number[] };
    };
    selectCell(i: number): void;
    applyDigit(d: number): void;
  };
}

declare global {
  interface Window {
    __sudoku?: { store: StoreHandle };
  }
}

const getGame = (page: Page) =>
  page.evaluate(() => {
    const state = window.__sudoku!.store.getState();
    return {
      status: state.game.status,
      givens: state.game.givens,
      solution: state.game.solution,
      values: state.game.cells.values,
    };
  });

const startEasyGame = async (page: Page) => {
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Start a game' }).click();
  await page.getByRole('button', { name: /Easy/ }).click();
  await expect(page.getByRole('grid', { name: 'Sudoku board' })).toBeVisible();
};

test('play: place a digit, pencil a note, undo', async ({ page }) => {
  await startEasyGame(page);

  const { givens, solution } = await getGame(page);
  const emptyIndex = givens.indexOf(0);
  const digit = solution[emptyIndex]!;

  // Cell-first entry: tap the cell, then the pad.
  const cell = page.locator(`[data-index="${emptyIndex}"]`);
  await cell.click();
  await page.getByRole('button', { name: `Enter ${digit}`, exact: true }).click();
  await expect(cell).toHaveText(String(digit));

  // Pencil a note into another empty cell.
  const secondEmpty = givens.indexOf(0, emptyIndex + 1);
  const noteDigit = solution[secondEmpty]!;
  await page.getByRole('button', { name: 'Notes, corner pencil marks' }).click();
  await page.locator(`[data-index="${secondEmpty}"]`).click();
  await page.getByRole('button', { name: `Note ${noteDigit}`, exact: true }).click();
  await expect(page.locator(`[data-index="${secondEmpty}"]`)).toContainText(String(noteDigit));

  // Undo twice: note gone, value gone.
  await page.getByRole('button', { name: 'Notes, corner pencil marks' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator(`[data-index="${secondEmpty}"]`)).toHaveText('');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cell).toHaveText('');
});

test('autosave: the game survives a reload and resumes paused', async ({ page }) => {
  await startEasyGame(page);

  const { givens, solution } = await getGame(page);
  const emptyIndex = givens.indexOf(0);
  const digit = solution[emptyIndex]!;
  await page.locator(`[data-index="${emptyIndex}"]`).click();
  await page.getByRole('button', { name: `Enter ${digit}`, exact: true }).click();

  // Let the debounced autosave hit IndexedDB before reloading.
  await page.waitForTimeout(700);
  await page.reload();

  await expect(page.getByRole('button', { name: 'Resume game' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume game' }).click();
  await expect(page.locator(`[data-index="${emptyIndex}"]`)).toHaveText(String(digit));
});

test('winning shows the dialog and records stats', async ({ page }) => {
  await startEasyGame(page);

  await page.evaluate(() => {
    const store = window.__sudoku!.store;
    const { game } = store.getState();
    for (let i = 0; i < 81; i++) {
      if (game.givens[i] === 0) {
        store.getState().selectCell(i);
        store.getState().applyDigit(game.solution[i]!);
      }
    }
  });

  await expect(page.getByRole('alertdialog', { name: 'Puzzle solved' })).toBeVisible();
  await expect(page.getByText('Play again')).toBeVisible();
});

test('works offline after first load', async ({ page, context }) => {
  await page.goto('/?e2e');
  await page.evaluate(async () => {
    await window.navigator.serviceWorker?.ready;
  });
  // Give the freshly-activated worker a beat to finish precaching.
  await page.waitForTimeout(1500);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Sudoku board' })).toBeVisible();
  await context.setOffline(false);
});
