export type ThemeName = 'system' | 'light' | 'dark' | 'sepia' | 'high-contrast';
export type AccentName = 'indigo' | 'teal' | 'plum' | 'ember';
export type InputMode = 'cell-first' | 'number-first';
export type ConflictHighlight = 'off' | 'on-error' | 'on-check';
export type MistakeChecking = 'off' | 'warn' | 'on-request';
export type HintStyle = 'reveal-cell' | 'check-entries';
export type PadLayout = 'row' | 'grid';

/**
 * How many undos in a row are allowed before a fresh move is required.
 * 0 is unlimited. The history itself is never truncated by this — the cap is
 * self-imposed friction, not data loss.
 */
export const UNDO_LIMITS = [0, 3, 5, 10] as const;
export type UndoLimit = (typeof UNDO_LIMITS)[number];

export interface SettingsState {
  theme: ThemeName;
  accent: AccentName;
  inputMode: InputMode;
  highlightPeers: boolean;
  highlightSameDigit: boolean;
  conflictHighlight: ConflictHighlight;
  /** App-managed candidates: notes are derived, not hand-edited. */
  autoCandidates: boolean;
  autoRemovePeers: boolean;
  mistakeChecking: MistakeChecking;
  hintStyle: HintStyle;
  /** Keep the Hint button in the control row (off = no hint affordance at all). */
  showHintButton: boolean;
  showTimer: boolean;
  removeCompletedDigits: boolean;
  /** Number pad shape: one row of nine, or a 3×3 block. */
  padLayout: PadLayout;
  /** Consecutive-undo cap; 0 = unlimited. */
  undoLimit: UndoLimit;
  wakeLock: boolean;
  haptics: boolean;
}

/** Casual-friendly defaults; every assist can be switched off for veteran play. */
export const DEFAULT_SETTINGS: SettingsState = {
  theme: 'system',
  accent: 'indigo',
  inputMode: 'cell-first',
  highlightPeers: true,
  highlightSameDigit: true,
  conflictHighlight: 'on-error',
  autoCandidates: false,
  autoRemovePeers: true,
  mistakeChecking: 'warn',
  hintStyle: 'reveal-cell',
  showHintButton: true,
  showTimer: true,
  removeCompletedDigits: true,
  padLayout: 'row',
  undoLimit: 0,
  wakeLock: true,
  haptics: true,
};

/** Merge persisted settings over defaults, dropping unknown keys. */
export function hydrateSettings(persisted: unknown): SettingsState {
  const out = { ...DEFAULT_SETTINGS };
  if (persisted && typeof persisted === 'object') {
    for (const key of Object.keys(out) as (keyof SettingsState)[]) {
      const value = (persisted as Record<string, unknown>)[key];
      if (value !== undefined && typeof value === typeof out[key]) {
        (out as Record<string, unknown>)[key] = value;
      }
    }
  }
  // These two gate control flow (pad shape, undo availability), so a stale or
  // hand-edited value falls back rather than soft-locking the button.
  if (!UNDO_LIMITS.includes(out.undoLimit)) out.undoLimit = DEFAULT_SETTINGS.undoLimit;
  if (out.padLayout !== 'row' && out.padLayout !== 'grid') {
    out.padLayout = DEFAULT_SETTINGS.padLayout;
  }
  return out;
}
