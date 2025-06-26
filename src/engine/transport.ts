export interface EngineTransport {
  send(command: string): void
  onLine(handler: (line: string) => void): void
  terminate(): void
}

// Relative to the app base so the build also works under /chess-analyzer/ on Pages.
const MULTI_THREADED = `${import.meta.env.BASE_URL}stockfish/stockfish-18-lite.js`
const SINGLE_THREADED = `${import.meta.env.BASE_URL}stockfish/stockfish-18-lite-single.js`

/**
 * The multi-threaded build requires SharedArrayBuffer, which is only available
 * in a cross-origin isolated context (COOP/COEP headers).
 */
export function selectEngineUrl(): string {
  return globalThis.crossOriginIsolated ? MULTI_THREADED : SINGLE_THREADED
}

export function isMultiThreaded(): boolean {
  return selectEngineUrl() === MULTI_THREADED
}

export function createWorkerTransport(
  scriptUrl: string = selectEngineUrl(),
  onError?: (error: unknown) => void,
): EngineTransport {
  const worker = new Worker(scriptUrl)
  let handler: (line: string) => void = () => {}

  worker.onmessage = (event: MessageEvent) => {
    if (typeof event.data === 'string') handler(event.data)
  }
  worker.onerror = (event) => onError?.(event)

  return {
    send: (command) => worker.postMessage(command),
    onLine: (next) => {
      handler = next
    },
    terminate: () => worker.terminate(),
  }
}
