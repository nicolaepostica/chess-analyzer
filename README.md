# Chess Analyzer

A local chess analyzer: Stockfish 18 running in the browser via WASM, no backend.
Drag pieces, paste a FEN/PGN, or set up a position manually and get a live
evaluation, an eval bar, and best-move arrows.

## Run

    npm install
    npm run dev

Open http://localhost:5173

The dev server sets `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` so the multi-threaded Stockfish
build (which needs `SharedArrayBuffer`) can run. If those headers are absent the
app falls back to the slower single-threaded build and shows a warning.

Engine binaries (the ~7 MB Stockfish WASM) are copied from `node_modules` into
`public/stockfish/` on every `dev`/`build` and are git-ignored.

## Tests

    npm test

## Tools

- `/` — position analyzer (live evaluation, MultiPV, best-move arrows, FEN/PGN
  input, position editor, line preview).
- `/best-move`, `/play`, `/freestyle`, `/import` — stubs for upcoming sub-projects
  (play vs. computer, Chess960, game import).

## Design

Dark theme only. The board keeps
chessground's classic wooden squares.

Tokens live in `src/styles/index.css` and their contrast is enforced by
`src/styles/contrast.test.ts`, which fails the build if any text colour drops
below WCAG AA on either the page background or a card surface. The `decor`
token (`#5B6184`) is deliberately below that threshold and may never be used
for text; a test guards that too.

The page is centred in a `max-w-[1600px]` container. Above 1280px the analyzer
is a two-column grid; below it the columns stack, centred.

The board sizes itself from the width of its column, capped by `--board-max`
(`min(80vh, 640px)`). The eval bar stretches to the row, so the two cannot
drift apart — the page padding never enters the arithmetic.

## License

GPL-3.0 — required by Stockfish.
