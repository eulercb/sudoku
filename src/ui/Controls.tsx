import { useStore } from '../store';
import { EraseIcon, HintIcon, NotesIcon, PencilIcon, RedoIcon, UndoIcon } from './icons';
import styles from './Controls.module.css';

export function Controls() {
  const playing = useStore((s) => s.game.status === 'playing');
  const canUndo = useStore((s) => s.game.past.length > 0);
  const canRedo = useStore((s) => s.game.future.length > 0);
  const noteMode = useStore((s) => s.game.noteMode);
  const armedErase = useStore((s) => s.game.armedErase);
  const autoCandidates = useStore((s) => s.settings.autoCandidates);
  const hintStyle = useStore((s) => s.settings.hintStyle);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const erase = useStore((s) => s.erase);
  const togglePencil = useStore((s) => s.togglePencil);
  const setNoteMode = useStore((s) => s.setNoteMode);
  const fillNotes = useStore((s) => s.fillNotes);
  const hint = useStore((s) => s.hint);

  return (
    <div className={styles.controls}>
      {/* Pencil submode appears only while the pencil is active. */}
      <div
        className={`${styles.submode} ${noteMode !== 'off' ? styles.submodeOpen : ''}`}
        aria-hidden={noteMode === 'off'}
      >
        <div role="radiogroup" aria-label="Pencil mark style" className={styles.segment}>
          <button
            role="radio"
            aria-checked={noteMode === 'corner'}
            className={noteMode === 'corner' ? styles.segmentOn : ''}
            onClick={() => setNoteMode('corner')}
            tabIndex={noteMode === 'off' ? -1 : 0}
          >
            Corner
          </button>
          <button
            role="radio"
            aria-checked={noteMode === 'center'}
            className={noteMode === 'center' ? styles.segmentOn : ''}
            onClick={() => setNoteMode('center')}
            tabIndex={noteMode === 'off' ? -1 : 0}
          >
            Center
          </button>
        </div>
      </div>

      <div className={styles.row} role="toolbar" aria-label="Game controls">
        <button
          className={styles.button}
          onClick={undo}
          disabled={!playing || !canUndo}
          aria-label="Undo"
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
          onClick={erase}
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
            aria-label="Pencil marks"
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
            aria-label="Fill all candidates"
          >
            <NotesIcon />
            <span>Auto</span>
          </button>
        )}
        <button
          className={styles.button}
          onClick={hint}
          disabled={!playing}
          aria-label={hintStyle === 'reveal-cell' ? 'Hint: reveal a cell' : 'Hint: check entries'}
        >
          <HintIcon />
          <span>Hint</span>
        </button>
      </div>
    </div>
  );
}
