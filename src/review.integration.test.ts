import { afterEach, expect, it } from 'vitest'
import { analyzeAll } from './engine/batch'
import { createEngine, type Engine } from './engine/engine'
import { createNodeTransport } from './engine/transport.node'
import { isBookPosition } from './game/book'
import { parseGameRecord } from './game/record'
import { reviewGame, type PositionEval } from './game/review'

let engine: Engine | null = null

afterEach(() => {
  engine?.terminate()
  engine = null
})

it('reviews a short game end-to-end', async () => {
  const parsed = parseGameRecord('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0')
  if (!parsed.ok) throw new Error(parsed.message)
  const record = parsed.record

  engine = createEngine(await createNodeTransport())
  const evals: PositionEval[] = []
  await analyzeAll(
    engine,
    record.positions,
    { depth: 8, multiPV: 2, chess960: false },
    (i, lines) => (evals[i] = { lines }),
    () => false,
  )

  const result = reviewGame(record, evals, isBookPosition)
  expect(result.moves).toHaveLength(7)
  expect(['blunder', 'mistake']).toContain(result.moves[5].label)
  // Qxf7# is the only winning move, so Great is as right as Best.
  expect(['best', 'great']).toContain(result.moves[6].label)
  expect(result.accuracy!.white).toBeGreaterThan(result.accuracy!.black)
})
