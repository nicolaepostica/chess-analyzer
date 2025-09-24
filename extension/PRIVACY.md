# Privacy policy — Chess Analyzer "Analyze free"

Last updated: 2026-11-06

The Chess Analyzer Chrome extension adds an **Analyze free** button to finished
games on chess.com. This policy explains what it does with data.

## What the extension reads

Only when you click **Analyze free**, the extension reads the game you are
looking at from chess.com's own game endpoint (`www.chess.com/callback/...`),
using your existing chess.com session in the same tab. It reads the moves, the
game headers (player names, ratings, date, result, time control) and the name
of the player shown at the bottom of the board.

## Where the data goes

The game is put into the address of a new tab that opens Chess Analyzer at
`https://nicolaepostica.github.io/chess-analyzer/`. The analysis runs entirely
in your browser (Stockfish compiled to WebAssembly); the game is not uploaded
to any server run by the author, and nothing is stored.

The site is hosted on GitHub Pages. Like any web host, GitHub may record the
requested address in its server logs; see
[GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## What the extension does not do

- It does not collect personal information, passwords, browsing history or
  analytics.
- It makes no network requests other than the chess.com request above, and
  opening the Chess Analyzer tab when you click.
- It does not sell or share data with anyone, and does not use it for
  advertising or for anything other than showing you the game review.
- It requests no browser permissions; it only runs on `https://www.chess.com/*`.

## Contact

Questions: open an issue at
https://github.com/nicolaepostica/chess-analyzer/issues.

Chess Analyzer is not affiliated with or endorsed by Chess.com.
