/** Tiny wrapper over the Vibration API; silently a no-op where unsupported. */

export type HapticPattern = 'error' | 'win';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  error: 40,
  win: [25, 70, 25, 70, 60],
};

export function vibrate(pattern: HapticPattern): void {
  try {
    navigator.vibrate?.(PATTERNS[pattern]);
  } catch {
    // Vibration is best-effort only.
  }
}
