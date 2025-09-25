# Chess.com game review — design

Date: 2025-05-20
Status: draft, awaiting approval
Predecessor: `2026-07-09-chess-analyzer-design.md` (this is its sub-project 3,
"Game import and review", narrowed to Chess.com)

## Intent

The user finishes a game on chess.com and wants a full Game Review — every move
labelled, an evaluation graph, both players' accuracy — without a chess.com
subscription. Stockfish already runs in this app's browser tab; what is missing
is a whole-game review mode, a way to get the game here in one click, and a
public URL to open.

Three deliverables:

1. **Game Review page** in this app, at the existing `/import` route (today a stub).
2. **Chrome extension** (Manifest V3, loaded unpacked, personal use) that adds an
   "Analyze free" button on chess.com and opens the review page for that game.
3. **GitHub Pages deployment** of the app at
   `https://nicolaepostica.github.io/chess-analyzer/`.

## Goals

- One click from a finished chess.com game to a running review.
- Chess.com-style move labels, including the "nice" ones (brilliant, great, best).
- Evaluation graph across the whole game, accuracy per player.
- A 40-move game fully reviewed in about **1–2 minutes** on a normal laptop.
- Results appear progressively while the engine works.

## Non-goals

- Live games in progress (and anything that could assist during play).
- Lichess or other sites. The game loader should not make adding one hard, but
  none is built.
- Chrome Web Store publication, Firefox, Safari.
- Accounts, saved history, server-side anything. The page is static.
- Matching chess.com's numbers exactly. Their formulas are closed.

## Anti-goals

- The extension must not read or send anything beyond what is needed to build
  the review link. No analytics, no remote calls to third parties.
- Never present a guess as a fact: if the game cannot be found, say so and offer
  a retry or manual PGN paste; don't silently analyse something else.
- Don't break the existing analyzer, its tests, or the architecture boundaries in
  `CLAUDE.md`.

## User flow

1. User opens a finished game on chess.com (`/game/live/<id>` or
   `/game/daily/<id>`), or their games archive.
2. Next to the game info block (and, in the archive, on each row) there is an
   **Analyze free** button.
3. Click opens a new tab:
   `https://nicolaepostica.github.io/chess-analyzer/import?source=chesscom&game=<id>&user=<username>&month=YYYY-MM`
4. The page fetches the game, then reviews it, filling in the graph and labels
   move by move, with a progress indicator ("move 23 of 41").
5. User walks through moves; any position can be opened in the regular analyzer.

## The URL contract (extension → page)

| Param    | Required | Meaning |
|----------|----------|---------|
| `source` | yes      | `chesscom` (only value for now) |
| `game`   | yes      | Chess.com numeric game id |
| `user`   | yes      | Username of a player in the game. The extension sends the logged-in chess.com user if they played in it, otherwise White. The page checks it against the PGN's White/Black (case-insensitive); on mismatch it still uses it for fetching but falls back to PGN names and White-at-bottom for display. (My call.) |
| `month`  | no       | `YYYY-MM` the game was played. If absent, the page tries the current and the previous month |
| `pgn`    | no       | Fallback: full PGN, URL-encoded. If present, the page skips fetching entirely |

The page also works with no params: it shows a PGN paste box (the existing
`PositionInput` PGN flow) and reviews whatever is pasted.

## Fetching the game (page side)

Verified on 2025-05-20: `api.chess.com/pub/...` answers with
`access-control-allow-origin: *`, so the static page can call it directly. There
is no "game by id" endpoint; the page fetches
`https://api.chess.com/pub/player/<user>/games/<YYYY>/<MM>` and finds the game
whose `url` ends in `/<id>`, then takes its `pgn` field.

Unverified: how soon a just-finished game appears in that archive. If it isn't
found, the page shows a `role="alert"` message "Game not found in the archive
yet — chess.com may take a minute to publish it" with a **Retry** button and the
PGN paste box. If during implementation the delay turns out to be routinely
long, switch the extension to pass `pgn` directly (see below) — the page already
supports it.

## Chrome extension

Lives in `extension/` in this repo. Plain JS, no build step, no dependencies.

- Manifest V3, one content script on `https://www.chess.com/*`. No popup, no
  options page, no background worker unless one turns out to be required.
- Chess.com is a single-page app: the script watches the DOM (MutationObserver)
  and injects the button when a finished-game view or archive rows appear;
  it must not inject duplicates.
- To build the link it needs the game id (from the URL / row link), a player's
  username and the month. **Builder's call** how to obtain the last two: read
  them from the DOM, or call chess.com's same-origin endpoint
  `https://www.chess.com/callback/live/game/<id>` from the content script
  (unofficial; returns PGN headers including Date/White/Black). Whatever is used
  must degrade gracefully: if the month is unknown, omit it; if PGN is readily
  available, it may be passed as `pgn`.
- The page's base URL is a constant at the top of the script, so the user can
  point it at `http://localhost:5173` while developing.
- A short `extension/README.md`: how to load unpacked in Chrome.

## Game Review page

Layout (chosen in brainstorming, option B):

```
┌──────────────────────── evaluation graph (full width) ────────────────────────┐
│  white area = White's advantage; coloured dots on labelled moves;             │
│  vertical line = current move; click jumps to that move                        │
└────────────────────────────────────────────────────────────────────────────────┘
┌─ eval bar ─┬──── board ────┐  ┌─ accuracy:  You 87.4   Opponent 72.1 ────────┐
│            │               │  ├─ label counts per player (!! ! ★ … ?? )       │
│            │               │  ├─ move list with label glyphs, current move     │
│            │               │  │  highlighted                                   │
│            │               │  ├─ hint for current move: "Best was 13. Be2      │
│            │               │  │  (+0.6); after Qd2 −2.1"  [Analyze position]  │
└────────────┴───────────────┘  └───────────────────────────────────────────────┘
```

- Progress indicator while reviewing; graph, labels and accuracy fill in as
  plies complete. Accuracy is shown once enough plies are done (builder's call
  on the exact rule; showing it only at the end is acceptable).
- ← / → keys step through moves; Home / End jump to start / end.
- Board orientation: the `user` param's colour at the bottom (fallback White).
- "You" / "Opponent" labels use the `user` param; without it, show player names
  from the PGN headers.
- **Analyze position** opens `/` (the existing analyzer) with that FEN **in a
  new tab**, so the finished review is never lost and no review cache is
  needed. The analyzer must learn to read `?fen=` on load. Navigating away from
  the review page within the app cancels a review in progress. (My calls.)
- **Supported games** (my call): standard chess, including games with a custom
  start (`SetUp`/`FEN` headers; Book label then disabled). Chess960 and other
  variants (`Variant` header present and not "Standard") show a `role="alert"`
  "This variant isn't supported yet" instead of a review.
- Engine-crash and slow-build banners reuse the existing `role="alert"` pattern.

## Move classification

All labels are computed from **expected points / win probability** from the
mover's perspective, using the lichess win-probability curve
`win% = 50 + 50 · (2 / (1 + e^(−0.00368208 · cp)) − 1)`, mate scores mapped to
0/100. *My call:* thresholds follow the publicly described chess.com
expected-points bands:

| Label | Glyph | Rule (loss = win% before best move − win% after played move) |
|---|---|---|
| Brilliant | `!!` | Played move is best or within "excellent", involves a material sacrifice that the engine confirms holds, and the position before the move was not already winning (< ~90% for the mover). Heuristic. |
| Great | `!` | Played move is best and the second-best engine move loses ≥ ~10 points (only move). Heuristic. |
| Best | `★` | Played move equals the engine's top move. |
| Excellent | | loss < 2 |
| Good | | loss < 5 |
| Book | | Position is in the opening book (see below). |
| Inaccuracy | `?!` | loss < 10 |
| Mistake | `?` | loss < 20 |
| Blunder | `??` | loss ≥ 20 |
| Miss | | Opponent's previous move was a mistake/blunder and this move fails to exploit it (loss ≥ 10 while a winning continuation existed). |

**Precedence** (my call), first match wins: Book > Brilliant > Great > Best >
Excellent > Good > Miss > Blunder > Mistake > Inaccuracy. So a top-engine move
is Best, not Excellent; Miss replaces the loss-based bad label it overlaps.
Label counts include every move; accuracy excludes book moves.

Exact constants for brilliant/great/miss are the builder's to tune; they will
sometimes disagree with chess.com, and that is accepted.

**Accuracy** per player: lichess's open formula (per-move accuracy from win%
loss, aggregated with the volatility-weighted mean + harmonic mean as lichess
does). It will be close to, not equal to, chess.com's CAPS.

**Opening book:** *My call:* use the lichess `chess-openings` dataset (CC0,
compatible with GPL-3.0), bundled as a compact set of EPD/FEN positions.
If size or licensing becomes a problem, drop the Book label rather than block
the release.

Classification is pure logic over engine scores and positions: it belongs in
`src/game/` (e.g. `src/game/review.ts`), test-first, with no engine or React
imports. It needs the material count for "sacrifice", which chess.js provides.

## Engine use for review

- Each position of the game is analysed once (N plies + 1), with `multiPV: 2`
  (needed for "great" and "brilliant"), at a fixed depth or time budget chosen
  so a 40-move game finishes in ~1–2 minutes with the multi-threaded build.
  The builder picks and documents the budget.
- Scores are normalised to White's perspective for the graph, exactly as the
  existing `toWhitePerspective` does.
- The existing `Engine` interface already supports this (one `analyze` per
  position, take the final update). No changes to `engine.ts` are expected; if
  one turns out necessary, it must keep the search-interruption invariants.
- **Architecture note:** `CLAUDE.md` says `useAnalysis` is the single point where
  the engine meets React. Review needs a different lifecycle (a batch over all
  positions, not one live position). *My call:* add a second hook,
  `src/hooks/useGameReview.ts`, owning its own engine instance, and update
  `CLAUDE.md` to say "the hooks in `src/hooks/` are the only places…". The
  review page never runs both hooks at once.

## GitHub Pages deployment

- GitHub Actions workflow builds on push to `main` and deploys to Pages. Pages is not
  enabled on the repo yet; enabling it (source: GitHub Actions) is a setup step.
- Vite `base: '/chess-analyzer/'` for the Pages build; `BrowserRouter` gets a
  matching `basename`. Deep links (`/chess-analyzer/import?...`) need the
  standard SPA fallback: copy `index.html` to `404.html` in the build output.
- `src/engine/transport.ts` uses absolute `/stockfish/...` URLs; they must become
  base-aware (`import.meta.env.BASE_URL`).
- **Cross-origin isolation:** GitHub Pages cannot set COOP/COEP headers, so
  without help the app falls back to the slow single-threaded engine and the
  1–2 minute target is at risk. *My call:* add the `coi-serviceworker` shim
  (MIT, GPL-compatible) which re-serves the page with those headers after one
  reload. Requests to `api.chess.com` must still work under
  `require-corp`/`credentialless` — the builder verifies this; if it breaks the
  fetch, prefer `Cross-Origin-Embedder-Policy: credentialless` in the shim.
  If the shim fails entirely, ship single-threaded with a lower budget and say
  so in the banner.
- The `public/stockfish/` copy step stays as is; it runs in CI before the build.

## Testing

- `src/game/review.ts`: unit tests for every label boundary, accuracy, and
  sacrifice detection, on hand-made score sequences (no engine).
- Chess.com loader: unit tests with a recorded archive JSON fixture (found,
  not found, month absent → two months tried, `pgn` param short-circuit).
- Review page: jsdom tests with a fake review hook, preserving the existing
  test-handle conventions (`role="alert"` on errors, stable test ids for graph
  and move list — builder names them and lists them in `CLAUDE.md`).
- One Node engine test that reviews a short game end-to-end with the shared
  Stockfish instance.
- Extension: no automated tests; a manual check on a real chess.com game page
  and archive, documented in `extension/README.md`.

## Constraints

- English for code, UI strings, docs. Conventional Commits. Work on
  `feat/chess-com-review`, not `main`.
- GPL-3.0; no incompatible dependencies. Pinned versions stay pinned.
- Dark theme, existing Tailwind tokens; new text colours must pass
  `contrast.test.ts`. Label colours (green/yellow/orange/red) are new tokens in
  the `@theme` block.
- Only the `lite` engine build.

## Left to the builder

- Exact depth/time budget, brilliant/great/miss constants.
- How the extension reads username and month.
- Graph implementation (hand-written SVG preferred over a charting dependency).
- Visual details within the chosen layout.
