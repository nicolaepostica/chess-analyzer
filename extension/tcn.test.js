import { Chess } from 'chess.js'
import { expect, it } from 'vitest'
import fixture from './fixtures/game-137836247135.json'
import './tcn.js'

const { decodeTcn, buildPgn } = globalThis.chessAnalyzerTcn

it('decodes chess.com TCN into from/to squares', () => {
  expect(decodeTcn(fixture.callback.moveList).slice(0, 2)).toEqual([
    { from: 'e2', to: 'e4' },
    { from: 'g7', to: 'g6' },
  ])
})

it('decodes a promotion', () => {
  expect(decodeTcn('X~')).toEqual([{ from: 'b7', to: 'b8', promotion: 'q' }])
})

it('rebuilds the same game chess.com publishes in its archive', () => {
  const pgn = buildPgn(fixture.callback.pgnHeaders, fixture.callback.moveList)
  const ours = new Chess()
  ours.loadPgn(pgn)
  const theirs = new Chess()
  theirs.loadPgn(fixture.archivePgn)
  expect(ours.history()).toEqual(theirs.history())
  expect(ours.getHeaders()).toMatchObject({ White: 'DmitryMaximov', Black: 'Hikaru', Date: '2025.04.01' })
})

it('writes castling the way PGN expects', () => {
  const pgn = buildPgn({}, decodeTcnInverse(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1']))
  expect(pgn).toMatch(/4\. O-O/)
  const game = new Chess()
  game.loadPgn(pgn)
  expect(game.history().at(-1)).toBe('O-O')
})

it('starts numbering from a custom position with Black to move', () => {
  const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 7'
  const pgn = buildPgn({ SetUp: '1', FEN: fen }, decodeTcnInverse(['e8d8', 'e2e4']))
  expect(pgn).toMatch(/7\.\.\. e8d8 8\. e2e4/)
  const game = new Chess()
  game.loadPgn(pgn)
  expect(game.history()).toEqual(['Kd8', 'e4'])
})

// Test helper: encode plain UCI moves as TCN (no promotions).
function decodeTcnInverse(moves) {
  const T = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?'
  const index = (sq) => sq.charCodeAt(0) - 97 + (Number(sq[1]) - 1) * 8
  return moves.map((m) => T[index(m.slice(0, 2))] + T[index(m.slice(2, 4))]).join('')
}
