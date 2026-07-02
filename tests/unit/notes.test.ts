import { describe, expect, it } from 'vitest';
import {
  EMPTY_NOTES,
  addNote,
  countNotes,
  digitsToNotes,
  hasNote,
  notesToDigits,
  removeNote,
  toggleNote,
} from '../../src/game/notes';
import { DIGITS } from '../../src/game/types';

describe('note bitmasks', () => {
  it('adds, removes and toggles digits', () => {
    let mask = EMPTY_NOTES;
    mask = addNote(mask, 3);
    mask = addNote(mask, 7);
    expect(hasNote(mask, 3)).toBe(true);
    expect(hasNote(mask, 7)).toBe(true);
    expect(hasNote(mask, 1)).toBe(false);
    mask = removeNote(mask, 3);
    expect(hasNote(mask, 3)).toBe(false);
    mask = toggleNote(mask, 7);
    expect(mask).toBe(EMPTY_NOTES);
  });

  it('is idempotent for add/remove', () => {
    const once = addNote(EMPTY_NOTES, 5);
    expect(addNote(once, 5)).toBe(once);
    expect(removeNote(EMPTY_NOTES, 5)).toBe(EMPTY_NOTES);
  });

  it('round-trips digit lists', () => {
    expect(notesToDigits(digitsToNotes([2, 4, 9]))).toEqual([2, 4, 9]);
    expect(notesToDigits(EMPTY_NOTES)).toEqual([]);
    expect(notesToDigits(digitsToNotes([...DIGITS]))).toEqual([...DIGITS]);
  });

  it('counts set digits', () => {
    expect(countNotes(EMPTY_NOTES)).toBe(0);
    expect(countNotes(digitsToNotes([1, 5, 9]))).toBe(3);
    expect(countNotes(digitsToNotes([...DIGITS]))).toBe(9);
  });
});
