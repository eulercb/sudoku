import { describe, expect, it } from 'vitest';
import { emptyGame, fromPersistedGame, toPersistedGame } from '../../src/store/gameSlice';
import { DEFAULT_SETTINGS, hydrateSettings } from '../../src/store/settingsSlice';
import { fixtureGivens, fixtureSolution } from '../fixtures';

describe('settings hydration', () => {
  it('returns defaults for junk input', () => {
    expect(hydrateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(hydrateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(hydrateSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });

  it('merges known keys, drops unknown ones and wrong types', () => {
    const merged = hydrateSettings({
      theme: 'dark',
      haptics: false,
      bogus: true,
      showTimer: 'yes',
    });
    expect(merged.theme).toBe('dark');
    expect(merged.haptics).toBe(false);
    expect(merged.showTimer).toBe(DEFAULT_SETTINGS.showTimer);
    expect('bogus' in merged).toBe(false);
  });
});

describe('game persistence', () => {
  const playedGame = () => {
    const game = emptyGame();
    game.puzzleId = 'easy-test';
    game.tier = 'easy';
    game.givens = fixtureGivens();
    game.solution = fixtureSolution();
    game.cells = {
      values: fixtureGivens(),
      corner: new Array(81).fill(0),
      center: new Array(81).fill(0),
    };
    game.status = 'playing';
    game.elapsedMs = 42_000;
    game.selection = [3, 4];
    return game;
  };

  it('round-trips a game, dropping transient fields', () => {
    const game = playedGame();
    const restored = fromPersistedGame(JSON.parse(JSON.stringify(toPersistedGame(game))))!;
    expect(restored).not.toBeNull();
    expect(restored.cells).toEqual(game.cells);
    expect(restored.elapsedMs).toBe(42_000);
    expect(restored.selection).toEqual([]); // transient
    expect(restored.status).toBe('paused'); // resumes calmly
  });

  it('rejects malformed payloads', () => {
    expect(fromPersistedGame(undefined)).toBeNull();
    expect(fromPersistedGame({})).toBeNull();
    expect(fromPersistedGame({ puzzleId: 'x', cells: { values: [1, 2] } })).toBeNull();
  });
});
