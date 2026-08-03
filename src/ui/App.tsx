import { useStore } from '../store';
import { Board } from './Board';
import { Controls } from './Controls';
import { MenuSheet } from './MenuSheet';
import { NewGameSheet } from './NewGameSheet';
import { NumberPad } from './NumberPad';
import { SettingsSheet } from './SettingsSheet';
import { StatsSheet } from './StatsSheet';
import { TopBar } from './TopBar';
import { WinDialog } from './WinDialog';
import { useKeyboard } from './useKeyboard';
import { useTheme } from './useTheme';
import { useTimer } from './useTimer';
import { useWakeLock } from './useWakeLock';
import styles from './App.module.css';

export function App() {
  const status = useStore((s) => s.game.status);
  const openSheet = useStore((s) => s.openSheet);
  const winDismissed = useStore((s) => s.game.winDismissed);
  const padLayout = useStore((s) => s.settings.padLayout);
  const setOpenSheet = useStore((s) => s.setOpenSheet);

  useTheme();
  useTimer();
  useWakeLock();
  useKeyboard(openSheet === 'none' && status === 'playing');

  const close = () => setOpenSheet('none');
  const showWin = status === 'won' && !winDismissed && openSheet === 'none';

  return (
    <div className={styles.app} data-pad={padLayout}>
      <TopBar />
      <main className={styles.main}>
        <Board />
        {status === 'idle' && (
          <button className={styles.start} onClick={() => setOpenSheet('newGame')}>
            Start a game
          </button>
        )}
      </main>
      <div className={styles.inputs}>
        <Controls />
        <NumberPad />
      </div>

      {openSheet === 'menu' && <MenuSheet onClose={close} />}
      {openSheet === 'settings' && <SettingsSheet onClose={close} />}
      {openSheet === 'stats' && <StatsSheet onClose={close} />}
      {openSheet === 'newGame' && <NewGameSheet onClose={close} />}
      {showWin && <WinDialog />}
    </div>
  );
}
