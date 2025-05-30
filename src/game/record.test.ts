import { expect, it } from 'vitest'
import { parseGameRecord, type GameRecord } from './record'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function record(pgn: string): GameRecord {
  const result = parseGameRecord(pgn)
  if (!result.ok) throw new Error(`expected a record, got ${result.reason}: ${result.message}`)
  return result.record
}

it('parses moves into UCI with before/after FENs', () => {
  const game = record('1. e4 e5 2. Nf3 *')
  expect(game.moves.map((move) => move.uci)).toEqual(['e2e4', 'e7e5', 'g1f3'])
  expect(game.positions).toHaveLength(4)
  expect(game.positions[0]).toBe(START)
  expect(game.moves[1].fenBefore).toBe(game.positions[1])
  expect(game.moves[1].fenAfter).toBe(game.positions[2])
  expect(game.moves.map((move) => move.color)).toEqual(['w', 'b', 'w'])
  expect(game.customStart).toBe(false)
})

it('encodes castling and promotion the way UCI does', () => {
  const game = record(
    '[SetUp "1"]\n[FEN "4k3/1P6/8/8/8/8/8/4K2R w K - 0 1"]\n\n1. O-O Kd7 2. b8=Q *',
  )
  expect(game.moves.map((move) => move.uci)).toEqual(['e1g1', 'e8d7', 'b7b8q'])
  expect(game.customStart).toBe(true)
  expect(game.startFen).toBe('4k3/1P6/8/8/8/8/8/4K2R w K - 0 1')
})

it('rejects variants', () => {
  const result = parseGameRecord('[Variant "Chess960"]\n\n1. e4 *')
  expect(result).toMatchObject({ ok: false, reason: 'unsupported-variant' })
})

it('accepts the Standard variant header', () => {
  expect(parseGameRecord('[Variant "Standard"]\n\n1. e4 *').ok).toBe(true)
})

it('rejects a game without moves', () => {
  const result = parseGameRecord('[White "a"]\n[Black "b"]\n\n*')
  expect(result).toMatchObject({ ok: false, reason: 'no-moves' })
})

it('rejects garbage', () => {
  expect(parseGameRecord('not a pgn 1. e9')).toMatchObject({ ok: false, reason: 'invalid-pgn' })
})

it('keeps headers', () => {
  const game = record('[White "Alice"]\n[Black "Bob"]\n[Date "2025.05.21"]\n\n1. e4 *')
  expect(game.headers).toMatchObject({ White: 'Alice', Black: 'Bob', Date: '2025.05.21' })
})

it('parses a real chess.com PGN with clock comments', async () => {
  const { default: archive } = await import('../sources/fixtures/archive-2025-04.json')
  const game = record(archive.games[0].pgn)
  expect(game.headers.White).toBe('Hikaru')
  expect(game.moves.length).toBeGreaterThan(20)
})
