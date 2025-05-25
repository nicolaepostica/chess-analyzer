import { expect, it } from 'vitest'
import { isBookPosition } from './book'
import { parseGameRecord } from './record'

function finalFen(pgn: string): string {
  const result = parseGameRecord(pgn)
  if (!result.ok) throw new Error(result.message)
  return result.record.positions.at(-1)!
}

it('knows the position after 1. e4', () => {
  expect(isBookPosition(finalFen('1. e4 *'))).toBe(true)
})

it('matches transpositions', () => {
  expect(isBookPosition(finalFen('1. d4 Nf6 2. c4 e6 *'))).toBe(true)
  expect(isBookPosition(finalFen('1. c4 e6 2. d4 Nf6 *'))).toBe(true)
})

it('rejects a position that is not an opening', () => {
  expect(isBookPosition('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1')).toBe(false)
})

it('ignores the move clocks', () => {
  const fen = finalFen('1. e4 *').split(' ').slice(0, 4).join(' ')
  expect(isBookPosition(`${fen} 5 9`)).toBe(true)
})
