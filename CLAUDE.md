# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

    npm run dev      # copies engine binaries, then starts Vite on :5173
    npm run build    # copy-stockfish && tsc -b && vite build
    npm test         # vitest run (the whole suite)
    npx tsc -b       # typecheck only

Run one test file, or one test by name:

    npx vitest run src/engine/uci.test.ts
    npx vitest run -t 'finds mate in one'

There is no linter. `tsc` and the test suite are the only automated gates.

`npm run dev` and `npm run build` both invoke `scripts/copy-stockfish.js`, which
copies ~14 MB of Stockfish WASM from `node_modules` into `public/stockfish/`.
That directory is git-ignored and must never be committed.

Engine tests load 7 MB of WASM and take seconds, which is why `testTimeout` is
60 s in `vite.config.ts`.

## Testing setup

The default vitest environment is `node`. Component tests opt into jsdom with a
docblock on the file's first line:

    // @vitest-environment jsdom

Two invariants the suite relies on:

- **Node engine tests share one Stockfish instance.** The npm package wraps an
  Emscripten module that cannot be re-instantiated in one process — a second
  `initEngine()` fails on the WASM link step. `src/engine/transport.node.ts`
  therefore memoizes the engine and multiplexes its single `listener` across
  transports. Do not "fix" this by creating a fresh engine per test.
- **UI tests hold on to specific handles**: `data-testid="eval-bar"` and
  `data-testid="depth-badge"`, `role="alert"` on every error message, the
  accessible button names (`Load FEN`, `Load PGN`, `Back to game`,
  `Edit position`, `Apply`, `Cancel`, `Clear board`, `Eraser`), the `fen-input`
  / `pgn-input` / `depth` / `multipv` field ids, and the `line-list`, `pv-move`,
  `position-editor`, `palette`, `editor-controls` classes. Restyling must
  preserve them.
- **Game review handles**: `data-testid` `eval-graph`, `graph-marker`,
  `review-move` (with `aria-current` on the current move), `review-progress`,
  `accuracy-white`, `accuracy-black`, `count-<label>-<white|black>`; buttons
  `Review PGN`, `Retry`, `Analyze position`, `First move`, `Previous move`,
  `Play`/`Pause`, `Next move`, `Last move`; label badges are `role="img"` named
  after the label (`Blunder`, `Book`, …); the `pgn-input` textarea.
- **Play handles**: `data-testid` `clock` (with `data-active`), `play-move`;
  the `level` range input; buttons `Start game`, `White`/`Random`/`Black`, the
  time-control tiles (`1+0` … `30+20`, `Custom`, `No clock`, `aria-pressed`),
  the `custom-minutes` / `custom-increment` fields, `Take back`, `Hint`,
  `Show eval bar`/`Hide eval bar`, `Offer draw`, `Resign`, `Review this game`,
  `New game`; the result is `role="status"`.

The canonical fixture across the whole codebase is the mate-in-one position
`6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1`, best move `a1a8`, score
`{ type: 'mate', value: 1 }`.

## Architecture

Three modules with hard boundaries, bridged by three hooks.

- **`src/engine/`** — the only place that knows UCI and WASM. Never imports React.
- **`src/game/`** — a `chess.js` wrapper: legality, FEN, PGN, preview, editor
  validation. Imports neither `engine/` nor React. Pure functions over state.
- **`src/ui/`** — React components that receive data as props and compute nothing.
- **`src/hooks/useAnalysis.ts`**, **`src/hooks/useGameReview.ts`** and
  **`src/hooks/useComputerOpponent.ts`** — the only points where the engine
  meets React. `useComputerOpponent` owns the engine the user plays against
  (`Engine.play`, strength-limited, on the clock); a cancelled search resolves
  to null so a take-back never applies a stale move. `useAnalysis` follows one live position;
  `useGameReview` walks every position of a game once through
  `engine/batch.ts` and re-classifies the moves (`game/review.ts`) after each.
- **`src/sources/`** — loads games from outside (chess.com public API). No React,
  no engine.

If a change to presentation forces you to touch `engine/`, `game/` or `hooks/`,
an abstraction has leaked. Treat that as a design bug, not a chore.

### The engine seam

`EngineTransport` (`src/engine/transport.ts`) is what lets `engine.ts` run in a
Web Worker in the browser and in-process in Node tests without knowing the
difference. `createWorkerTransport` picks the multi-threaded build when
`crossOriginIsolated`, otherwise the single-threaded fallback.

The multi-threaded build needs `SharedArrayBuffer`, hence the
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` headers set on both `server` and
`preview` in `vite.config.ts`. Without them the app silently degrades to the
slow build and says so through a `role="alert"` banner.

### Search interruption in `engine.ts`

This is the subtlest code in the repo, and a bug here surfaces as "the score
belongs to the previous position" — rare and hard to reproduce.

Searches run strictly one at a time, chained through a `previousSearch` promise.
`analyze()` is an async generator; its `finally` sends `stop` and then **awaits
`bestmove`** before releasing the chain. A consumer that breaks out of the
`for await` loop triggers `return()`, which runs that `finally`.

`terminate()` must therefore resolve every suspended generator through the
`aborts` set before clearing subscribers. Skipping that step leaves a generator
awaiting a `bestmove` that will never arrive, and every subsequent `analyze`
deadlocks behind it.

### The React bridge

`useAnalysis(fen, options)` throttles the engine's hundreds of updates per
second down to one flush per 100 ms. Its flush timer lives in the effect rather
than inside the generator, precisely because a terminated worker can leave the
generator suspended and its `finally` unreachable.

**Score sign.** UCI reports from the side-to-move's perspective; the eval bar
wants White's. `toWhitePerspective` does the conversion inside `useAnalysis`, so
everything downstream (`formatScore`, `whiteWinProbability`, `EvalBar`) receives
an already-normalized score. Do not re-normalize in a component.

A worker crash restarts the engine once (via the `engineGeneration` counter,
which is also a dependency of the analysis effect, so the last request is
retried), then reports an error.

### Board and preview

`chessground` is imperative and owns its DOM. `Board.tsx` keeps **two separate**
`useEffect`s on purpose: one creates and destroys the board, one synchronizes
state through `api.set()`. Merging them recreates the board on every move and
kills the animation.

The sync effect keys on `dests` by identity, so props passed to `Board` must be
referentially stable — see `NO_DESTS` in `Analyzer.tsx`.

Line preview is a separate state, not a mutation of the game. `Analyzer.tsx`
analyses `displayFen` (`preview ?? state.fen`), and `selectLine` walks the
engine's lines **from `displayFen`**, not from the game position, which may be
several plies behind.

## Styling

Tailwind v4. Design tokens live in `src/styles/index.css`; there is no
`tailwind.config`. Three dark themes: **Charcoal** (default, in the `@theme`
block), **Lichess-style** and **Wood** (`[data-theme="…"]` blocks that override
the colour tokens). `src/hooks/useTheme.ts` sets `data-theme` on `<html>` and
stores the choice; an inline script in `index.html` applies it before the first
paint. The board squares follow the theme in `src/ui/board.css`.

`src/styles/contrast.test.ts` reads that CSS file and fails the suite if any text
token drops below WCAG AA on **either** the page background or a card surface,
**in every theme** — a colour can pass on one and fail on the other. The `decor` token (per theme) is
deliberately below the text threshold; a separate test greps the source tree and
fails if `text-decor` appears anywhere.

The board sizes from the width of its column, capped by `--board-max`. Page
padding never enters that arithmetic. The eval bar uses `self-stretch` rather
than its own height, so it cannot drift away from the board.

## Conventions

- Commit messages are plain sentences in the imperative ("Add an icon"). The only
  prefix allowed is `fix:` / `fix(scope):`, and only for bug fixes; never `feat:`,
  `docs:`, `ci:`, `chore:` or other Conventional Commit types.
  The `[module]` rule in the user's global `CLAUDE.md` applies only to Odoo
  addons and explicitly does not apply here.
- Work happens directly on `main` (owner's decision, 2025-07-03); no feature branches.
- Code, comments, UI strings and `docs/` are **English**. There is no i18n.
- The project is GPL-3.0 because Stockfish is. Do not add dependencies under
  incompatible licenses.
- `stockfish`, `chess.js` and `chessground` are pinned to exact versions.
- Only the `lite` engine build is used; the 113 MB full build never is.

## Docs

`docs/superpowers/specs/` holds design specs and `docs/superpowers/plans/` the
implementation plans that produced this code. They are historical records of
completed work — the plans' checkboxes were never ticked, and their code samples
show what was written at the time, not necessarily what is in `src/` now. Read
them for the *why* behind a decision; read `src/` for the current state.
