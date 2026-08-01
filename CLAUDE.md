# CLAUDE.md

Context for AI-assisted sessions working in this repository.

## What this is

A **minimalist, offline-first Sudoku PWA** for Android/Chrome (portrait,
one-handed) that is honest about difficulty and pleasant for veteran solvers:
full pencil-mark ergonomics, configurable assists, stats/streaks, installable,
no backend, no accounts, no telemetry.

## Commands

| Task                | Command                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| Dev server          | `npm run dev`                                                                     |
| Typecheck           | `npm run typecheck`                                                               |
| Lint / format check | `npm run lint` / `npm run format:check`                                           |
| Unit tests          | `npm test` (Vitest, jsdom)                                                        |
| Build (prod)        | `npm run build` (tsc + vite + SW)                                                 |
| E2E smoke           | `npm run build && npm run e2e` (Playwright, Pixel 7 profile, uses `vite preview`) |
| Regenerate icons    | `npm run icons`                                                                   |

CI (`.github/workflows/ci.yml`) runs lint → format → typecheck → unit →
build → Playwright e2e.

## Architecture

```
src/
├── puzzles/    sudoku-gen wrapper: newPuzzle(tier) → { id, tier, givens, solution }
├── game/       PURE, framework-free, unit-tested game logic
│   ├── board.ts       geometry: UNITS (27), PEERS (81×20), parse/serialize 81-char grids
│   ├── notes.ts       pencil marks as digit bitmasks (bit 1<<d)
│   ├── candidates.ts  computeCandidates(values) from peers
│   ├── checks.ts      findConflicts / findMistakes / isSolved / digitCounts
│   ├── commands.ts    patch-based Command + PatchBuilder + apply/revert (undo/redo)
│   └── actions.ts     command builders: placeValue, toggleMark, eraseCells,
│                      fillAllCandidates, clearAllNotes, clearBoard, revealCell
├── store/      Zustand: ONE store, sliced state {game, settings, stats} + flat actions
│   ├── index.ts        all actions; commit() = history push + mistakes + win + haptics
│   ├── gameSlice.ts    GameState shape + (de)hydration (transient fields dropped)
│   ├── settingsSlice.ts DEFAULT_SETTINGS + hydrateSettings (type-checked merge)
│   └── statsSlice.ts   per-tier records, daily streaks (pure functions, tested)
├── db/         IndexedDB via idb; debounced autosave (persist.ts), 3 object stores
├── ui/         React components (CSS Modules) + hooks (useTimer/useTheme/useKeyboard/useWakeLock)
├── styles/     tokens.css (scales) + themes/*.css (semantic color vars per [data-theme])
└── pwa/        SW registration, beforeinstallprompt capture, wake lock, haptics
tests/
├── unit/       Vitest (game logic, store, stats, persistence, components)
├── e2e/        Playwright mobile smoke (play, autosave/resume, win, offline)
└── fixtures.ts frozen sudoku-gen puzzle for determinism
```

## Key decisions & invariants

- **Difficulty is technique-based, never clue-count.** Tiers come from
  `sudoku-gen` (QQWing-graded seeds). Everything difficulty-related flows
  through `src/puzzles/` — that wrapper is the single swap point for the
  optional bespoke engine (see below).
- **Pencil marks are bitmasks** (`number`, bit `1 << digit`), not Sets:
  compact, comparable, and serializable as-is to IndexedDB. Helpers in
  `src/game/notes.ts`; never manipulate bits inline.
- **Every board mutation is a `Command`** (per-cell before/after snapshots)
  built by `PatchBuilder` and pushed through `commit()` in the store. Undo =
  revert, redo = re-apply. Never mutate `game.cells` outside a command.
- **Corner (Snyder) marks are the only pencil-mark style.** There is no
  center mark and no pencil submode: the Notes button is a plain on/off
  toggle and every notes feature (Auto/fill-all-candidates, auto-remove,
  clear-notes, app-managed candidates) writes or reads `cells.corner`.
  Legacy saves carrying a `center` mask are folded into `corner` on hydration.
- **Two candidate modes, never mixed** (`settings.autoCandidates`):
  - ON (app-managed): corner marks are _derived_ at render time
    (`useCornerMasks`), hand-editing disabled, stored user notes untouched.
  - OFF (user-managed): the app only touches notes on placement when
    `autoRemovePeers` is on (recorded in the same command, so undo restores).
- **Solution string is the oracle**: mistakes/hints/win all compare against
  the stored solution. Rule conflicts (duplicates) are computed separately
  and are a display concern.
- **Timer never counts hidden/paused time** (`useTimer` deltas, visibility-
  aware). Persisted mid-game games resume as `paused`.
- **Autosave**: every meaningful change debounced to IndexedDB; timer-only
  changes flushed every ~15s and on `pagehide`/hidden (see `db/persist.ts`).
- **Givens are immutable** — guard is `game.givens[i] === 0`.
- Win check uses solution equality; after `won`, mutating actions no-op
  (guards on `status === 'playing'`).

## UI conventions

- Plain CSS + CSS Modules; design tokens in `styles/tokens.css`, semantic
  colors per theme in `styles/themes/*.css` (selected via `data-theme` on
  `<html>`; `system` resolves in `useTheme`). No Tailwind, no component kits.
- The dark theme is **true black** (`--bg`/`--surface` are `#000`) so AMOLED
  pixels switch off; surfaces are separated by borders and grid lines, not by
  lift. Keep the pre-paint `backgrounds` map in `index.html` in sync.
- The board is a CSS Grid of divs with `container-type: inline-size`; cell
  typography scales in `cqw` units. Heavy box lines are a gradient overlay.
- Minimalism is a feature: the resting screen is board + pad + one icon row.
  New surfaces go behind the menu (⋯) or a bottom sheet, not the main screen.
- Every assist is a setting in §Settings sheet with a casual-friendly default
  and a veteran off-switch. New assists must follow that pattern.
- Touch: `touch-action: none` on the board (drag = multi-select),
  `user-select: none`, safe-area insets padded in `App.module.css`.
- A11y: ARIA grid semantics, `aria-label`s on every control, visible
  `:focus-visible`, `prefers-reduced-motion` respected globally.

## Testing conventions

- Pure logic gets exhaustive unit tests; store behavior is tested through
  `useStore.getState()` actions with `src/puzzles` mocked to the fixture.
- Component tests use Testing Library; jsdom quirks (pointer capture,
  `matchMedia`, vibrate) are stubbed in `tests/unit/setup.ts`.
- E2E runs against the production build; `/?e2e` exposes `window.__sudoku`
  for deterministic access to the active puzzle's solution.
- Keep the tree green: lint + typecheck + unit + build + e2e all pass before
  any commit.

## Deliberately NOT built (yet): bespoke engine

A technique-gated generator/grader/human-solver (naked/hidden subsets,
fish, wings, chains…) is specified in the original build brief (§5) as a
future upgrade. If asked to build it:

- Put it in `src/engine/` + `src/worker/` (it MUST run in a Web Worker).
- Replace the internals of `src/puzzles/` only; the `NewPuzzle` contract and
  everything above it stay unchanged.
- Reimplement from specs (Norvig's essay, HoDoKu technique descriptions) —
  do NOT copy GPL/AGPL code (QQWing, SudokuExchange).

Sudoku variants (Killer, X, thermo…) are likewise out of scope.

## License

AGPL-3.0 (the repository owner's choice, committed before this codebase).
All code here is original; reference projects were studied for UX ideas only.
