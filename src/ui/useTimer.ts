import { useEffect } from 'react';
import { useStore } from '../store';

/**
 * Drives the game clock while play is active and the tab is visible.
 * Time spent hidden or paused never counts.
 */
export function useTimer(): void {
  const playing = useStore((s) => s.game.status === 'playing');

  useEffect(() => {
    if (!playing) return;

    let last = performance.now();
    let interval: ReturnType<typeof setInterval> | null = null;

    const tickNow = () => {
      const now = performance.now();
      useStore.getState().tick(now - last);
      last = now;
    };

    const start = () => {
      if (interval !== null) return;
      last = performance.now();
      interval = setInterval(tickNow, 1000);
    };

    const stop = () => {
      if (interval === null) return;
      tickNow();
      clearInterval(interval);
      interval = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [playing]);
}
