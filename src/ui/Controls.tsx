import { useStore } from '../store';
import { canUndo as undoAllowed } from '../store/gameSlice';
import { EraseIcon, HintIcon, NotesIcon, PencilIcon, RedoIcon, UndoIcon } from './icons';
import styles from './Controls.module.css';

export function Controls() {
  const playing = useStore((s) => s.game.status === 'playing');
  const canUndo = useStore((s) => undoAllowed(s.game, s.settings.undoLimit));
  // Capped rather than empty: the history is still there, the allowance isn't.
  const undoCapped = useStore(
    (s) => s.settings.undoLimit > 0 && s.game.undoStreak >= s.settings.undoLimit,
  );
  const canRedo = useStore((s) => s.game.future.length > 0);
  const noteMode = useStore((s) => s.game.noteMode);
  const armedErase = useStore((s) => s.game.armedErase);
  const autoCandidates = useStore((s) => s.settings.autoCandidates);
  const hintStyle = useStore((s) => s.settings.hintStyle);
  const showHintButton = useStore((s) => s.settings.showHintButton);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const padErase = useStore((s) => s.padErase);
  const togglePencil = useStore((s) => s.togglePencil);
  const fillNotes = useStore((s) => s.fillNotes);
  const hint = useStore((s) => s.hint);

  return (
    <div className={styles.controls}>
      <div className={styles.row} role="toolbar" aria-label="Game controls">
        <button
          className={styles.button}
          onClick={undo}
          disabled={!playing || !canUndo}
          aria-label={undoCapped ? 'Undo, limit reached — make a move to undo further' : 'Undo'}
        >
          <UndoIcon />
          <span>Undo</span>
        </button>
        <button
          className={styles.button}
          onClick={redo}
          disabled={!playing || !canRedo}
          aria-label="Redo"
        >
          <RedoIcon />
          <span>Redo</span>
        </button>
        <button
          className={`${styles.button} ${armedErase ? styles.active : ''}`}
          onClick={padErase}
          disabled={!playing}
          aria-label="Erase"
          aria-pressed={armedErase}
        >
          <EraseIcon />
          <span>Erase</span>
        </button>
        {!autoCandidates && (
          <button
            className={`${styles.button} ${noteMode !== 'off' ? styles.active : ''}`}
            onClick={togglePencil}
            disabled={!playing}
            aria-label="Notes, corner pencil marks"
            aria-pressed={noteMode !== 'off'}
          >
            <PencilIcon />
            <span>Notes</span>
          </button>
        )}
        {!autoCandidates && (
          <button
            className={styles.button}
            onClick={fillNotes}
            disabled={!playing}
            aria-label="Auto notes: fill all candidates as corner marks"
          >
            <NotesIcon />
            <span>Auto</span>
          </button>
        )}
        {showHintButton && (
          <button
            className={styles.button}
            onClick={hint}
            disabled={!playing}
            aria-label={hintStyle === 'reveal-cell' ? 'Hint: reveal a cell' : 'Hint: check entries'}
          >
            <HintIcon />
            <span>Hint</span>
          </button>
        )}
      </div>
    </div>
  );
}
