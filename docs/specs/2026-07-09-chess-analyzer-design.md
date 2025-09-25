# Local chess analyzer — design

Date: 2026-07-09
Status: approved, awaiting an implementation plan

## What we are building

A local counterpart: a browser chess analyzer that runs
entirely on the client. Stockfish is compiled to WASM and spins in a Web Worker;
there is no backend for the analysis.

The original consists of five tools: a position analyzer, a best-move finder,
play against the computer, Freestyle (Chess960), and game import with review.
Plus an AI chat that explains the engine's evaluation in plain language.

## What we are NOT building

Deliberately dropped as irrelevant to local use:

- Internationalization (i18n).
- Static pages: About, Contact, Privacy Policy, Terms of Service.
- SEO scaffolding, a blog, "Write for Us".

Separately: the repository's current contents are a chess.com bot that clicks the
mouse through `pyautogui` at hardcoded coordinates. That is a fundamentally
different product; it is preserved on the `legacy-chessdotcom-bot` branch and is
not for reuse. The new project automates nothing on anyone else's site — it only
analyzes the position it is given.

## Stack

- Vite + React + TypeScript.
- `stockfish` (npm, v18.0.8) — the engine, nmrugg's WASM port of Stockfish 18.
- `chess.js` (v1.4.0) — move legality, FEN, PGN, Chess960.
- `chessground` (v9.2.1, Lichess, MIT) — board, dragging, arrows.
- `vitest` — tests.
- No backend in the first stage. Settings live in `localStorage`.

## Technical constraints

Everything in this section was verified experimentally against `stockfish@18.0.8`.

**Choosing the engine build.** The package ships five variants. The full
multi-threaded one (`stockfish-18.wasm`) weighs **113 MB** — unacceptably slow to
load. The `lite` build weighs **7 MB** and, per its authors, is still far stronger
than any human. We take `stockfish-18-lite.js` (multi-threaded) as the primary
variant and `stockfish-18-lite-single.js` as the fallback.

The NNUE network is baked into the `.wasm`; there is no separate network file.
Both files (`.js` and `.wasm`) go side by side into `public/stockfish/` —
Emscripten looks for the `.wasm` relative to the script's URL.

**SharedArrayBuffer.** The multi-threaded build requires the headers
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. They must be set on the Vite dev
server. The single-threaded build works without them but cannot honour
`setoption name Threads`. If `crossOriginIsolated === false`, the app loads the
single-threaded fallback and **says so explicitly** in the UI rather than running
quietly and slowly.

**The engine in a Web Worker.** Analysis at depth 22 on the main thread would
freeze the UI. `stockfish-18-lite.js` is designed as a worker script: it sets
`listener: (line) => postMessage(line)` itself. So
`new Worker('/stockfish/stockfish-18-lite.js')` plus string exchange over
`postMessage` / `onmessage` is the entire protocol.

**In Node (for tests)** the same package loads differently: `require('stockfish')`
returns `initEngine(flavor)`, which yields a promise for an object carrying
`sendCommand(cmd)` and an assignable `listener` field. Verified: the mate-in-one
test passes under vitest in 765 ms. The package ships no types — a `declare module`
is needed.

**License.** Stockfish is distributed under GPL-3.0. That makes GPL-3.0 mandatory
for the whole application. The repository already carries GPLv3, so nothing needs
to change, but license-incompatible dependencies must not be added.

## Core architecture

Three modules with hard boundaries, each understood and tested on its own.

### `engine/`

The only place that knows about UCI and WASM. It exposes a typed interface
outward, not a text protocol:

```ts
analyze(fen: string, opts: { depth: number; multiPV: number; chess960: boolean })
  → AsyncIterable<EvalUpdate>
stop(): void

type EvalUpdate = {
  depth: number
  multipv: number
  score: { type: 'cp' | 'mate'; value: number }
  pv: string[]
}
```

Inside: a Web Worker, a parser for `info ...` lines, a command queue. It
guarantees that a new `analyze` correctly interrupts the previous one — it sends
`stop` and waits for `bestmove`, otherwise the engine answers about the old
position. React is absent here.

Tested in Node without a browser.

### `game/`

A wrapper over `chess.js`. It knows about the position, move history, legality,
PGN/FEN, Chess960. It knows about neither the engine nor the DOM. Pure functions
over state.

### `ui/`

React components. `<Board>` wraps `chessground` — an imperative library that
wants a `useEffect` and a ref, not a re-render. `<EvalBar>`, `<LineList>`.
Components receive data through props and compute nothing themselves.

### The bridge: `useAnalysis(fen, options)`

The single point where the engine meets React. It subscribes to the stream from
`engine/`, throttles updates to ~10 per second (at depth 22 the engine emits
hundreds of lines, each a potential re-render) and hands components the latest
snapshot.

**Invariant:** the eval bar and the arrows read from the same `EvalUpdate`. A
state where the bar shows one depth's score and an arrow shows another depth's
line is impossible by construction.

## The analyzer page

Three zones: the board on the left, the eval bar flush against it, the analysis
panel on the right.

**Data flows one way.** The source of truth is the game object from `game/`. The
FEN is derived from it. The FEN goes into `useAnalysis`, and lines come back.
Nothing writes back into game state except user actions.

**Entering a position** — four ways: dragging a piece, pasting a FEN, pasting a
PGN, arranging pieces by hand in the editor. All reduce to one operation,
"replace the game state". A move on the board differs only by its legality check.

**The analysis panel** shows a numeric score (centipawns or "mate in N"), the
depth, and a list of the N best lines (MultiPV, 3 by default). Each line is a
clickable move chain; clicking scrolls the board to that position without
destroying the main game. This is a separate preview state, not a change to the
game.

**Arrows.** The first line gets a green arrow; the second and third are paler.
`<Board>` receives a ready list of arrows as a prop and does not wonder where it
came from.

**Changing the position.** The user moves a piece → `game/` validates and yields
a new FEN → `useAnalysis` calls `stop()`, waits for `bestmove`, starts a new
analysis. In between, the UI dims the previous score rather than showing nothing —
otherwise the bar blinks on every move.

**Settings** (analysis depth, MultiPV count) live in one place and persist to
`localStorage`. A per-move time limit belongs to play against the computer and
arrives in sub-project 2.

## Error handling

- Invalid FEN on paste: an error under the field; state untouched.
- Invalid or partially parsed PGN: import what parsed, warn about the rest.
- Stockfish worker crash: restart the worker, retry the last request once, then
  show a message.
- `SharedArrayBuffer` unavailable: an explicit warning in the UI.

## Testing

- Unit tests for the UCI line parser — the dullest and most brittle part.
- Unit tests for `game/`.
- Integration test: a mate-in-two position; the engine's first line is the right move.
- Component test for `<EvalBar>`: the score's sign for black is easy to get wrong.

## File layout

```
src/
  engine/
    uci.ts             parser for info/bestmove lines — a pure function
    transport.ts       the EngineTransport interface + a Worker implementation
    transport.node.ts  implementation over the stockfish package, tests only
    engine.ts          public analyze/stop interface
    uci.test.ts
    engine.test.ts
    stockfish.d.ts     declare module 'stockfish'
  game/
    game.ts            wrapper over chess.js
    pgn.ts             import/export
    game.test.ts
  ui/
    Board.tsx          wrapper over chessground
    EvalBar.tsx
    LineList.tsx
    FenInput.tsx
  hooks/
    useAnalysis.ts     the engine → React bridge
    useSettings.ts     localStorage
  pages/
    Analyzer.tsx
  main.tsx
public/
  stockfish/           stockfish-18-lite.js + .wasm + the single-threaded fallback
```

`EngineTransport` is the seam that lets `engine.ts` run both in the browser
(Worker) and in tests (Node) without knowing the difference. Without it, the step
"the engine works before any UI exists" is impossible.

If `Analyzer.tsx` starts running to several hundred lines, split the analysis
panel into its own component.

## Build order

Bottom-up; each step is verified before moving to the next.

1. Vite + React + TS, COOP/COEP headers on the dev server.
   Check: `typeof SharedArrayBuffer === 'function'` in the console.
2. All of `engine/`, with tests, without UI.
   Check: a Node script feeds it a mate-in-one FEN and prints the right move.
3. `game/` with tests.
4. `<Board>` with the starting position and dragging. No engine.
5. `useAnalysis` + `<EvalBar>` + `<LineList>` — the first time all the parts meet;
   a live evaluation appears on screen.
6. Arrows, FEN/PGN input, settings, the position editor.
7. Router and stubs for the other four pages.

Step 2 is the riskiest. If the engine works in isolation, the rest is ordinary
frontend. That is why it comes before any UI.

## Breakdown into sub-projects

A full clone does not fit into one spec. This document covers **the core and
sub-project 1**. The rest will get their own specs and plans:

1. **Core + analyzer** (this spec). The Best Move Finder is the same analyzer with
   a trimmed interface and belongs here too.
2. **Play against the computer + Chess960.** These add a game loop and engine
   strength levels. Chess960 is the `UCI_Chess960` flag and a different starting
   arrangement; it barely needs a page of its own.
3. **Game import and review.** Lichess/Chess.com APIs, step-by-step walkthrough,
   move classification by evaluation delta (blunder / mistake / inaccuracy).
4. **AI chat.** An abstraction over an LLM. The Ollama vs Claude API decision is
   deferred; the layer is designed so that the choice needs no rewrite.

Sub-project 1 yields a working product on its own.
