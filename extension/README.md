# Chess Analyzer — "Analyze free" for chess.com

A Chrome extension (Manifest V3, personal use) that adds an **Analyze free**
button to finished chess.com games. The button opens Chess Analyzer's Game
Review — move labels, evaluation graph, accuracy — computed by Stockfish in your
browser, no subscription.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → select this `extension/` folder.

After editing the files, press the reload icon on the extension's card.

## Where the button appears

- On a finished game (`/game/live/<id>`, `/game/daily/<id>`), under the
  **Game Review** button in the sidebar.
- In the games archive (`/games/archive/<user>`), as a small **Analyze** button
  next to each game's accuracy.

## What it does and sends

On click it reads the game from chess.com's own
`/callback/{live,daily}/game/<id>` endpoint (same origin, your session), decodes
the moves (`tcn.js`) and opens

    https://nicolaepostica.github.io/chess-analyzer/import?source=chesscom&game=<id>&user=<player>&month=YYYY-MM&pgn=<game>

The game travels in the URL, so the review page does not depend on chess.com's
public API archive. If the callback fails, the link carries only
`game`/`user`, and the page looks the game up in the public archive instead.

No analytics, no other network requests, no permissions beyond running on
`https://www.chess.com/*`.

`user` is the player whose side is shown at the bottom: the `?username=` from an
archive link, the archive owner, or the player chess.com shows at the bottom of
the board (you, when you played), whichever played in the game; otherwise White.

## Development

The icons in `icons/` are drawn by `python3 scripts/build-extension-icons.py`
(Pillow; uses the Apple Symbols font for the knight).

Point the extension at a local build by changing `REVIEW_BASE` at the top of
`content.js` to `http://localhost:5173/`.

The chess.com selectors are constants at the top of `content.js`, with the
date they were observed. When the button stops appearing, those are the lines
to check.

`tcn.test.js` (run by `npm test` at the repo root) checks the move decoder
against a real game from chess.com's archive.

## Verified

2025-06-27, headless Chrome, with `tcn.js` + `content.js` injected into the
page (the headless browser would not load the unpacked extension itself):

- Finished live game: one button under Game Review; the link carries the full
  PGN (castling as `O-O-O`), and the review page loads and analyses it.
- Archive (`/games/archive/hikaru`): 50 rows → 50 buttons, no duplicates; the
  link for a game played the same day builds correctly.
- Not verified: daily games, SPA navigation between games, a signed-in session,
  loading the unpacked extension in a regular Chrome.

On 2025-06-27 the public API answered 404 for the current month's archive
(any player) for several hours while older months worked. Passing the PGN from
the callback avoids that.
