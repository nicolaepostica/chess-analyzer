// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { EvalUpdate } from '../engine/uci'
import { parseGameRecord, type GameRecord } from '../game/record'

const terminate = vi.fn()
const analyzeAll = vi.fn()

// The real engine is a Stockfish worker; the batch runner is what the hook drives.
vi.mock('../engine/transport', () => ({
  createWorkerTransport: () => ({ send() {}, onLine() {}, terminate() {} }),
  isMultiThreaded: () => true,
}))
vi.mock('../engine/engine', () => ({
  createEngine: () => ({ analyze: vi.fn(), stop: vi.fn(), terminate }),
}))
vi.mock('../engine/batch', () => ({
  REVIEW_OPTIONS: { depth: 16, multiPV: 2, chess960: false },
  analyzeAll: (...args: unknown[]) => analyzeAll(...args),
}))

const { useGameReview } = await import('./useGameReview')

const line = (uci: string): EvalUpdate => ({ depth: 16, multipv: 1, score: { type: 'cp', value: 20 }, pv: [uci] })

function record(pgn: string): GameRecord {
  const result = parseGameRecord(pgn)
  if (!result.ok) throw new Error(result.message)
  return result.record
}

beforeEach(() => {
  terminate.mockReset()
  analyzeAll.mockReset()
})

it('reviews every position of the game', async () => {
  analyzeAll.mockImplementation(async (_engine, fens: string[], _options, onResult) => {
    fens.forEach((_fen, i) => onResult(i, [line('e2e4')]))
  })
  const { result } = renderHook(({ game }) => useGameReview(game), { initialProps: { game: record('1. e4 e5 *') } })

  await waitFor(() => expect(result.current.done).toBe(true))
  expect(result.current.evaluated).toBe(3)
  expect(result.current.total).toBe(3)
  expect(result.current.result.moves).toHaveLength(2)
  expect(result.current.error).toBeNull()
})

it('does nothing without a game', () => {
  const { result } = renderHook(() => useGameReview(null))
  expect(result.current.total).toBe(0)
  expect(result.current.done).toBe(false)
  expect(analyzeAll).not.toHaveBeenCalled()
})

it('cancels and terminates the engine on unmount', async () => {
  let isCancelled: () => boolean = () => false
  analyzeAll.mockImplementation((_engine, _fens, _options, _onResult, cancelled) => {
    isCancelled = cancelled
    return new Promise(() => {})
  })
  const { unmount } = renderHook(({ game }) => useGameReview(game), { initialProps: { game: record('1. e4 *') } })
  await waitFor(() => expect(analyzeAll).toHaveBeenCalled())

  unmount()
  expect(terminate).toHaveBeenCalled()
  expect(isCancelled()).toBe(true)
})

it('reports a failed review', async () => {
  analyzeAll.mockRejectedValue(new Error('boom'))
  const { result } = renderHook(({ game }) => useGameReview(game), { initialProps: { game: record('1. e4 *') } })
  await waitFor(() => expect(result.current.error).toBe('The engine crashed. Please reload the page.'))
})
