import type { ReactNode } from 'react';
import { radioGroupKeyDown } from './radioGroup';
import styles from './settingsControls.module.css';

/** Small primitives shared by the settings sheet: toggle rows and segmented choices. */

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupLabel}>{label}</h3>
      <div className={styles.groupBody}>{children}</div>
    </section>
  );
}

interface ToggleRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleRow({ label, hint, checked, onChange }: ToggleRowProps) {
  return (
    <label className={styles.row}>
      <span className={styles.rowText}>
        <span>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className={styles.switch}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

interface ChoiceRowProps<T extends string | number> {
  label: string;
  hint?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function ChoiceRow<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
}: ChoiceRowProps<T>) {
  const labelId = `choice-${slug(label)}`;
  const values = options.map((o) => o.value);
  return (
    <div className={styles.row}>
      <span className={styles.rowText} id={labelId}>
        <span>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
      <div
        className={styles.segment}
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={(e) => radioGroupKeyDown(e, values, value, onChange)}
      >
        {options.map((option) => (
          <button
            key={option.value}
            role="radio"
            aria-checked={value === option.value}
            tabIndex={value === option.value ? 0 : -1}
            className={value === option.value ? styles.segmentOn : ''}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
