// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { createWorkerTransport } from './transport'

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
}

it('forwards worker errors to the callback', () => {
  const fake = new FakeWorker()
  // Plain constructable function: in vitest 4 `new vi.fn(() => fake)` tries to
  // construct the arrow impl, which throws "is not a constructor".
  vi.stubGlobal('Worker', function () {
    return fake
  })
  const onError = vi.fn()

  createWorkerTransport('/engine.js', onError)
  fake.onerror?.(new ErrorEvent('error', { message: 'boom' }))

  expect(onError).toHaveBeenCalledTimes(1)
  vi.unstubAllGlobals()
})

it('forwards only string messages to the line handler', () => {
  const fake = new FakeWorker()
  vi.stubGlobal('Worker', function () {
    return fake
  })
  const lines: string[] = []

  const transport = createWorkerTransport('/engine.js')
  transport.onLine((line) => lines.push(line))

  fake.onmessage?.({ data: 'readyok' } as MessageEvent)
  fake.onmessage?.({ data: { not: 'a string' } } as MessageEvent)

  expect(lines).toEqual(['readyok'])
  vi.unstubAllGlobals()
})

it('resolves engine URLs against the app base', async () => {
  vi.stubGlobal('crossOriginIsolated', false)
  const { selectEngineUrl } = await import('./transport')
  const url = selectEngineUrl()
  expect(url.startsWith(import.meta.env.BASE_URL)).toBe(true)
  expect(url.endsWith('stockfish/stockfish-18-lite-single.js')).toBe(true)
  vi.unstubAllGlobals()
})

it('does not hard-code the site root', async () => {
  const source = await import('./transport?raw')
  expect(source.default).not.toMatch(/'\/stockfish\//)
})
