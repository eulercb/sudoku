import { useStore } from '../store';
import type { AccentName } from '../store/settingsSlice';
import { Sheet } from './Sheet';
import { ChoiceRow, Group, ToggleRow } from './settingsControls';
import styles from './SettingsSheet.module.css';

const ACCENTS: readonly { value: AccentName; color: string }[] = [
  { value: 'indigo', color: '#5b68c7' },
  { value: 'teal', color: '#35897c' },
  { value: 'plum', color: '#a1669f' },
  { value: 'ember', color: '#c07a4b' },
];

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);

  return (
    <Sheet title="Settings" onClose={onClose}>
      <Group label="Appearance">
        <ChoiceRow
          label="Theme"
          value={settings.theme}
          options={[
            { value: 'system', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'sepia', label: 'Sepia' },
            { value: 'high-contrast', label: 'Contrast' },
          ]}
          onChange={(v) => setSetting('theme', v)}
        />
        <div className={styles.accentRow}>
          <span className={styles.accentLabel} id="accent-label">
            Accent
          </span>
          <div className={styles.accents} role="radiogroup" aria-labelledby="accent-label">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                role="radio"
                aria-checked={settings.accent === a.value}
                aria-label={`Accent ${a.value}`}
                className={`${styles.accentDot} ${settings.accent === a.value ? styles.accentOn : ''}`}
                style={{ background: a.color }}
                onClick={() => setSetting('accent', a.value)}
              />
            ))}
          </div>
        </div>
        <ToggleRow
          label="Show timer"
          checked={settings.showTimer}
          onChange={(v) => setSetting('showTimer', v)}
        />
      </Group>

      <Group label="Input">
        <ChoiceRow
          label="Entry order"
          hint="Cell first: pick a cell, then a number. Number first: arm a number, then tap cells."
          value={settings.inputMode}
          options={[
            { value: 'cell-first', label: 'Cell first' },
            { value: 'number-first', label: 'Number first' },
          ]}
          onChange={(v) => setSetting('inputMode', v)}
        />
        <ToggleRow
          label="Hide completed numbers"
          hint="Fade a number from the pad once all nine are placed"
          checked={settings.removeCompletedDigits}
          onChange={(v) => setSetting('removeCompletedDigits', v)}
        />
      </Group>

      <Group label="Assists">
        <ChoiceRow
          label="Mistakes"
          hint="Warn marks wrong entries as you play; On request only via Check"
          value={settings.mistakeChecking}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'warn', label: 'Warn' },
            { value: 'on-request', label: 'On request' },
          ]}
          onChange={(v) => setSetting('mistakeChecking', v)}
        />
        <ChoiceRow
          label="Conflicts"
          hint="Highlight duplicate digits in a row, column, or box"
          value={settings.conflictHighlight}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on-error', label: 'Live' },
            { value: 'on-check', label: 'On check' },
          ]}
          onChange={(v) => setSetting('conflictHighlight', v)}
        />
        <ChoiceRow
          label="Hint button"
          value={settings.hintStyle}
          options={[
            { value: 'reveal-cell', label: 'Reveal a cell' },
            { value: 'check-entries', label: 'Check entries' },
          ]}
          onChange={(v) => setSetting('hintStyle', v)}
        />
        <ToggleRow
          label="Highlight row, column & box"
          checked={settings.highlightPeers}
          onChange={(v) => setSetting('highlightPeers', v)}
        />
        <ToggleRow
          label="Highlight matching numbers"
          checked={settings.highlightSameDigit}
          onChange={(v) => setSetting('highlightSameDigit', v)}
        />
      </Group>

      <Group label="Pencil marks">
        <ToggleRow
          label="Automatic candidates"
          hint="The app maintains all candidates for you; hand-editing is off"
          checked={settings.autoCandidates}
          onChange={(v) => setSetting('autoCandidates', v)}
        />
        <ToggleRow
          label="Clean up after placing"
          hint="Placing a number removes it from notes in the same row, column & box"
          checked={settings.autoRemovePeers}
          onChange={(v) => setSetting('autoRemovePeers', v)}
        />
      </Group>

      <Group label="Device">
        <ToggleRow
          label="Keep screen awake"
          checked={settings.wakeLock}
          onChange={(v) => setSetting('wakeLock', v)}
        />
        <ToggleRow
          label="Vibration"
          hint="A gentle buzz on mistakes and wins"
          checked={settings.haptics}
          onChange={(v) => setSetting('haptics', v)}
        />
      </Group>
    </Sheet>
  );
}
