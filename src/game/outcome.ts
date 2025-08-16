import type { Chess } from 'chess.js'

export type Result = '1-0' | '0-1' | '1/2-1/2'
export type Reason =
  | 'checkmate'
  | 'resignation'
  | 'timeout'
  | 'stalemate'
  | 'threefold repetition'
  | 'fifty-move rule'
  | 'insufficient material'
  | 'draw agreed'
export type Outcome = { result: Result; reason: Reason; winner: 'w' | 'b' | null }

const win = (winner: 'w' | 'b', reason: Reason): Outcome => ({ result: winner === 'w' ? '1-0' : '0-1', reason, winner })
const draw = (reason: Reason): Outcome => ({ result: '1/2-1/2', reason, winner: null })
const other = (side: 'w' | 'b') => (side === 'w' ? 'b' : 'w')

/** How the position on the board ended the game, if it did. */
export function boardOutcome(game: Chess): Outcome | null {
  if (game.isCheckmate()) return win(other(game.turn()), 'checkmate')
  if (game.isStalemate()) return draw('stalemate')
  if (game.isInsufficientMaterial()) return draw('insufficient material')
  if (game.isThreefoldRepetition()) return draw('threefold repetition')
  if (game.isDrawByFiftyMoves()) return draw('fifty-move rule')
  return null
}

/** A lone king, or a king and one minor piece, cannot mate. */
function canMate(game: Chess, side: 'w' | 'b'): boolean {
  const pieces = game
    .board()
    .flat()
    .filter((square) => square?.color === side && square.type !== 'k')
  return !(pieces.length === 0 || (pieces.length === 1 && (pieces[0]!.type === 'n' || pieces[0]!.type === 'b')))
}

/** A flag fall loses, unless the opponent has no way to mate. */
export function timeoutOutcome(game: Chess, flaggedSide: 'w' | 'b'): Outcome {
  const opponent = other(flaggedSide)
  return canMate(game, opponent) ? win(opponent, 'timeout') : draw('timeout')
}

export function resignOutcome(resigning: 'w' | 'b'): Outcome {
  return win(other(resigning), 'resignation')
}

export const DRAW_AGREED: Outcome = draw('draw agreed')

function termination(outcome: Outcome, white: string, black: string): string {
  if (!outcome.winner) return `Game drawn by ${outcome.reason}`
  return `${outcome.winner === 'w' ? white : black} won by ${outcome.reason}`
}

const pad = (n: number) => String(n).padStart(2, '0')

export function playPgn(
  game: Chess,
  meta: { white: string; black: string; outcome: Outcome; timeControl: string; date: Date },
): string {
  const { white, black, outcome, timeControl, date } = meta
  const copy = new (game.constructor as typeof Chess)()
  copy.loadPgn(game.pgn())
  copy.setHeader('Event', 'Play vs computer')
  copy.setHeader('Site', 'Chess Analyzer')
  copy.setHeader('Date', `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`)
  copy.setHeader('White', white)
  copy.setHeader('Black', black)
  copy.setHeader('Result', outcome.result)
  copy.setHeader('TimeControl', timeControl)
  copy.setHeader('Termination', termination(outcome, white, black))
  return copy.pgn()
}
