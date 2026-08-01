# Sudoku

A fun, relaxing, minimalist Sudoku — built as an installable, offline-first
PWA. No backend, no accounts, no ads, no telemetry. Good enough for veteran
solvers; gentle enough for a first puzzle.

## Why another Sudoku?

- **Honest difficulty.** Four tiers (Easy / Medium / Hard / Expert) whose
  labels are technique-derived (via [`sudoku-gen`](https://www.npmjs.com/package/sudoku-gen)),
  never clue-count guesswork.
- **Notes that actually work.** Corner (Snyder) marks with a one-tap pencil
  toggle, multi-cell drag selection, fill-all-candidates,
  auto-remove-on-placement, and a strict separation between app-managed and
  user-managed candidates — no half-synced pencil marks, ever.
- **Minimalist by default, rich on demand.** The resting screen is a grid, a
  number pad, and six quiet icons. Everything else — themes, stats, assists,
  install — lives behind a menu and bottom sheets.

## Features

- Cell-first and number-first input; full keyboard play on desktop
  (arrows, 1–9, backspace, Z/Y undo/redo, P pencil)
- Undo/redo as an exact command history
- Selection, peer, and same-digit highlighting; live, on-check, or no
  conflict/mistake feedback — every assist is a setting
- Hints: reveal-a-cell or check-entries
- Light / dark / sepia / high-contrast themes (+ four accents), system-aware;
  dark is true black (`#000`) so AMOLED screens stay unlit
- Per-tier stats: wins, win rate, best & median times, daily streaks
- Autosave to IndexedDB on every move; reload resumes exactly where you were
- Installable PWA, fully playable offline after first load
- Screen wake lock, optional haptics, safe-area aware, reduced-motion aware

## Development

```bash
npm install
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build + service worker
npm run e2e        # Playwright mobile smoke (requires a build)
npm run lint       # ESLint
```

The architecture map and conventions live in [CLAUDE.md](./CLAUDE.md).

## License

[AGPL-3.0](./LICENSE)
