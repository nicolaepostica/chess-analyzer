# Play vs Computer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/play` page where the user plays Stockfish at one of 11 levels on a clock, with take back, hint, an optional eval bar, draw/resign, and a one-click handoff to Game Review.

**Architecture:** Pure rules in `src/game/` (levels, clock, outcome, PGN). `src/engine/engine.ts` gains a `play()` search that carries strength options and clock/node limits. A new hook `useComputerOpponent` owns the opponent engine; the eval bar reuses `useAnalysis` in a component mounted only on the user's turn. The page composes presentational components.

**Tech Stack:** React 19, TypeScript, chess.js 1.4.0, chessground 9.2.1, Stockfish 18 lite, vitest 4, Tailwind v4.

**Spec:** `docs/superpowers/specs/2025-08-07-play-vs-computer-design.md`

## Global Constraints

- Work on `main`. Commit messages are plain imperative sentences; only `fix:` / `fix(scope):` for bug fixes; never `feat:`, `docs:`, `ci:`, `chore:`.
- Before any push, run `backdate-commits --split` over the unpushed range; never push un-backdated commits; pushing needs the user's go-ahead.
- `src/game/` imports neither engine nor React; `src/engine/` never imports React or game; `src/ui/` computes nothing.
- Engine search-interruption invariants (CLAUDE.md) must hold: one search at a time, `finally` awaits `bestmove`, `terminate()` releases waiters.
- Stockfish 18 lite options: `UCI_LimitStrength`, `UCI_Elo` 1320–3190, `Skill Level` 0–20.
- Levels (spec table): 1 ~800 (Elo 1320 + ~50 nodes), 2 ~1000 (~300 nodes), 3 ~1200 (~1500 nodes), 4 1350, 5 1500, 6 1700, 7 1900, 8 2100, 9 2400, 10 2700, 11 Max (no limit).
- Time controls: 1+0, 3+2, 5+0, 10+0, 15+10, untimed. Untimed computer budget ~1000 ms/move. Hint ~depth 14 full strength.
- Draw accepted iff computer's last eval within ±50 cp. Promotions auto-queen. No persistence of the game; settings persist in localStorage.
- English UI strings. Existing test handles stay valid.

## Review Focus

1. **Take back while the computer is thinking** — the in-flight search must be cancelled and its eventual `bestmove` ignored, never applied to the restored position. Test in Task 6 and 8.
2. **Flag fall vs insufficient material** — clock at zero with the opponent holding only a king (or K+minor) is a draw, not a loss. Test in Task 3.
3. **Game ends on the computer's move** (mate/stalemate/repetition delivered by the engine) — the game-over card appears and clocks stop. Test in Task 8.
4. **Unmount mid-game** — leaving `/play` terminates the opponent engine and stops the clock interval; no state updates after unmount. Test in Task 6.
5. **User plays Black** — the computer moves first immediately after Start; board oriented Black; PGN headers put `You` as Black. Test in Task 8.

---

### Task 1: Levels and time controls

**Files:** Create `src/game/levels.ts`, `src/game/levels.test.ts`

**Interfaces — Produces:**
```ts
export type Strength = { limit: boolean; elo?: number; skill?: number }
export type Level = { level: number; label: string; elo: number | null; strength: Strength; nodes?: number }
export const LEVELS: Level[]                       // 11 entries, level 1..11
export function levelName(level: Level): string     // "Stockfish · 1500", "Stockfish · ~800", "Stockfish · Max"
export type TimeControl = { id: string; label: string; initialMs: number; incrementMs: number } | { id: 'untimed'; label: string }
export const TIME_CONTROLS: TimeControl[]           // ids '1+0','3+2','5+0','10+0','15+10','untimed'
export function pgnTimeControl(tc: TimeControl): string  // '300+0', '180+2', '-'
```

- [ ] **Step 1: Failing tests:** 11 levels numbered 1..11; labels `~800`,`~1000`,`~1200`,`1350`…`2700`,`Max`; levels 1–3 have `strength {limit:true, elo:1320}` and strictly increasing `nodes` (50 < 300 < 1500); levels 4–10 have `limit:true` and increasing `elo` equal to the label; level 11 `{limit:false, skill:20}` and no nodes; `levelName(LEVELS[4])` = `Stockfish · 1500`; `TIME_CONTROLS.map(t => t.id)` exact list; `pgnTimeControl` for 5+0 → `300+0`, 3+2 → `180+2`, untimed → `-`.
- [ ] **Step 2:** `npx vitest run src/game/levels.test.ts` — FAIL.
- [ ] **Step 3:** Implement as data.
- [ ] **Step 4:** Run — PASS; `npm test` — PASS.
- [ ] **Step 5:** Commit `Add play levels and time controls`.

---

### Task 2: Chess clock

**Files:** Create `src/game/clock.ts`, `src/game/clock.test.ts`

**Interfaces — Produces:**
```ts
export type Side = 'w' | 'b'
export type ClockState = { remaining: Record<Side, number>; incrementMs: number; running: Side | null; since: number }
export function createClock(initialMs: number, incrementMs: number): ClockState  // not running
export function startClock(clock: ClockState, side: Side, now: number): ClockState
export function pressClock(clock: ClockState, now: number): ClockState  // charges elapsed to running side, adds increment to it, starts the other side
export function stopClock(clock: ClockState, now: number): ClockState  // charges elapsed, running = null
export function timeLeft(clock: ClockState, side: Side, now: number): number  // never below 0
export function flagged(clock: ClockState, now: number): Side | null
```

- [ ] **Step 1: Failing tests:** start w at t=0, `timeLeft(w, 1500)` = initial − 1500, `timeLeft(b, 1500)` = initial; `pressClock` at 2000 with increment 2000 → w = initial − 2000 + 2000, running b, since 2000; `flagged` returns `'w'` when w's time is exhausted and null otherwise; `timeLeft` clamps at 0; `stopClock` freezes both (later `timeLeft` unchanged); pressing a stopped clock is a no-op.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement immutably. **Step 4:** PASS + `npm test`.
- [ ] **Step 5:** Commit `Add a chess clock`.

---

### Task 3: Outcome and PGN

**Files:** Create `src/game/outcome.ts`, `src/game/outcome.test.ts`

**Interfaces — Produces:**
```ts
export type Result = '1-0' | '0-1' | '1/2-1/2'
export type Reason = 'checkmate' | 'resignation' | 'timeout' | 'stalemate' | 'threefold repetition' | 'fifty-move rule' | 'insufficient material' | 'draw agreed'
export type Outcome = { result: Result; reason: Reason; winner: 'w' | 'b' | null }
export function boardOutcome(game: Chess): Outcome | null       // mate, stalemate, threefold, fifty-move, insufficient
export function timeoutOutcome(game: Chess, flaggedSide: 'w' | 'b'): Outcome  // draw if the other side cannot mate
export function resignOutcome(resigning: 'w' | 'b'): Outcome
export const DRAW_AGREED: Outcome
export function playPgn(game: Chess, meta: { white: string; black: string; outcome: Outcome; timeControl: string; date: Date }): string
```

- [ ] **Step 1: Failing tests:** fool's mate → `{result:'0-1', reason:'checkmate', winner:'b'}`; a stalemate FEN after the stalemating move → draw/stalemate; threefold via Nf3 Nf6 Ng1 Ng8 ×2 → threefold repetition; `K+N vs K` position → insufficient material; ongoing game → null; `timeoutOutcome` with White flagged and Black holding only king → `1/2-1/2` timeout (Review Focus 2), with Black holding a rook → `0-1`; `resignOutcome('w')` → `0-1` resignation; `playPgn` contains `[White "You"]`, `[Result "1-0"]`, `[TimeControl "300+0"]`, `[Termination "…"]`, `[Date "YYYY.MM.DD"]`, and `parseGameRecord` (Task-1 record module) reads it back with the same moves.
- [ ] **Step 2–4:** FAIL → implement with chess.js (`isCheckmate`, `isStalemate`, `isThreefoldRepetition`, `isDrawByFiftyMoves`, `isInsufficientMaterial`; material check for timeout: other side has only K, or K+single minor) → PASS + `npm test`.
- [ ] **Step 5:** Commit `Add game outcome rules and PGN for played games`.

---

### Task 4: Engine `play()` search

**Files:** Modify `src/engine/engine.ts`; Test `src/engine/play.test.ts`

**Interfaces — Produces:**
```ts
export type PlayLimits = {
  strength: { limit: boolean; elo?: number; skill?: number }
  go: { nodes?: number; depth?: number; movetime?: number; wtime?: number; btime?: number; winc?: number; binc?: number }
}
export type PlayResult = { move: string | null; score: Score | null }  // score: side-to-move perspective, last info line
interface Engine { /* existing */ play(fen: string, limits: PlayLimits): Promise<PlayResult> }
```
Every search (both `analyze` and `play`) sends `UCI_LimitStrength`, `UCI_Elo`, `Skill Level` first, so a full-strength `analyze` after a limited `play` is not weakened (analyze sends `false`/`20`). `play` uses `MultiPV 1`, `UCI_Chess960 false`, and builds `go …` from the given limits (only present keys). It shares the one-at-a-time chain and `aborts` mechanism; `stop()` ends it early and it resolves with whatever `bestmove` says.

- [ ] **Step 1: Failing Node tests** (shared engine, `afterEach` terminate): mate-in-one fixture with `{limit:false, skill:20}` and `{depth: 8}` → `move === 'a1a8'`, score `{mate,1}`; `{limit:true, elo:1500}` with `wtime 60000 btime 60000 winc 0 binc 0` from start → legal move (check with chess.js); `{limit:true, elo:1320}` with `{nodes: 50}` → resolves in < 2 s; calling `stop()` right after `play(start, {depth: 30})` resolves, and a following `analyze(mate-in-one, depth 8)` still finds `a1a8` (no deadlock, full strength restored).
- [ ] **Step 2:** Run — FAIL. **Step 3:** Refactor the generator body into a private runner used by `analyze` and `play`; capture the `bestmove` move. **Step 4:** PASS; run all engine tests (`npx vitest run src/engine`) — PASS.
- [ ] **Step 5:** Commit `Add a strength-limited play search to the engine`.

---

### Task 5: Play settings hook

**Files:** Create `src/hooks/usePlaySettings.ts`, `src/hooks/usePlaySettings.test.ts`

**Interfaces — Produces:** `export type PlaySettings = { level: number; color: 'w' | 'b' | 'random'; timeControl: string }`, `DEFAULT_PLAY_SETTINGS = { level: 5, color: 'random', timeControl: '5+0' }`, `usePlaySettings(): [PlaySettings, (patch: Partial<PlaySettings>) => void]` stored under `chess-analyzer:play`.

- [ ] Tests (jsdom, like `useSettings.test.ts`): defaults; update persists and is read back; corrupt JSON / out-of-range level / unknown time control → defaults for that field. FAIL → implement following `useSettings.ts` → PASS → commit `Remember play settings`.

---

### Task 6: `useComputerOpponent` hook

**Files:** Create `src/hooks/useComputerOpponent.ts`, `src/hooks/useComputerOpponent.test.tsx`; Modify `CLAUDE.md` (architecture: three hooks bridge engine and React)

**Interfaces — Consumes:** `Engine.play`, `PlayLimits` (Task 4); `Level` (Task 1). **Produces:**
```ts
export type ClockInfo = { wtime: number; btime: number; winc: number; binc: number } | null  // null = untimed
export type Opponent = {
  move(fen: string, level: Level, clock: ClockInfo): Promise<string | null>  // null if cancelled or no move
  hint(fen: string): Promise<string | null>
  cancel(): void                       // stop the current search; its result resolves to null
  lastScoreWhite: Score | null         // from the computer's latest move search, White's perspective
  multiThreaded: boolean
  error: string | null
}
export function useComputerOpponent(): Opponent
```
`move` limits: `nodes` levels → `{nodes}`; timed → `{wtime,btime,winc,binc}`; untimed → `{movetime: 1000}`. `hint` → `{strength:{limit:false,skill:20}, go:{depth:14}}`. A generation counter makes results from cancelled searches resolve `null`.

- [ ] Tests (mock `../engine/engine` with a fake whose `play` resolves on demand): `move` builds node limits for level 1 and clock limits for level 5 timed, movetime for untimed; `cancel()` during a pending `move` makes it resolve `null` and calls `engine.stop` (Review Focus 1); `lastScoreWhite` flips sign for Black to move; unmount calls `terminate` (Review Focus 4); `play` rejection → `error` = `The engine crashed. Please reload the page.` FAIL → implement → PASS → update CLAUDE.md → commit `Add the computer opponent hook`.

---

### Task 7: Play UI components

**Files:** Create `src/ui/PlaySetup.tsx`, `src/ui/ChessClock.tsx`, `src/ui/GameControls.tsx`, `src/ui/GameOverCard.tsx`, `src/ui/PlayMoveList.tsx` + tests `src/ui/PlaySetup.test.tsx`, `src/ui/PlayParts.test.tsx`

**Interfaces — Produces:**
```ts
PlaySetup({ settings: PlaySettings; onChange(patch): void; onStart(): void })   // slider id "level", label text e.g. "Level 5 · 1500 Elo", chips as buttons with aria-pressed, button "Start game"
ChessClock({ name: string; ms: number | null; active: boolean })   // data-testid "clock"; m:ss, tenths under 10 s (0:09.4); ms null → hidden
GameControls({ canTakeBack, canHint, evalVisible, onTakeBack, onHint, onToggleEval, onOfferDraw, onResign, disabled })  // buttons "Take back", "Hint", "Show eval bar"/"Hide eval bar", "Offer draw", "Resign"
GameOverCard({ outcome: Outcome; onReview(): void; onNewGame(): void })  // role "status", text "1-0 · Checkmate", buttons "Review this game", "New game"
PlayMoveList({ sans: string[]; firstColor: 'w' | 'b' })  // figurine SANs in numbered rows, data-testid "play-move"
```
- [ ] Tests: slider change calls `onChange({level: 7})` and label shows `Level 7 · 1900 Elo`; chip click calls `onChange({timeControl: '3+2'})` / `{color: 'b'}` with `aria-pressed` on the selected; clock formats `245000` → `4:05`, `9400` → `0:09.4`, active clock has `data-active="true"`; controls call handlers and respect `canTakeBack=false` (disabled); eval toggle label flips; game-over card text and buttons; move list renders `♞f3`. FAIL → implement (reuse `figurine`, `Card`, `SECONDARY_BUTTON`) → PASS → commit `Add play setup, clock, controls and game-over components`.

---

### Task 8: Play vs computer page

**Files:** Modify `src/pages/PlayVsComputer.tsx`; Create `src/pages/PlayVsComputer.test.tsx`; Modify `CLAUDE.md` (handles), `README.md` (tools list)

**Interfaces — Consumes:** everything above; `Board`, `EvalBar`, `useAnalysis`, `linesToArrows`, `createGame/legalDests/tryMove`, `useNavigate` from react-router.

Behaviour (spec): phases `setup → playing → over`. On Start: resolve color (random via `Math.random`), create game + clock (untimed → no clock), start White's clock. Computer's turn → `opponent.move(fen, level, clockInfo)`; on result apply move, press clock, check `boardOutcome`. User move via board `onMove` (only on user's turn) → apply, press clock, check outcome. Interval 100 ms re-renders clocks and checks `flagged` → `timeoutOutcome`. Take back → `opponent.cancel()`, undo 1 or 2 plies so it is the user's turn, restart the user's clock. Hint → arrow from `opponent.hint`, cleared on next move. Eval bar toggle → mounts an `EvalEngine` (`useAnalysis` at depth 18, multiPV 1) only when visible **and** it's the user's turn; shows last value otherwise. Draw → accept iff `|lastScoreWhite cp| ≤ 50` (mate scores decline) → `DRAW_AGREED`, else alert `Stockfish declines the draw.`. Resign → `resignOutcome(user)`. Over: stop clock, card; Review → `navigate('/import?pgn=' + encodeURIComponent(playPgn(...)) + '&user=You')`; New game → setup. Board read-only when over or computer's turn (`dests` empty, memoised).

- [ ] **Step 1: Failing tests** (jsdom; mock `../ui/Board` capturing props, mock `../hooks/useComputerOpponent` with a controllable fake, mock `../hooks/useAnalysis` with a stable state, wrap in `MemoryRouter`; fake timers where needed):
  - setup shows `Start game`; starting as White (`color:'w'`) shows two clocks `5:00`, board orientation white, user may move (dests non-empty).
  - user plays e2e4 → `opponent.move` called with the new FEN and level 5; resolving `'e7e5'` applies it; move list shows `e4`, `e5`.
  - playing Black → `opponent.move` called right after Start with the start FEN; orientation black (Review Focus 5).
  - take back while `opponent.move` is pending → `cancel` called, board back to start, later resolution of the old promise is ignored (Review Focus 1).
  - take back after a full exchange restores the position before the user's move.
  - hint → arrow equals the hinted move; cleared after the next user move.
  - eval toggle → `eval-bar` appears with the mocked score; hidden again on toggle.
  - offer draw with `lastScoreWhite {cp,20}` → game over `½-½ · Draw agreed`; with `{cp,300}` → alert `Stockfish declines the draw.`.
  - resign → `0-1 · Resignation` when user is White.
  - timeout: advance fake time past 1+0 → game over `0-1 · Timeout` (and clock shows 0:00.0).
  - computer delivers mate: user (White) plays f2f3, computer e7e5, user g2g4, computer d8h4 → `0-1 · Checkmate`, clocks stop (Review Focus 3).
  - Review this game → navigates to `/import?pgn=…&user=You` with PGN containing `[White "You"]`.
  - unmount mid-game → no interval left (`vi.getTimerCount() === 0`) (Review Focus 4).
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement. **Step 4:** PASS; `npm test`; `npx tsc -b`.
- [ ] **Step 5:** Browser check with `npm run dev`: play a few moves at level 1 and level 11, a 1+0 flag, take back during the computer's think, Review handoff opens the game in `/import`.
- [ ] **Step 6:** Update CLAUDE.md handles (`clock`, `play-move`, buttons `Start game`, `Take back`, `Hint`, `Show eval bar`/`Hide eval bar`, `Offer draw`, `Resign`, `Review this game`, `New game`, slider `level`), README tools line; commit `Play vs computer page`.
