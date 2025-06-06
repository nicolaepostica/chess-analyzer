import { afterEach, expect, it } from 'vitest'
import { analyzeAll } from './batch'
import { createEngine, type Engine } from './engine'
import { createNodeTransport } from './transport.node'
import type { EvalUpdate } from './uci'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const MATE_IN_ONE = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
const MATED = 'R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1'
const OPTIONS = { depth: 8, multiPV: 2, chess960: false }

let engine: Engine | null = null

afterEach(() => {
  engine?.terminate()
  engine = null
})

it('evaluates positions in order', async () => {
  engine = createEngine(await createNodeTransport())
  const results: [number, EvalUpdate[]][] = []
  await analyzeAll(engine, [START, MATE_IN_ONE], OPTIONS, (i, lines) => results.push([i, lines]), () => false)

  expect(results.map(([i]) => i)).toEqual([0, 1])
  expect(results[0][1]).toHaveLength(2)
  expect(results[0][1].map((line) => line.multipv)).toEqual([1, 2])
  const [best] = results[1][1]
  expect(best.pv[0]).toBe('a1a8')
  expect(best.score).toEqual({ type: 'mate', value: 1 })
})

it('stops between positions when cancelled', async () => {
  engine = createEngine(await createNodeTransport())
  let calls = 0
  await analyzeAll(engine, [START, MATE_IN_ONE, START], OPTIONS, () => (calls += 1), () => calls >= 1)
  expect(calls).toBe(1)
})

it('returns no lines for a checkmated position', async () => {
  engine = createEngine(await createNodeTransport())
  const results: EvalUpdate[][] = []
  await analyzeAll(engine, [MATED], OPTIONS, (_i, lines) => results.push(lines), () => false)
  expect(results).toEqual([[]])
})
