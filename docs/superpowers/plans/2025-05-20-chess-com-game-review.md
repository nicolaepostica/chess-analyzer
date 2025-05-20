# Chess.com Game Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Game Review page (labels, eval graph, accuracy) fed by a one-click Chrome extension on chess.com, deployed to GitHub Pages.

**Architecture:** Pure review logic (PGN → moves, win%, labels, accuracy, opening book) lives in `src/game/`. A small non-React batch runner in `src/engine/` evaluates every position through the existing `Engine`. A new hook `useGameReview` is the second engine↔React bridge. A chess.com loader in `src/sources/` turns URL params into a PGN. The page at `/import` composes them. The extension in `extension/` only builds a link.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind v4, chess.js 1.4.0, chessground 9.2.1, Stockfish 18 lite (WASM), vitest 4, Chrome MV3, GitHub Actions + Pages, `coi-serviceworker` 0.1.7 (MIT).

**Spec:** `docs/superpowers/specs/2025-05-20-chess-com-game-review-design.md`

## Global Constraints

- Branch `feat/chess-com-review`; Conventional Commits; no attribution trailers in commits or PRs.
- English for code, comments, UI strings, docs.
- GPL-3.0; no dependency under an incompatible license. `stockfish`, `chess.js`, `chessground` stay pinned; pin `coi-serviceworker` to exactly `0.1.7`.
- `src/game/` imports neither `src/engine/` nor React (not even types). `src/engine/` never imports React or `src/game/`. `src/ui/` components compute nothing.
- Only the `lite` engine build.
- Dark theme; every new text colour token is added to `TEXT_TOKENS` in `src/styles/contrast.test.ts` and must pass AA on both bg and surface. Never use `text-decor`.
- Existing test handles (see `CLAUDE.md`) must keep working; `npm test` and `npx tsc -b` green after every task.
- Win% curve (spec, verbatim): `win% = 50 + 50 · (2 / (1 + e^(−0.00368208 · cp)) − 1)`, mate → 0/100.
- Loss bands: Excellent < 2, Good < 5, Inaccuracy < 10, Mistake < 20, Blunder ≥ 20.
- Precedence: Book > Brilliant > Great > Best > Excellent > Good > Miss > Blunder > Mistake > Inaccuracy.
- Label counts include every move; accuracy excludes book moves.
- URL contract: `/import?source=chesscom&game=<id>&user=<username>&month=YYYY-MM[&pgn=<urlencoded>]`.
- Pages URL: `https://nicolaepostica.github.io/chess-analyzer/`.

## Review Focus

1. **Game ends in checkmate or stalemate** — the final position has no engine lines (`bestmove (none)`); the last move must still be classified (mating move = Best, win 100) and the graph must not drop to NaN. Test in Task 3.
2. **Promotions and castling** — played moves must be compared to engine PVs in UCI form (`e7e8q`, `e1g1`), or a best-move promotion is labelled a blunder. Test in Task 1.
3. **`user` param in a different case or not a player** (`HIKARU` vs `Hikaru`, a friend's game) — orientation and "You" use the case-insensitive match, otherwise PGN names and White at the bottom. Test in Task 9.
4. **Review in progress** — only some positions evaluated: labels for completed plies only, graph shows a partial line, accuracy hidden, nothing throws. Tests in Tasks 3 and 8.
5. **chess.com answers 404 / network error / empty archive** — the page shows the not-found alert with Retry and PGN paste, never a blank page or uncaught rejection. Tests in Tasks 5 and 9.

---

### Task 1: Game record from PGN

**Files:**
- Create: `src/game/record.ts`
- Test: `src/game/record.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RecordedMove = { san: string; uci: string; color: 'w' | 'b'; fenBefore: string; fenAfter: string }
  export type GameRecord = {
    headers: Record<string, string>
    startFen: string
    customStart: boolean          // true when SetUp/FEN headers present
    moves: RecordedMove[]
    positions: string[]           // [startFen, ...moves.map(m => m.fenAfter)]
  }
  export type RecordResult =
    | { ok: true; record: GameRecord }
    | { ok: false; reason: 'invalid-pgn' | 'unsupported-variant' | 'no-moves'; message: string }
  export function parseGameRecord(pgn: string): RecordResult
  ```

- [ ] **Step 1: Write failing tests** in `src/game/record.test.ts`:
  - `parses moves into UCI with before/after FENs`: PGN `1. e4 e5 2. Nf3 *` → `moves.map(m => m.uci)` equals `['e2e4','e7e5','g1f3']`; `positions.length === 4`; `positions[0]` is the standard start FEN.
  - `encodes castling and promotion the way UCI does`: from FEN header `[SetUp "1"][FEN "4k3/1P6/8/8/8/8/8/4K2R w K - 0 1"]` with moves `1. O-O Kd7 2. b8=Q *` → ucis `['e1g1','e8d7','b7b8q']`, `customStart === true`.
  - `rejects variants`: `[Variant "Chess960"]` header → `{ ok: false, reason: 'unsupported-variant' }`; `[Variant "Standard"]` is accepted.
  - `rejects a game without moves`: headers only → `reason: 'no-moves'`.
  - `rejects garbage`: `'not a pgn 1. e9'` → `reason: 'invalid-pgn'`.
  - `keeps headers`: `White`, `Black`, `Date` are present in `record.headers`.

- [ ] **Step 2: Run** `npx vitest run src/game/record.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `parseGameRecord`** using `loadPgn` from `./pgn`, `game.getHeaders()` and replaying `game.history({ verbose: true })` on a fresh `Chess(startFen)`; UCI = `from + to + (promotion ?? '')`.

- [ ] **Step 4: Run** the test file — Expected: PASS. Then `npm test` — all pass.

- [ ] **Step 5: Commit** `feat(game): parse PGN into a reviewable game record`

---

### Task 2: Win percentage and accuracy

**Files:**
- Create: `src/game/review.ts`
- Test: `src/game/review.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type EngineScore = { type: 'cp' | 'mate'; value: number }   // structural twin of engine's Score; game/ may not import it
  export type EngineLine = { score: EngineScore; pv: string[] }       // side-to-move perspective
  export type PositionEval = { lines: EngineLine[] }                  // sorted by multipv, may be empty for terminal positions
  export function winPercent(score: EngineScore): number               // side-to-move perspective, 0..100
  export function moveAccuracy(winBefore: number, winAfter: number): number   // mover perspective
  export function gameAccuracy(whiteWins: number[], moverIsBook: boolean[], firstMover: 'w' | 'b' = 'w'): { white: number; black: number }
  ```
  `whiteWins[i]` is White's win% in `positions[i]`; `moverIsBook[i]` is whether move `i` (from position i to i+1) is a book move.

- [ ] **Step 1: Write failing tests:**
  - `winPercent`: `{cp,0}` → `50`; `{cp,100}` → `≈59.1` (toBeCloseTo 1 digit); `{cp,-100}` → `≈40.9`; `{mate,3}` → `100`; `{mate,-2}` → `0`; `{mate,0}` → `0`. cp is clamped to ±1000 before the curve: `{cp,5000}` equals `{cp,1000}`.
  - `moveAccuracy`: `(60,60)` → `100`; `(60,70)` → `100` (gain); `(70,50)` → `≈43.4` toBeCloseTo 0 digits; result is always within `[0,100]` (`(100,0)` → `0`).
  - `gameAccuracy`: a flat series `[50,50,50,50,50]` with no book → both `100`; a series where only White drops (`[50,50,20,20,20]`, White moves at indices 0,2 ...) gives `white < black` and `black === 100`; book moves are excluded (marking White's losing move as book makes `white === 100`).

- [ ] **Step 2: Run** `npx vitest run src/game/review.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement.** `moveAccuracy` is lichess's: if `winAfter >= winBefore` → 100, else `clamp(103.1668100711649 * exp(-0.04354415386753951 * (winBefore - winAfter)) - 3.166924740191411 + 1, 0, 100)`. `gameAccuracy` is lichess's aggregation, which the signature does not determine:

  ```ts
  // windowSize = clamp(round(positions/10), 2, 8); first (windowSize-2) windows repeat the first one
  const size = clamp(Math.round(whiteWins.length / 10), 2, 8)
  const windows = [
    ...Array(Math.max(0, Math.min(size, whiteWins.length) - 2)).fill(whiteWins.slice(0, size)),
    ...slidingWindows(whiteWins, size),            // every contiguous slice of length `size`
  ]
  const weights = windows.map((w) => clamp(stdDev(w), 0.5, 12))
  // move i: mover = i even ? side to move in positions[0] : the other side
  // per-move accuracy uses the mover's perspective (100 - whiteWin for Black)
  // per side: (weightedMean(acc, weights) + harmonicMean(acc)) / 2,
  // harmonicMean = n / Σ 1/max(1, a); skip book moves; a side with no counted moves → 100
  ```
  `firstMover` is the side to move in `positions[0]` (custom starts can begin with Black).

- [ ] **Step 4: Run** the test file — PASS; `npm test` — PASS.

- [ ] **Step 5: Commit** `feat(game): win percentage and lichess accuracy`

---

### Task 3: Move classification

**Files:**
- Modify: `src/game/review.ts`
- Test: `src/game/review.test.ts` (extend), `src/game/classify.test.ts` (new, scenario tests)

**Interfaces:**
- Consumes: `GameRecord`, `RecordedMove` (Task 1); `winPercent`, `moveAccuracy`, `gameAccuracy`, `PositionEval` (Task 2).
- Produces:
  ```ts
  export type MoveLabel = 'book' | 'brilliant' | 'great' | 'best' | 'excellent' | 'good'
    | 'miss' | 'inaccuracy' | 'mistake' | 'blunder'
  export type ReviewedMove = RecordedMove & {
    ply: number                        // 0-based index into record.moves
    label: MoveLabel
    loss: number                       // win% points, ≥ 0
    bestUci: string | null
    bestSan: string | null
    bestScoreWhite: EngineScore | null // engine's best in fenBefore, White's perspective
    playedScoreWhite: EngineScore | null // evaluation of fenAfter, White's perspective
  }
  export type ReviewResult = {
    moves: ReviewedMove[]              // only plies whose two positions are evaluated, in order, no gaps
    whiteWins: number[]                // one per evaluated position, from positions[0] onward, no gaps
    accuracy: { white: number; black: number } | null   // null until every position is evaluated
  }
  export const THRESHOLDS = { excellent: 2, good: 5, inaccuracy: 10, mistake: 20,
    greatGap: 10, brilliantMaxWinBefore: 90, sacrificeMin: 2, sacrificePlies: 4, missMinWinBefore: 70 } as const
  export function reviewGame(record: GameRecord, evals: PositionEval[], isBook: (fen: string) => boolean): ReviewResult
  ```
  `evals[i]` belongs to `record.positions[i]`; `evals` may be shorter than `positions` (in progress).

- [ ] **Step 1: Write failing tests.** Build `PositionEval`s by hand; use real FENs from small PGNs via `parseGameRecord`.
  - `labels the engine's top move Best even at zero loss` (not Excellent).
  - one test per loss band: loss 1.5 → `excellent`, 4 → `good`, 9 → `inaccuracy`, 19 → `mistake`, 25 → `blunder` (move not equal to `pv[0]`; tune cp values so the win% differences hit the bands).
  - `great`: played = best, `lines[1]` win% is ≥ 10 below `lines[0]` → `great`; gap 5 → `best`; only one line (forced move) → `best`.
  - `brilliant`: Scholar-style position where the played move is a rook-for-knight capture on a pawn-defended square (exchange sacrifice: material for mover drops by ≥ 2 within the next position's PV, `pv` length ≥ 2), loss < 2, winBefore 60 → `brilliant`; the same with winBefore 95 → not brilliant; a normal equal trade (knight takes defended knight) → not brilliant.
  - `miss`: previous move labelled `mistake`/`blunder`, mover's winBefore ≥ 70, loss ≥ 10 → `miss` (instead of mistake); with winBefore 60 → `mistake`.
  - `book`: `isBook` returns true for fenAfter of the first two plies → both `book`, even if their loss would be a blunder; once a non-book move occurs, later plies are never `book` even if `isBook` is true again.
  - `classifies a mating move as Best when the final position has no lines` (Review Focus 1): mate-in-one fixture `6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1`, move `a1a8`, `evals[1] = { lines: [] }` → label `best`, `whiteWins` = `[100, 100]`. Same for stalemate → final win 50.
  - `returns only completed plies while evals are partial` (Review Focus 4): 3 moves, 2 evals → `moves.length === 1`, `whiteWins.length === 2`, `accuracy === null`; full evals → `accuracy` non-null.
  - `bestSan` is SAN of `bestUci` in fenBefore (`Ra8#` for the fixture); `bestScoreWhite` for a Black-to-move position with `{cp, 50}` is `{cp, -50}`.

- [ ] **Step 2: Run** `npx vitest run src/game` — Expected: FAIL.

- [ ] **Step 3: Implement `reviewGame`.** Win of a position: if `lines` empty, derive from chess.js on that FEN (checkmate → side to move 0, any draw → 50); else `winPercent(lines[0].score)` for the side to move. For move i: `winBefore` = mover's win in position i, `winAfter` = `100 − ` win of position i+1 (side flipped), `loss = max(0, winBefore − winAfter)`. Sacrifice = material balance for the mover (P1 N3 B3 R5 Q9, from FEN placement) at fenBefore minus the minimum balance over fenAfter and up to `sacrificePlies` plies of `evals[i+1].lines[0].pv` played from fenAfter (stop at the first illegal move) ≥ `sacrificeMin`. Apply labels in the precedence order from Global Constraints. Accuracy via `gameAccuracy` with book flags, only when `evals.length === positions.length`.

- [ ] **Step 4: Run** `npx vitest run src/game` then `npm test` — PASS.

- [ ] **Step 5: Commit** `feat(game): classify moves chess.com-style`

---

### Task 4: Opening book

**Files:**
- Create: `scripts/build-openings.js`, `src/game/openings.json` (generated, committed), `src/game/book.ts`
- Test: `src/game/book.test.ts`

**Interfaces:**
- Produces: `export function isBookPosition(fen: string): boolean` — compares the first four FEN fields (placement, side, castling, en passant).

- [ ] **Step 1: Confirm licence.** Open `https://github.com/lichess-org/chess-openings` README; continue only if it states CC0. If not, skip this task: `isBookPosition` returns `false` always and a comment says why; the Book label stays unused.

- [ ] **Step 2: Write `scripts/build-openings.js`** (Node, ESM): download `a.tsv`…`e.tsv` from `https://raw.githubusercontent.com/lichess-org/chess-openings/master/`, replay each `pgn` column with chess.js, collect the 4-field key of **every** position along each line, write a sorted, de-duplicated JSON array to `src/game/openings.json`. Header comment credits the dataset and its licence. Run `node scripts/build-openings.js`; check the file is < 500 KB (`ls -l`).

- [ ] **Step 3: Write failing tests:** position after `1. e4` → true; after `1. d4 Nf6 2. c4 e6` and after `1. c4 e6 2. d4 Nf6` (transposition, same key) → both true; the mate-in-one fixture `6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1` → false; the FEN after `1. e4` with clocks changed to `5 9` → still true.

- [ ] **Step 4: Implement** `isBookPosition` with a module-level `Set` built from the JSON. Run tests — PASS; `npm test` — PASS.

- [ ] **Step 5: Commit** `feat(game): opening book from lichess chess-openings (CC0)`

---

### Task 5: Chess.com loader

**Files:**
- Create: `src/sources/chesscom.ts`, `src/sources/fixtures/archive-2025-04.json` (hand-trimmed real archive response: 2 games, one with `url` ending `/123456789`)
- Test: `src/sources/chesscom.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ReviewRequest =
    | { kind: 'none' }
    | { kind: 'pgn'; pgn: string; user: string | null }
    | { kind: 'chesscom'; game: string; user: string; month: string | null }
    | { kind: 'invalid'; message: string }
  export function parseReviewParams(search: string): ReviewRequest
  export type FetchResult = { ok: true; pgn: string } | { ok: false; reason: 'not-found' | 'network' }
  export function fetchChessComPgn(
    req: { game: string; user: string; month: string | null },
    fetchImpl?: typeof fetch, now?: Date,
  ): Promise<FetchResult>
  ```

- [ ] **Step 1: Write failing tests:**
  - `parseReviewParams`: `''` → `none`; `?pgn=1.%20e4` → `pgn` (takes precedence over `game`); `?source=chesscom&game=123&user=Bob&month=2025-04` → `chesscom`; missing `user` or non-numeric `game` or `month=2025-13` → `invalid`; unknown `source` → `invalid`.
  - `fetchChessComPgn` with a fake `fetchImpl`: requests `https://api.chess.com/pub/player/bob/games/2025/04` (username lowercased) and returns that game's `pgn`; id not in archive → `not-found`; HTTP 404 → `not-found` (Review Focus 5); `fetchImpl` rejects → `network`; `{ games: [] }` → `not-found`; `month: null` with `now = 2025-05-02` tries `2025/05` then `2025/04` and finds the game in the second; `now = 2025-01-05` falls back to `2024/12`.

- [ ] **Step 2: Run** `npx vitest run src/sources` — FAIL.

- [ ] **Step 3: Implement.** Match a game when `game.url` ends with `/${id}`. Months are zero-padded.

- [ ] **Step 4: Run** — PASS; `npm test` — PASS.

- [ ] **Step 5: Commit** `feat(sources): load a chess.com game by id from the public API`

---

### Task 6: Batch evaluation over the engine

**Files:**
- Create: `src/engine/batch.ts`
- Test: `src/engine/batch.test.ts`, `src/review.integration.test.ts`

**Interfaces:**
- Consumes: `Engine`, `AnalyzeOptions` (`src/engine/engine.ts`), `EvalUpdate` (`src/engine/uci.ts`).
- Produces:
  ```ts
  export const REVIEW_OPTIONS: AnalyzeOptions = { depth: 14, multiPV: 2, chess960: false }
  export async function analyzeAll(
    engine: Engine, fens: string[], options: AnalyzeOptions,
    onResult: (index: number, lines: EvalUpdate[]) => void,   // lines: last update per multipv, sorted, side-to-move perspective
    isCancelled: () => boolean,
  ): Promise<void>
  ```

- [ ] **Step 1: Write failing tests** (Node, shared engine via `createNodeTransport`, same `afterEach` terminate pattern as `engine.test.ts`):
  - `batch.test.ts › evaluates positions in order`: fens `[START, MATE_IN_ONE]` with `{ depth: 8, multiPV: 2 }` → `onResult` called with indices `[0, 1]`; for index 1, `lines[0].pv[0] === 'a1a8'` and `lines[0].score` equals `{ type: 'mate', value: 1 }`.
  - `stops between positions when cancelled`: `isCancelled` returns true after the first result → exactly one call.
  - `returns no lines for a checkmated position` (feeds Review Focus 1): fen after `a1a8` → `lines` is `[]`, and the promise resolves.
  - `review.integration.test.ts › reviews a short game end-to-end`: PGN `1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0` → `parseGameRecord` → `analyzeAll` (depth 8) → `reviewGame(record, evals, isBookPosition)`; expect `moves.length === 7`, `moves[5].label` is `'blunder'` or `'mistake'` (3...Nf6??), `moves[6].label === 'best'`, `accuracy.white > accuracy.black`.

- [ ] **Step 2: Run** `npx vitest run src/engine/batch.test.ts src/review.integration.test.ts` — FAIL.

- [ ] **Step 3: Implement `analyzeAll`**: for each fen, iterate `engine.analyze(fen, options)` to completion, keeping the latest update per `multipv`; check `isCancelled()` before each position and after each update (break → the generator's `finally` sends `stop` and waits for `bestmove`).

- [ ] **Step 4: Measure the budget.** Add a skipped-by-default perf note: run the integration test once with a 40-move game and depth 14 single-threaded in Node; record the time in a comment next to `REVIEW_OPTIONS`. If > 4 min single-threaded, lower depth to 12. (Browser multi-threaded is roughly 3–4× faster; Task 11 verifies the real number.)

- [ ] **Step 5: Run** `npm test` — PASS. **Commit** `feat(engine): evaluate a list of positions sequentially`

---

### Task 7: `useGameReview` hook

**Files:**
- Create: `src/hooks/useGameReview.ts`
- Test: `src/hooks/useGameReview.test.tsx`
- Modify: `CLAUDE.md` (Architecture: "`src/hooks/useAnalysis.ts` and `src/hooks/useGameReview.ts` are the only points where the engine meets React"; describe the review lifecycle in two sentences)

**Interfaces:**
- Consumes: `analyzeAll`, `REVIEW_OPTIONS` (Task 6); `GameRecord`, `PositionEval`, `reviewGame`, `ReviewResult` (Tasks 1–3); `isBookPosition` (Task 4); `createEngine`, `createWorkerTransport`, `isMultiThreaded`.
- Produces:
  ```ts
  export type GameReviewState = {
    result: ReviewResult
    evaluated: number          // positions done
    total: number              // record.positions.length
    done: boolean
    multiThreaded: boolean
    error: string | null
  }
  export function useGameReview(record: GameRecord | null): GameReviewState
  ```

- [ ] **Step 1: Write failing test** (jsdom; `vi.mock('../engine/batch')` with an `analyzeAll` that calls `onResult` for each index with canned lines, `vi.mock('../engine/transport')` returning a dummy transport, `vi.mock('../engine/engine')` returning `{ analyze, stop, terminate: vi.fn() }`):
  - with a 2-move record → eventually `evaluated === 3`, `done === true`, `result.moves.length === 2`.
  - `record = null` → `total === 0`, `done === false`, nothing called.
  - unmount mid-review → `terminate` called; `isCancelled` passed to `analyzeAll` returns true afterwards.
  - `analyzeAll` rejecting → `error === 'The engine crashed. Please reload the page.'`.

- [ ] **Step 2: Run** `npx vitest run src/hooks/useGameReview.test.tsx` — FAIL.

- [ ] **Step 3: Implement.** One effect keyed on `record`: create engine (`createEngine(createWorkerTransport(undefined, onError))`), accumulate `PositionEval[]` in a ref, after each `onResult` set state with `reviewGame(record, evals, record.customStart ? () => false : isBookPosition)`. Cleanup: cancelled flag, `engine.terminate()`. Engine lines are already side-to-move perspective, which is what `PositionEval` expects.

- [ ] **Step 4: Run** — PASS; `npm test`, `npx tsc -b` — PASS.

- [ ] **Step 5: Commit** `feat(hooks): useGameReview runs a whole-game review`

---

### Task 8: Review UI components

**Files:**
- Create: `src/ui/labels.ts`, `src/ui/EvalGraph.tsx`, `src/ui/ReviewSummary.tsx`, `src/ui/ReviewMoveList.tsx`, `src/ui/MoveHint.tsx`
- Modify: `src/styles/index.css` (`@theme` tokens), `src/styles/contrast.test.ts` (`TEXT_TOKENS`)
- Test: `src/ui/EvalGraph.test.tsx`, `src/ui/ReviewMoveList.test.tsx`, `src/ui/ReviewSummary.test.tsx`

**Interfaces:**
- Consumes: `ReviewedMove`, `MoveLabel` (Task 3); `formatScore` (`src/ui/EvalBar.tsx`).
- Produces:
  ```ts
  // labels.ts
  export const LABEL_META: Record<MoveLabel, { name: string; glyph: string; textClass: string; fill: string }>
  // components
  EvalGraph({ whiteWins: number[]; total: number; moves: ReviewedMove[]; current: number; onSelect(ply: number): void })
  ReviewSummary({ moves: ReviewedMove[]; accuracy: {white:number;black:number} | null; whiteName: string; blackName: string })
  ReviewMoveList({ moves: ReviewedMove[]; current: number; onSelect(ply: number): void })
  MoveHint({ move: ReviewedMove | null; onAnalyze(fen: string): void })
  ```
  `current` is a position index (0 = start, k = after move k−1).

- [ ] **Step 1: Add tokens** to `@theme`: `--color-label-brilliant: #26C2A3; --color-label-great: #5C9CED; --color-label-best: #81B64C; --color-label-book: #B38B5D; --color-label-inaccuracy: #F7C631; --color-label-mistake: #FFA459; --color-label-miss: #FF7769; --color-label-blunder: #FA412D;` and add all eight to `TEXT_TOKENS`. Run `npx vitest run src/styles` — PASS (adjust a hex lighter if one fails). Excellent uses `label-best`, Good uses `fg-secondary`. Glyphs: brilliant `!!`, great `!`, best `★`, inaccuracy `?!`, mistake `?`, miss `×`, blunder `??`, others `''`.

- [ ] **Step 2: Write failing tests:**
  - `EvalGraph`: root `data-testid="eval-graph"`; a polyline/path whose point count equals `whiteWins.length`; with `whiteWins = []` renders without throwing (Review Focus 4); clicking at the horizontal middle of the SVG (mock `getBoundingClientRect`, width 400) calls `onSelect` with `Math.round(total/2)`; one marker (`data-testid="graph-marker"`) per move labelled mistake/miss/blunder/brilliant.
  - `ReviewMoveList`: each move is a `button` with `data-testid="review-move"`, text includes SAN and glyph (`Qd2??`); the current one has `aria-current="true"`; clicking calls `onSelect(ply + 1)`.
  - `ReviewSummary`: `data-testid="accuracy-white"` shows `87.4` for `87.43`; with `accuracy = null` shows `…`; per-label counts per player (`data-testid="count-blunder-white"` = `1`).
  - `MoveHint`: for a non-best move shows `Best was Be2` and both scores via `formatScore`; for a best move shows `Best move`; button `Analyze position` calls `onAnalyze(move.fenBefore)`.

- [ ] **Step 3: Run** `npx vitest run src/ui` — FAIL.

- [ ] **Step 4: Implement** the components as presentational only. `EvalGraph` is hand-written SVG (`viewBox="0 0 1000 100"`, `preserveAspectRatio="none"`), white area below the line = White's win%, a vertical accent line at `current`, x-scale by `total` so the line grows left-to-right during the review. Use existing `Card` for framing.

- [ ] **Step 5: Run** `npx vitest run src/ui src/styles` and `npm test` — PASS. **Commit** `feat(ui): review graph, summary, move list and hint`

---

### Task 9: Game Review page

**Files:**
- Create: `src/pages/GameReview.tsx`
- Delete: `src/pages/ImportGame.tsx`
- Modify: `src/App.tsx` (route `/import` → `GameReview`), `src/ui/Nav.tsx` (label `Game review`), `CLAUDE.md` (list new test handles: `eval-graph`, `graph-marker`, `review-move`, `review-progress`, `accuracy-white`, `accuracy-black`, `count-<label>-<color>`; button names `Retry`, `Analyze position`, `Review PGN`)
- Test: `src/pages/GameReview.test.tsx`

**Interfaces:**
- Consumes: `parseReviewParams`, `fetchChessComPgn` (Task 5); `parseGameRecord` (Task 1); `useGameReview` (Task 7); components (Task 8); `Board`, `EvalBar`.

- [ ] **Step 1: Write failing tests** (jsdom; mock `../ui/Board` like `Analyzer.test.tsx`, mock `../hooks/useGameReview` with a controllable state, mock `../sources/chesscom`'s `fetchChessComPgn`; set the query via `window.history.pushState({}, '', '/import?...')`):
  - no params → a `textarea#pgn-input` and button `Review PGN`; pasting the 4-move scholar PGN and clicking starts a review (hook called with a record of 7 moves).
  - `?source=chesscom&game=123&user=bob&month=2025-04` → `fetchChessComPgn` called with `{ game: '123', user: 'bob', month: '2025-04' }`; resolved PGN reaches the hook.
  - fetch resolves `{ ok: false, reason: 'not-found' }` → `role="alert"` with `Game not found in the archive yet — chess.com may take a minute to publish it`, a `Retry` button that calls fetch again, and the PGN box (Review Focus 5). `network` → alert `Could not reach chess.com.` with `Retry`.
  - Chess960 PGN → alert `This variant isn't supported yet`; headers-only PGN → alert `This game has no moves to review`.
  - orientation (Review Focus 3): `user=BOB` with PGN `[Black "Bob"]` → board `data-orientation="black"`, summary names `You` / `Opponent`; `user=carol` (not a player) → `white`, names from PGN `White`/`Black` headers.
  - progress: hook state `evaluated: 23, total: 82, done: false` → `data-testid="review-progress"` text `Analyzing… 23 / 82`; hidden when `done`.
  - keyboard: `ArrowRight` advances `current` (board fen = `positions[1]`), `ArrowLeft` back, `End` → last position, `Home` → start.
  - `Analyze position` calls `window.open` with `${import.meta.env.BASE_URL}?fen=<encoded fenBefore>` and `'_blank'`.
  - hook `multiThreaded: false` → existing slow-engine alert text; hook `error` → alert with that text.

- [ ] **Step 2: Run** `npx vitest run src/pages/GameReview.test.tsx` — FAIL. (Add `data-orientation={orientation}` to the Board mock.)

- [ ] **Step 3: Implement `GameReview`**: request = `parseReviewParams(window.location.search)` once; `chesscom` → fetch in an effect (with a `retry` counter in deps); PGN text → `parseGameRecord` (memoised) → `useGameReview(record)`. Layout B: graph Card full width above a grid copying `Analyzer.tsx`'s two-column classes; right column `ReviewSummary`, `ReviewMoveList`, `MoveHint`. Board is read-only: `dests={NO_DESTS}` (module-level constant, as in Analyzer), `onMove` no-op, fen = `record.positions[current]`, EvalBar score = `playedScoreWhite` of move `current-1` (start: `null`). Keyboard via a `keydown` listener on `window` in an effect. Alerts use the same `ALERT` class string as `Analyzer.tsx`.

- [ ] **Step 4: Run** the page tests, then `npm test` and `npx tsc -b` — PASS.

- [ ] **Step 5: Commit** `feat(pages): game review page at /import`

---

### Task 10: Analyzer opens `?fen=`

**Files:**
- Modify: `src/pages/Analyzer.tsx` (initial `useState(() => createGame(...))`)
- Test: `src/pages/Analyzer.test.tsx` (extend)

- [ ] **Step 1: Write failing tests:** after `window.history.pushState({}, '', '/?fen=' + encodeURIComponent(AFTER_E4))`, `render(<Analyzer />)` → board `data-fen` is `AFTER_E4`; with `?fen=garbage` → board shows `START` and no crash. Reset the URL to `/` in `beforeEach`.
- [ ] **Step 2: Run** `npx vitest run src/pages/Analyzer.test.tsx` — FAIL.
- [ ] **Step 3: Implement:** read `new URLSearchParams(window.location.search).get('fen')` inside the initializer; use it only when `isValidFen` passes. (Not `useSearchParams`: the test renders without a router.)
- [ ] **Step 4: Run** — PASS; `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(analyzer): accept a position via ?fen=`

---

### Task 11: GitHub Pages deployment

**Files:**
- Modify: `src/engine/transport.ts` (URLs), `src/App.tsx` (`basename`), `index.html` (shim script), `package.json` (`coi-serviceworker` exact `0.1.7` as devDependency), `scripts/copy-stockfish.js` (also copy `node_modules/coi-serviceworker/coi-serviceworker.min.js` to `public/`), `.gitignore` (`public/coi-serviceworker.min.js`)
- Create: `.github/workflows/pages.yml`
- Test: `src/engine/transport.test.ts` (extend)

- [ ] **Step 1: Write failing test:** `selectEngineUrl()` starts with `import.meta.env.BASE_URL` and ends with `stockfish/stockfish-18-lite-single.js` when `crossOriginIsolated` is false (stub the global).
- [ ] **Step 2: Run** `npx vitest run src/engine/transport.test.ts` — FAIL.
- [ ] **Step 3: Implement:** URLs = `` `${import.meta.env.BASE_URL}stockfish/…` ``; `<BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>`; in `index.html` `<script src="%BASE_URL%coi-serviceworker.min.js"></script>` before the module script; install `coi-serviceworker@0.1.7 --save-exact`.
- [ ] **Step 4: Workflow** `.github/workflows/pages.yml`: on push to `main` and `workflow_dispatch`; permissions `pages: write`, `id-token: write`, `contents: read`; steps `actions/checkout@v4`, `actions/setup-node@v4` (node 22, npm cache), `npm ci`, `npm test`, `npm run build -- --base=/chess-analyzer/`, `cp dist/index.html dist/404.html`, `actions/upload-pages-artifact@v3` (path `dist`), deploy job `actions/deploy-pages@v4`.
- [ ] **Step 5: Verify locally:** `npm run build -- --base=/chess-analyzer/ && cp dist/index.html dist/404.html && npx vite preview --base=/chess-analyzer/`; open `http://localhost:4173/chess-analyzer/import?source=chesscom&game=<a real recent game id>&user=<its player>&month=<YYYY-MM>` in a browser (agent-browser). Expected: game loads, review completes, `crossOriginIsolated === true` in the console after the shim reload, no slow-engine banner, the `api.chess.com` fetch succeeds. Record the review time of a ~40-move game; if > 2 min lower `REVIEW_OPTIONS.depth` by 2 and note it. If the fetch is blocked by COEP, set `coepCredentialless: () => true` in the shim's config (`window.coi = {...}` before the script) and re-check.
- [ ] **Step 6: Run** `npm test`, `npx tsc -b` — PASS. **Commit** `ci: deploy to GitHub Pages with cross-origin isolation shim`
- [ ] **Step 7: Enabling Pages is outward-facing — ask the user first**, then `gh api -X POST repos/nicolaepostica/chess-analyzer/pages -f build_type=workflow`. The first deploy happens when the branch is merged to `main`.

---

### Task 12: Chrome extension and docs

**Files:**
- Create: `extension/manifest.json`, `extension/content.js`, `extension/README.md`
- Modify: `README.md` (section "Game review & Chrome extension"), `/Users/poligon/Projects/PROJECTS.md` (chess-analyzer section + date)

- [ ] **Step 1: Inspect chess.com** (agent-browser, a public finished game, e.g. any from `https://api.chess.com/pub/player/hikaru/games/2025/04`): find a stable anchor for the game-info block on `/game/live/<id>` and `/game/daily/<id>`, the archive row links on `/games/archive/<user>`, and where the logged-in username appears. Check whether `https://www.chess.com/callback/live/game/<id>` (and `/callback/daily/game/<id>`) returns JSON with `game.pgnHeaders.Date/White/Black` when fetched from the page origin. Write the chosen selectors as constants at the top of `content.js` with a comment on where they were observed (date).
- [ ] **Step 2: `manifest.json`:** `manifest_version: 3`, name `Chess Analyzer — Analyze free`, `content_scripts: [{ matches: ['https://www.chess.com/*'], js: ['content.js'], run_at: 'document_idle' }]`, no `permissions`, no `host_permissions` beyond the match.
- [ ] **Step 3: `content.js`:** `const REVIEW_BASE = 'https://nicolaepostica.github.io/chess-analyzer/'` (comment: switch to `http://localhost:5173/` for development). A `MutationObserver` on `document.body` injects one `Analyze free` link per game view / archive row, marked with `data-chess-analyzer` to prevent duplicates, `target="_blank" rel="noopener"`. URL building per the contract: `game` from the path, `user` = logged-in user if they are White/Black else White, `month` from the header date (omit if unknown). Network access only to `www.chess.com` same-origin.
- [ ] **Step 4: Manual check** (record results in `extension/README.md` under "Verified"): load unpacked in Chrome; on a finished live game the button appears once, survives SPA navigation to another game, and opens a review of that exact game; same for a daily game and an archive row; no console errors on chess.com. Also note how long after a game ends it appears in the API archive (spec's open question); if routinely > 2 min, switch `content.js` to pass `pgn` from the callback endpoint.
- [ ] **Step 5: Docs:** `extension/README.md` — install (chrome://extensions → Developer mode → Load unpacked → select `extension/`), dev base URL, what it does and doesn't send. Root `README.md` short section with the Pages link. `PROJECTS.md`: update the chess-analyzer section (game review, extension, Pages URL) and the date at the top.
- [ ] **Step 6: Run** `npm test`, `npx tsc -b` — PASS. **Commit** `feat(extension): Analyze free button on chess.com` (PROJECTS.md lives outside the repo; it is not committed).
