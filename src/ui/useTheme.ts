import { useEffect } from 'react';
import { useStore } from '../store';

/**
 * Applies the theme + accent to <html> and keeps the browser chrome color in
 * sync. 'system' follows prefers-color-scheme live.
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
      // Match the status bar to the resolved background.
      requestAnimationFrame(() => {
        const bg = getComputedStyle(document.body).backgroundColor;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
      });
    };

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, accent]);
}
