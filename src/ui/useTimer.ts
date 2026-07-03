import { useEffect } from 'react';
import { useStore } from '../store';

/**
 * Drives the game clock while play is active and the tab is visible.
 * Time spent hidden or paused never counts. The store owns the tick anchor
 * (game.lastTickAt) and folds the in-flight fraction on pause/win itself,
 * so no sub-second slice is ever lost.
 */
export function useTimer(): void {
  const playing = useStore((s) => s.game.status === 'playing');

  useEffect(() => {
    if (!playing) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval !== null) return;
      useStore.getState().timerStart();
      interval = setInterval(() => useStore.getState().timerTick(), 1000);
    };

    const stop = () => {
      if (interval === null) return;
      clearInterval(interval);
      interval = null;
      useStore.getState().timerStop();
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
