import { useState } from 'react';
import { useStore } from '../store';
import { promptInstall } from '../pwa/installPrompt';
import {
  BroomIcon,
  CheckIcon,
  DownloadIcon,
  EraseIcon,
  GearIcon,
  PlusIcon,
  RestartIcon,
  StatsIcon,
} from './icons';
import { Sheet } from './Sheet';
import { useInstallable } from './useInstallable';
import styles from './MenuSheet.module.css';

export function MenuSheet({ onClose }: { onClose: () => void }) {
  const setOpenSheet = useStore((s) => s.setOpenSheet);
  const restartPuzzle = useStore((s) => s.restartPuzzle);
  const clearNotes = useStore((s) => s.clearNotes);
  const clearBoard = useStore((s) => s.clearBoard);
  const checkNow = useStore((s) => s.checkNow);
  const inGame = useStore((s) => s.game.status === 'playing' || s.game.status === 'paused');
  const autoCandidates = useStore((s) => s.settings.autoCandidates);
  // Check would flag nothing when both assists are off — hide it then.
  const checkUseful = useStore(
    (s) => s.settings.mistakeChecking !== 'off' || s.settings.conflictHighlight !== 'off',
  );
  const installable = useInstallable();
  const [confirmRestart, setConfirmRestart] = useState(false);

  return (
    <Sheet title="Menu" onClose={onClose}>
      <div className={styles.items}>
        <button className={styles.item} onClick={() => setOpenSheet('newGame')}>
          <PlusIcon />
          <span>New game</span>
        </button>
        {inGame && (
          <button
            className={`${styles.item} ${confirmRestart ? styles.danger : ''}`}
            onClick={() => {
              if (confirmRestart) restartPuzzle();
              else setConfirmRestart(true);
            }}
          >
            <RestartIcon />
            <span>{confirmRestart ? 'Tap again to restart this puzzle' : 'Restart puzzle'}</span>
          </button>
        )}
        {inGame && checkUseful && (
          <button
            className={styles.item}
            onClick={() => {
              checkNow();
              onClose();
            }}
          >
            <CheckIcon />
            <span>Check board</span>
          </button>
        )}
        {inGame && !autoCandidates && (
          <button
            className={styles.item}
            onClick={() => {
              clearNotes();
              onClose();
            }}
          >
            <BroomIcon />
            <span>Clear all notes</span>
          </button>
        )}
        {inGame && (
          <button
            className={styles.item}
            onClick={() => {
              clearBoard();
              onClose();
            }}
          >
            <EraseIcon />
            <span>Clear board</span>
          </button>
        )}
        <button className={styles.item} onClick={() => setOpenSheet('stats')}>
          <StatsIcon />
          <span>Statistics</span>
        </button>
        <button className={styles.item} onClick={() => setOpenSheet('settings')}>
          <GearIcon />
          <span>Settings</span>
        </button>
        {installable && (
          <button
            className={styles.item}
            onClick={() => {
              onClose();
              void promptInstall();
            }}
          >
            <DownloadIcon />
            <span>Install app</span>
          </button>
        )}
      </div>
      <p className={styles.footer}>Works fully offline once loaded.</p>
    </Sheet>
  );
}
