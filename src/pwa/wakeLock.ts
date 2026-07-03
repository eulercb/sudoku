/**
 * Screen Wake Lock, held while a game is actively being played (setting).
 * The platform auto-releases the lock whenever the tab hides or the screen
 * turns off, so the sentinel is cleared on its 'release' event and callers
 * re-request on visibility change.
 */

interface WakeLockSentinelLike {
  release(): Promise<void>;
  readonly released?: boolean;
  addEventListener?(type: 'release', listener: () => void): void;
}

let sentinel: WakeLockSentinelLike | null = null;

export async function acquireWakeLock(): Promise<void> {
  if (sentinel && sentinel.released !== true) return;
  try {
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
      }
    ).wakeLock;
    if (!wakeLock) return;
    const acquired = await wakeLock.request('screen');
    sentinel = acquired;
    acquired.addEventListener?.('release', () => {
      if (sentinel === acquired) sentinel = null;
    });
  } catch {
    sentinel = null; // Denied (low battery, etc.) — fine.
  }
}

export async function releaseWakeLock(): Promise<void> {
  const current = sentinel;
  sentinel = null;
  try {
    await current?.release();
  } catch {
    // Already released.
  }
}
