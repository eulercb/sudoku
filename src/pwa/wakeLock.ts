/**
 * Screen Wake Lock, held while a game is actively being played (setting).
 * The lock is dropped by the platform when the tab hides; callers re-request
 * on visibility change.
 */

type WakeLockSentinelLike = { release(): Promise<void> } | null;

let sentinel: WakeLockSentinelLike = null;

export async function acquireWakeLock(): Promise<void> {
  if (sentinel) return;
  try {
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request(type: 'screen'): Promise<NonNullable<WakeLockSentinelLike>> };
      }
    ).wakeLock;
    if (!wakeLock) return;
    sentinel = await wakeLock.request('screen');
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
