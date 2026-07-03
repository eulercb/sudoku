import { useStore } from '../store';
import type { NoteKind } from '../store/gameSlice';
import { EraseIcon, HintIcon, NotesIcon, PencilIcon, RedoIcon, UndoIcon } from './icons';
import { radioGroupKeyDown } from './radioGroup';
import styles from './Controls.module.css';

const NOTE_KINDS: readonly NoteKind[] = ['corner', 'center'];

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
  const padErase = useStore((s) => s.padErase);
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
        <div
          role="radiogroup"
          aria-label="Pencil mark style"
          className={styles.segment}
          onKeyDown={(e) => {
            if (noteMode !== 'off') radioGroupKeyDown(e, NOTE_KINDS, noteMode, setNoteMode);
          }}
        >
          {NOTE_KINDS.map((kind) => (
            <button
              key={kind}
              role="radio"
              aria-checked={noteMode === kind}
              className={noteMode === kind ? styles.segmentOn : ''}
              onClick={() => setNoteMode(kind)}
              tabIndex={noteMode === kind ? 0 : -1}
            >
              {kind === 'corner' ? 'Corner' : 'Center'}
            </button>
          ))}
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
            aria-label="Notes, pencil marks"
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
            aria-label="Auto notes: fill all candidates"
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
