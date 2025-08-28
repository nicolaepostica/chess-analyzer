import { Chess } from 'chess.js'
import { afterEach, expect, it } from 'vitest'
import { createEngine, type Engine } from './engine'
import { createNodeTransport } from './transport.node'
import type { EvalUpdate } from './uci'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const MATE_IN_ONE = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
const FULL = { limit: false, skill: 20 }

let engine: Engine | null = null
afterEach(() => {
  engine?.terminate()
  engine = null
})

const legal = (fen: string, uci: string | null) => {
  if (!uci) return false
  try {
    new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return true
  } catch {
    return false
  }
}

it('finds the best move at full strength', async () => {
  engine = createEngine(await createNodeTransport())
  const result = await engine.play(MATE_IN_ONE, { strength: FULL, go: { depth: 8 } })
  expect(result.move).toBe('a1a8')
  expect(result.score).toEqual({ type: 'mate', value: 1 })
})

it('plays a legal move at a limited Elo on a clock', async () => {
  engine = createEngine(await createNodeTransport())
  const result = await engine.play(START, {
    strength: { limit: true, elo: 1500 },
    go: { wtime: 60_000, btime: 60_000, winc: 0, binc: 0 },
  })
  expect(legal(START, result.move)).toBe(true)
})

it('returns quickly under a node cap', async () => {
  engine = createEngine(await createNodeTransport())
  const started = Date.now()
  const result = await engine.play(START, { strength: { limit: true, elo: 1320 }, go: { nodes: 50 } })
  expect(legal(START, result.move)).toBe(true)
  expect(Date.now() - started).toBeLessThan(2000)
})

it('stops on request and leaves the engine at full strength for analysis', async () => {
  engine = createEngine(await createNodeTransport())
  const pending = engine.play(START, { strength: { limit: true, elo: 1320 }, go: { depth: 30 } })
  await new Promise((resolve) => setTimeout(resolve, 50))
  engine.stop()
  await pending

  const updates: EvalUpdate[] = []
  for await (const update of engine.analyze(MATE_IN_ONE, { depth: 8, multiPV: 1, chess960: false })) updates.push(update)
  expect(updates.at(-1)!.pv[0]).toBe('a1a8')
})

it('drops a search that was stopped before it started', async () => {
  engine = createEngine(await createNodeTransport())
  const started = Date.now()
  const cancelled = engine.play(START, { strength: FULL, go: { depth: 30 } })
  engine.stop()
  const next = await engine.play(MATE_IN_ONE, { strength: FULL, go: { depth: 8 } })
  expect((await cancelled).move).toBeNull()
  expect(next.move).toBe('a1a8')
  expect(Date.now() - started).toBeLessThan(5000)
})
