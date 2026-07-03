import { useStore } from '../store';
import { TIERS } from '../game/types';
import { TIER_LABELS } from './format';
import { Sheet } from './Sheet';
import styles from './NewGameSheet.module.css';

const TIER_HINTS = {
  easy: 'Singles and simple scans',
  medium: 'Pairs and pointing candidates',
  hard: 'Subsets and deeper elimination',
  expert: 'Fishing and wings territory',
} as const;

export function NewGameSheet({ onClose }: { onClose: () => void }) {
  const newGame = useStore((s) => s.newGame);
  const inProgress = useStore((s) => s.game.status === 'playing' || s.game.status === 'paused');

  return (
    <Sheet title="New game" onClose={onClose}>
      <div className={styles.tiers}>
        {TIERS.map((tier) => (
          <button key={tier} className={styles.tier} onClick={() => newGame(tier)}>
            <span className={styles.tierName}>{TIER_LABELS[tier]}</span>
            <span className={styles.tierHint}>{TIER_HINTS[tier]}</span>
          </button>
        ))}
      </div>
      {inProgress && <p className={styles.note}>Starting a new game abandons the current one.</p>}
    </Sheet>
  );
}
