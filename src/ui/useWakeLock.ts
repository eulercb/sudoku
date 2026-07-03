import { useEffect } from 'react';
import { useStore } from '../store';
import { acquireWakeLock, releaseWakeLock } from '../pwa/wakeLock';

/** Holds a screen wake lock while a game is actively being played (setting). */
export function useWakeLock(): void {
  const wanted = useStore((s) => s.settings.wakeLock && s.game.status === 'playing');

  useEffect(() => {
    if (!wanted) {
      void releaseWakeLock();
      return;
    }

    const request = () => {
      if (document.visibilityState === 'visible') void acquireWakeLock();
    };

    request();
    // The platform releases the lock when the tab hides; re-acquire on return.
    document.addEventListener('visibilitychange', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      void releaseWakeLock();
    };
  }, [wanted]);
}
