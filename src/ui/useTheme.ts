import { useEffect } from 'react';
import { useStore } from '../store';

/**
 * Applies the theme + accent to <html> and keeps the browser chrome color in
 * sync. 'system' follows prefers-color-scheme live. The chosen theme is
 * mirrored to localStorage so the inline script in index.html can apply it
 * before first paint (no light flash for dark users).
 */
export function useTheme(): void {
  const theme = useStore((s) => s.settings.theme);
  const accent = useStore((s) => s.settings.accent);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      root.dataset.theme = resolved;
      root.dataset.accent = accent;
      try {
        localStorage.setItem('sudoku:theme', theme);
        localStorage.setItem('sudoku:accent', accent);
      } catch {
        // Storage may be unavailable; the pre-paint script just falls back.
      }
      // Match the status bar to the theme background. Read the custom
      // property, not the body's computed background — the latter is
      // mid-transition for 300ms after a theme switch.
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bg) {
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
      }
    };

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, accent]);
}
