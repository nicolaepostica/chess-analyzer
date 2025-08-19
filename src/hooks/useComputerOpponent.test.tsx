// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { PlayLimits, PlayResult } from '../engine/engine'
import { LEVELS } from '../game/levels'

type Pending = { fen: string; limits: PlayLimits; resolve: (r: PlayResult) => void; reject: (e: unknown) => void }
const calls: Pending[] = []
const stop = vi.fn()
const terminate = vi.fn()

vi.mock('../engine/transport', () => ({
  createWorkerTransport: () => ({ send() {}, onLine() {}, terminate() {} }),
  isMultiThreaded: () => true,
}))
vi.mock('../engine/engine', () => ({
  createEngine: () => ({
    analyze: vi.fn(),
    play: (fen: string, limits: PlayLimits) =>
      new Promise<PlayResult>((resolve, reject) => calls.push({ fen, limits, resolve, reject })),
    stop,
    terminate,
  }),
}))

const { useComputerOpponent } = await import('./useComputerOpponent')

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

beforeEach(() => {
  calls.length = 0
  stop.mockReset()
  terminate.mockReset()
})

it('caps nodes on the weakest levels', async () => {
  const { result } = renderHook(() => useComputerOpponent())
  void result.current.move(START, LEVELS[0], null)
  await waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0].limits).toEqual({ strength: { limit: true, elo: 1320 }, go: { nodes: 50 } })
})

it('plays on its clock at rated levels', async () => {
  const { result } = renderHook(() => useComputerOpponent())
  void result.current.move(START, LEVELS[4], { wtime: 300_000, btime: 290_000, winc: 0, binc: 0 })
  await waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0].limits).toEqual({
    strength: { limit: true, elo: 1500 },
    go: { wtime: 300_000, btime: 290_000, winc: 0, binc: 0 },
  })
})

it('thinks about a second per move without a clock', async () => {
  const { result } = renderHook(() => useComputerOpponent())
  void result.current.move(START, LEVELS[10], null)
  await waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0].limits.go).toEqual({ movetime: 1000 })
})

it('hints at full strength', async () => {
  const { result } = renderHook(() => useComputerOpponent())
  const hint = result.current.hint(START)
  await waitFor(() => expect(calls).toHaveLength(1))
  expect(calls[0].limits).toEqual({ strength: { limit: false, skill: 20 }, go: { depth: 14 } })
  calls[0].resolve({ move: 'e2e4', score: null })
  await expect(hint).resolves.toBe('e2e4')
})

it('drops the result of a cancelled search', async () => {
  const { result } = renderHook(() => useComputerOpponent())
  const move = result.current.move(START, LEVELS[4], null)
  await waitFor(() => expect(calls).toHaveLength(1))
  act(() => result.current.cancel())
  expect(stop).toHaveBeenCalled()
  calls[0].resolve({ move: 'e2e4', score: null })
  await expect(move).resolves.toBeNull()
})

it("reports the computer's evaluation from White's side", async () => {
  const { result } = renderHook(() => useComputerOpponent())
  const move = result.current.move(AFTER_E4, LEVELS[4], null)
  await waitFor(() => expect(calls).toHaveLength(1))
  await act(async () => calls[0].resolve({ move: 'e7e5', score: { type: 'cp', value: 30 } }))
  await move
  expect(result.current.lastScoreWhite).toEqual({ type: 'cp', value: -30 })
})

it('terminates the engine on unmount', () => {
  const { unmount } = renderHook(() => useComputerOpponent())
  unmount()
  expect(terminate).toHaveBeenCalled()
})

it('reports a failed search', async () => {
  const { result } = renderHook(() => useComputerOpponent())
  const move = result.current.move(START, LEVELS[4], null)
  await waitFor(() => expect(calls).toHaveLength(1))
  await act(async () => calls[0].reject(new Error('boom')))
  await expect(move).resolves.toBeNull()
  expect(result.current.error).toBe('The engine crashed. Please reload the page.')
})
