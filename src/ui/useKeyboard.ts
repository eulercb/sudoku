import { useEffect } from 'react';
import { useStore } from '../store';
import type { Digit } from '../game/types';

/** Desktop keyboard play: arrows, digits, backspace, undo/redo, pencil. */
export function useKeyboard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const s = useStore.getState();
      const key = e.key;

      if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault();
        const [dr, dc] =
          key === 'ArrowUp'
            ? [-1, 0]
            : key === 'ArrowDown'
              ? [1, 0]
              : key === 'ArrowLeft'
                ? [0, -1]
                : [0, 1];
        s.moveCursor(dr, dc, e.shiftKey);
        return;
      }

      if (key >= '1' && key <= '9') {
        // Ignore held-key auto-repeat (it would toggle the cell and inflate
        // the mistake counter) and browser shortcuts like Ctrl+1.
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        s.applyDigit(Number(key) as Digit);
        return;
      }

      if (key === 'Backspace' || key === 'Delete' || key === '0') {
        e.preventDefault();
        s.erase();
        return;
      }

      if ((key === 'z' || key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        s.undo();
        return;
      }

      if (key === 'y' || key === 'Y' || ((key === 'z' || key === 'Z') && e.shiftKey)) {
        e.preventDefault();
        s.redo();
        return;
      }

      if (key === 'p' || key === 'P' || key === 'n' || key === 'N') {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        s.togglePencil();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
