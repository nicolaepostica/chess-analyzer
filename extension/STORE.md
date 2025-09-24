# Chrome Web Store listing

Copy-paste text for the developer dashboard. Keep in sync with `manifest.json`.

Package: zip of `manifest.json`, `background.js`, `content.js`, `tcn.js` and
`icons/` only (no tests, fixtures or docs):

    cd extension && zip -X ../chess-analyzer-extension-<version>.zip manifest.json background.js content.js tcn.js icons/*.png

## Store listing tab

**Name** (from the manifest): Chess Analyzer — Analyze free

**Summary** (from the manifest, max 132 chars): Adds an "Analyze free" button to
finished chess.com games that opens a free Stockfish Game Review.

**Description:**

> Review your chess.com games for free, with Stockfish running in your own browser.
>
> When a game ends, Chess Analyzer adds an **Analyze free** button right under
> chess.com's Game Review button — in the game-over window, in the sidebar, and
> next to every game in your archive. One click opens a full game review:
>
> • Every move labelled: Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, Blunder
> • Accuracy for both players
> • Evaluation graph of the whole game — click it to jump to any move
> • The better move shown for every mistake, with an arrow on the board
> • Step through the game, or open any position in the full analyzer
>
> No account, no subscription, no limit on the number of reviews. The analysis
> is computed by Stockfish (WebAssembly) on your computer; your games are not
> uploaded anywhere.
>
> Privacy: the extension requests no browser permissions, collects no personal
> data and has no analytics. It reads only the game you choose to analyze.
>
> Open source (GPL-3.0): https://github.com/nicolaepostica/chess-analyzer
>
> Chess Analyzer is an independent project and is not affiliated with or
> endorsed by Chess.com.

**Category:** Lifestyle → Games (closest fit)  
**Language:** English  
**Homepage URL:** https://nicolaepostica.github.io/chess-analyzer/  
**Support URL:** https://github.com/nicolaepostica/chess-analyzer/issues

**Screenshots:** 1280×800 PNG — the game-over window and sidebar on chess.com
with the button, and the Game Review page.

## Privacy practices tab

**Single purpose:**

> Adds an "Analyze free" button to finished games on chess.com that opens the
> game in Chess Analyzer's free Stockfish game review.

**Host permission justification** (content script on `https://www.chess.com/*`):

> The content script runs only on chess.com to place the "Analyze free" button
> next to chess.com's Game Review button and, when the user clicks it, to read
> that game's moves from chess.com's game endpoint so the review can open with it.

**Remote code:** No, I am not using remote code. All JavaScript is in the package.

**Data usage:** tick **Website content** (the game's moves, player names and
headers are read from chess.com and passed in the URL of the review tab when the
user clicks). Leave every other category unticked. Then certify all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:**
https://github.com/nicolaepostica/chess-analyzer/blob/main/extension/PRIVACY.md

## Distribution tab

**Visibility:** Public (or Unlisted to try it first)  
**Regions:** All regions  
**Pricing:** Free
