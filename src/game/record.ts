import { Chess } from 'chess.js'
import { loadPgn } from './pgn'

export type RecordedMove = {
  san: string
  uci: string
  color: 'w' | 'b'
  fenBefore: string
  fenAfter: string
}

export type GameRecord = {
  headers: Record<string, string>
  startFen: string
  /** True when the game starts from a SetUp/FEN position rather than the standard one. */
  customStart: boolean
  moves: RecordedMove[]
  /** Every position of the game: the start, then the position after each move. */
  positions: string[]
}

export type RecordResult =
  | { ok: true; record: GameRecord }
  | { ok: false; reason: 'invalid-pgn' | 'unsupported-variant' | 'no-moves'; message: string }

export function parseGameRecord(pgn: string): RecordResult {
  const loaded = loadPgn(pgn)
  if (!loaded.ok) return { ok: false, reason: 'invalid-pgn', message: loaded.error }

  const headers = loaded.game.getHeaders() as Record<string, string>
  const variant = headers.Variant
  if (variant && variant.toLowerCase() !== 'standard') {
    return { ok: false, reason: 'unsupported-variant', message: `Unsupported variant: ${variant}` }
  }

  const history = loaded.game.history({ verbose: true })
  if (history.length === 0) return { ok: false, reason: 'no-moves', message: 'The game has no moves' }

  const startFen = history[0].before
  const moves: RecordedMove[] = history.map((move) => ({
    san: move.san,
    // Engine PVs use UCI, so compare played moves in the same notation.
    uci: move.from + move.to + (move.promotion ?? ''),
    color: move.color,
    fenBefore: move.before,
    fenAfter: move.after,
  }))

  return {
    ok: true,
    record: {
      headers,
      startFen,
      customStart: startFen !== new Chess().fen(),
      moves,
      positions: [startFen, ...moves.map((move) => move.fenAfter)],
    },
  }
}
