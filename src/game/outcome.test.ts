import { Chess } from 'chess.js'
import { expect, it } from 'vitest'
import { DRAW_AGREED, boardOutcome, playPgn, resignOutcome, timeoutOutcome } from './outcome'
import { parseGameRecord } from './record'

const play = (moves: string[], fen?: string) => {
  const game = new Chess(fen)
  for (const move of moves) game.move(move)
  return game
}

it('detects checkmate', () => {
  expect(boardOutcome(play(['f3', 'e5', 'g4', 'Qh4#']))).toEqual({ result: '0-1', reason: 'checkmate', winner: 'b' })
})

it('detects stalemate', () => {
  expect(boardOutcome(play(['Qg6'], '7k/8/8/8/8/8/8/K5Q1 w - - 0 1'))).toEqual({
    result: '1/2-1/2',
    reason: 'stalemate',
    winner: null,
  })
})

it('detects threefold repetition', () => {
  const game = play(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'])
  expect(boardOutcome(game)?.reason).toBe('threefold repetition')
})

it('detects insufficient material', () => {
  expect(boardOutcome(new Chess('8/8/4k3/8/8/3NK3/8/8 w - - 0 1'))?.reason).toBe('insufficient material')
})

it('returns null while the game goes on', () => {
  expect(boardOutcome(play(['e4']))).toBeNull()
})

it('draws on time when the other side cannot mate', () => {
  expect(timeoutOutcome(new Chess('8/8/4k3/8/8/3PK3/8/8 w - - 0 1'), 'w')).toEqual({
    result: '1/2-1/2',
    reason: 'timeout',
    winner: null,
  })
})

it('loses on time when the other side can still mate', () => {
  expect(timeoutOutcome(new Chess('8/8/4k3/8/8/3rK3/8/8 w - - 0 1'), 'w')).toEqual({
    result: '0-1',
    reason: 'timeout',
    winner: 'b',
  })
})

it('scores a resignation and an agreed draw', () => {
  expect(resignOutcome('w')).toEqual({ result: '0-1', reason: 'resignation', winner: 'b' })
  expect(DRAW_AGREED).toEqual({ result: '1/2-1/2', reason: 'draw agreed', winner: null })
})

it('writes a PGN the review can read back', () => {
  const game = play(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'])
  const pgn = playPgn(game, {
    white: 'You',
    black: 'Stockfish Level 5 (1500)',
    outcome: { result: '1-0', reason: 'checkmate', winner: 'w' },
    timeControl: '300+0',
    date: new Date(2025, 7, 7),
  })
  expect(pgn).toContain('[White "You"]')
  expect(pgn).toContain('[Result "1-0"]')
  expect(pgn).toContain('[TimeControl "300+0"]')
  expect(pgn).toContain('[Termination "You won by checkmate"]')
  expect(pgn).toContain('[Date "2025.08.07"]')
  const record = parseGameRecord(pgn)
  expect(record.ok && record.record.moves.map((m) => m.san)).toEqual(game.history())
})
