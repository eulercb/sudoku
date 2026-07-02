import type { KeyboardEvent } from 'react';

/**
 * Standard radiogroup arrow-key behavior: Left/Up previous, Right/Down next.
 * Focus follows the checked radio (which alone is tabbable).
 */
export function radioGroupKeyDown<T extends string>(
  e: KeyboardEvent<HTMLElement>,
  values: readonly T[],
  current: T,
  onChange: (value: T) => void,
): void {
  const backward = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
  const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
  if (!backward && !forward) return;
  e.preventDefault();
  e.stopPropagation();
  const index = values.indexOf(current);
  const next = values[(index + (forward ? 1 : -1) + values.length) % values.length]!;
  onChange(next);
  const radios = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
  radios[values.indexOf(next)]?.focus();
}
