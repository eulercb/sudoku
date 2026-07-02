export type ThemeName = 'system' | 'light' | 'dark' | 'sepia' | 'high-contrast';
export type AccentName = 'indigo' | 'teal' | 'plum' | 'ember';
export type InputMode = 'cell-first' | 'number-first';
export type ConflictHighlight = 'off' | 'on-error' | 'on-check';
export type MistakeChecking = 'off' | 'warn' | 'on-request';
export type HintStyle = 'reveal-cell' | 'check-entries';

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
  showTimer: boolean;
  removeCompletedDigits: boolean;
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
  showTimer: true,
  removeCompletedDigits: true,
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
  return out;
}
