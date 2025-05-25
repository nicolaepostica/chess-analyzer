// Builds src/game/openings.json: every position along every named line of the
// lichess chess-openings dataset (https://github.com/lichess-org/chess-openings),
// released under the CC0 Public Domain Dedication.
//
// Positions are keyed by the first four FEN fields (placement, side to move,
// castling, en passant) so move clocks and transpositions do not matter.
//
//   node scripts/build-openings.js
import { writeFileSync } from 'node:fs'
import { Chess } from 'chess.js'

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/'
const key = (fen) => fen.split(' ').slice(0, 4).join(' ')

const positions = new Set()
for (const file of ['a', 'b', 'c', 'd', 'e']) {
  const response = await fetch(`${BASE}${file}.tsv`)
  if (!response.ok) throw new Error(`${file}.tsv: HTTP ${response.status}`)
  const rows = (await response.text()).trim().split('\n').slice(1)
  for (const row of rows) {
    const pgn = row.split('\t')[2]
    const game = new Chess()
    game.loadPgn(pgn)
    for (const move of game.history({ verbose: true })) positions.add(key(move.after))
  }
}

const out = new URL('../src/game/openings.json', import.meta.url)
writeFileSync(out, JSON.stringify([...positions].sort()))
console.log(`${positions.size} positions → ${out.pathname}`)
