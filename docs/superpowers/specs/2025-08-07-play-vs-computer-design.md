# Play vs computer — design

Date: 2025-08-07
Status: draft, awaiting approval
Predecessor: `2026-07-09-chess-analyzer-design.md` (sub-project 2, "Play against
the computer"; Chess960 stays out of scope here)

## Intent

The user wants to play a full game against Stockfish at a chosen strength, on a
clock, and then open that game in the existing Game Review with one click. The
page is `/play` (today a stub).

## Goals

- Strength selector with 11 levels, each showing its Elo equivalent.
- Time controls: 1+0, 3+2, 5+0, 10+0, 15+10, and untimed.
- Colour choice: White, Black, Random.
- During the game: take back, hint, show/hide the evaluation bar, offer a
  draw, resign.
- At the end: result and reason, **Review this game** (opens `/import` with the
  game), **New game**.

## Non-goals

- Saved game history, accounts, ratings.
- Resuming a game after a reload (it is lost; my call).
- Premoves, sounds, Chess960, playing from a custom position.
- Under-promotion: promotions auto-queen, as the existing board does (my call).

## Anti-goals

- The computer must never move for the user or reveal its plan unless the user
  asks (hint, evaluation bar).
- A level's label must not overstate precision: approximate Elo is shown with
  `~`.

## Levels (my call)

Stockfish 18 `lite` (verified 2026-10-27 via `uci`): `UCI_LimitStrength`,
`UCI_Elo` 1320–3190, `Skill Level` 0–20.

Stockfish turns `UCI_Elo` into a fractional Skill Level internally, and its
1320 floor sits at about Skill Level 0, so Skill Level alone cannot go weaker
than ~1320. Strength must **rise with the level**, so levels 1–3 add a node cap
on top of the weakest setting (my call):

| Level | Label | Engine settings |
|---|---|---|
| 1 | ~800 | `UCI_LimitStrength true`, `UCI_Elo 1320`, search capped at ~50 nodes |
| 2 | ~1000 | same, ~300 nodes |
| 3 | ~1200 | same, ~1500 nodes |
| 4 | 1350 | `UCI_LimitStrength true`, `UCI_Elo 1350` |
| 5 | 1500 | `UCI_Elo 1500` |
| 6 | 1700 | `UCI_Elo 1700` |
| 7 | 1900 | `UCI_Elo 1900` |
| 8 | 2100 | `UCI_Elo 2100` |
| 9 | 2400 | `UCI_Elo 2400` |
| 10 | 2700 | `UCI_Elo 2700` |
| 11 | Max | `UCI_LimitStrength false`, `Skill Level 20` |

The level table lives in one module so the numbers can be tuned without
touching anything else. The labels are estimates: the node caps for levels 1–3
are not calibrated, and Stockfish's Elo scale is measured at long time
controls, so fast games play somewhat weaker than the label. Node-capped levels
move as soon as the cap is reached and ignore their clock budget. A Node test
checks only that levels are ordered sensibly where measurable (e.g. a node cap
returns quickly), not their Elo.

## Screens (approved mockup)

**Setup** (a card shown before the game): level slider with the label of the
selected level, colour chips, time-control chips, **Start game**. The last
choices are remembered in `localStorage` (my call; same pattern as
`useSettings`).

**Game**: board (with the eval bar to its left when visible); next to it, top to
bottom: the computer's clock with its name ("Stockfish · 1500"), the move list
(same figurine style as the review's move list), the user's clock; buttons
**Take back**, **Hint**, **Eval bar** (toggle), **Offer draw**, **Resign**. The
side to move has its clock highlighted. Board oriented to the user's colour.

**Game over**: a card with the result (`1-0`, `0-1`, `½-½`) and reason
(checkmate, resignation, timeout, stalemate, threefold repetition, fifty-move
rule, insufficient material, draw agreed), plus **Review this game** and
**New game**. The board stays on the final position.

## Rules and behaviour

- **Clock:** Fischer increment added after each move. The side to move's clock
  runs; the computer's clock runs while it thinks. A clock at zero loses,
  unless the opponent has insufficient mating material, which is a draw.
  Untimed games show no clocks.
- **Computer's thinking:** uses its own remaining time and increment (`go wtime
  btime winc binc`), so it plays faster when short of time. Untimed games use a
  fixed per-move budget (my call: about 1 s).
- **Take back:** undoes the user's last move and the computer's reply (or just
  the user's move if the computer hasn't replied yet, cancelling its search).
  Clocks keep their current times (my call). Allowed at any time during the
  game, including timed games.
- **Hint:** a full-strength search of the current position (a few hundred ms,
  my call ~depth 14) shown as an arrow on the board; available only on the
  user's turn. The user's clock keeps running during it (no pause state; my
  call). The arrow disappears once the user moves.
- **Eval bar:** hidden by default. When shown, it reflects a full-strength
  analysis of the current position (White's perspective, as everywhere else).
  Its analysis runs **only on the user's turn** and keeps showing the last value
  while the computer thinks, so the bar never takes CPU from the opponent (my
  call).
- **Draw offer:** the computer accepts when its own last evaluation is within
  ±0.5 pawns, otherwise declines with a short message (my call). Decided
  instantly from that last evaluation, no extra search.
- **Resign:** the user loses immediately.
- **Game end detection:** checkmate, stalemate, threefold repetition,
  fifty-move rule, insufficient material — from chess.js.

## Review handoff

**Review this game** navigates (same tab, react-router) to
`/import?pgn=<PGN>&user=You`. The PGN carries headers: `White`/`Black` = `You`
and `Stockfish Level N (Elo)`, `Result`, `Date`, `TimeControl` (e.g. `300+0`,
`-` untimed), `Termination`. With `user=You` the review orients the board to the
user and labels "You / Opponent".

## Architecture

- **Pure logic in `src/game/`**, test-first: the clock (state, start, press,
  tick by elapsed ms, flag detection), the level table, game-end reason
  detection, PGN headers for the handoff.
- **Engine:** the computer needs searches that `Engine.analyze` cannot express
  today (`go wtime …`, strength options). Extend `src/engine/` so a search can
  carry these, keeping the search-interruption invariants in `CLAUDE.md`
  (one search at a time, `finally` awaits `bestmove`, `terminate()` releases
  waiters). The exact API is the builder's call.
- **Hooks:** a new hook (e.g. `src/hooks/useComputerOpponent.ts`) owns the
  opponent's engine and exposes "make a move in this position with this clock"
  and "hint". The eval bar uses `useAnalysis` in a component mounted only while
  the bar is visible (the pattern `GameReview` uses for exploration). Update
  the architecture paragraph in `CLAUDE.md`.
- **UI:** presentational components for the setup card, clocks and game
  controls; the page `src/pages/PlayVsComputer.tsx` composes them. Reuse
  `Board`, `EvalBar`, the figurine move list.

## Testing

- Unit tests for the clock (increments, flag, untimed), level table mapping,
  end-reason detection and PGN headers.
- Node engine test: a strength-limited search with `wtime/btime` returns a
  legal move; changing strength between searches works; take-back cancelling a
  search doesn't deadlock the next one.
- Page tests (jsdom, mocked hooks): setup → start; user move → computer move;
  take back; hint arrow; eval-bar toggle; resign; timeout; game-over card;
  Review link carries the PGN and `user=You`.

## Constraints

- English UI strings and code; commit messages without `feat:`/`docs:` prefixes
  (only `fix:` for bugs); every commit goes through `backdate-commits --split`
  before push.
- New colour tokens, if any, pass `contrast.test.ts`.
- Only the `lite` engine build.

## Left to the builder

- Engine API shape for strength and clock searches.
- Exact hint depth and untimed move budget.
- Visual details within the approved mockup.
