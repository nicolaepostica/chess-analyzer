import { parseUciLine, type EvalUpdate, type Score, type UciMessage } from './uci'
import type { EngineTransport } from './transport'

export type AnalyzeOptions = {
  depth: number
  multiPV: number
  chess960: boolean
}

/** A search that picks a move to play, optionally at limited strength. */
export type PlayLimits = {
  strength: { limit: boolean; elo?: number; skill?: number }
  go: { nodes?: number; depth?: number; movetime?: number; wtime?: number; btime?: number; winc?: number; binc?: number }
}

/** The engine's move (null if it has none) and its last score, side to move's perspective. */
export type PlayResult = { move: string | null; score: Score | null }

export interface Engine {
  analyze(fen: string, options: AnalyzeOptions): AsyncIterable<EvalUpdate>
  play(fen: string, limits: PlayLimits): Promise<PlayResult>
  stop(): void
  terminate(): void
}

const FULL_STRENGTH: PlayLimits['strength'] = { limit: false, skill: 20 }

/**
 * Strength options go with every search: one engine may play limited moves and
 * then analyse, and a stale UCI_LimitStrength would quietly weaken the analysis.
 */
function strengthCommands(strength: PlayLimits['strength']): string[] {
  return [
    `setoption name UCI_LimitStrength value ${strength.limit}`,
    ...(strength.elo !== undefined ? [`setoption name UCI_Elo value ${strength.elo}`] : []),
    `setoption name Skill Level value ${strength.skill ?? 20}`,
  ]
}

type Subscriber = (message: UciMessage) => void

export function createEngine(transport: EngineTransport): Engine {
  const subscribers = new Set<Subscriber>()

  // A terminated worker will never send `bestmove`, so a suspended analyze()
  // would await it forever and never run its finally block. Terminate releases
  // them explicitly.
  const aborts = new Set<() => void>()

  transport.onLine((line) => {
    const message = parseUciLine(line)
    for (const subscriber of [...subscribers]) subscriber(message)
  })

  transport.send('uci')

  // Searches run strictly one at a time. Each search waits for the previous one
  // to see its bestmove — otherwise the engine replies to the old position.
  let previousSearch: Promise<void> = Promise.resolve()
  let searchActive = false
  // Searches are numbered as they are queued. stop() also cancels every search
  // still waiting in the queue: without this, a search cancelled before it began
  // would later run to completion and hold up the ones behind it.
  let queuedSearches = 0
  let cancelledUpTo = 0

  function stop(): void {
    cancelledUpTo = queuedSearches
    if (searchActive) transport.send('stop')
  }

  /**
   * One search: `setup` commands, then `position`, then `go`. Yields every info
   * update; `onBestmove` receives the engine's move when the search ends.
   */
  async function* search(
    fen: string,
    setup: string[],
    go: string,
    onBestmove?: (move: string | null) => void,
  ): AsyncGenerator<EvalUpdate> {
    const id = ++queuedSearches
    const waitForPrevious = previousSearch
    let releaseThisSearch!: () => void
    previousSearch = new Promise<void>((resolve) => {
      releaseThisSearch = resolve
    })
    await waitForPrevious
    if (id <= cancelledUpTo) {
      onBestmove?.(null)
      releaseThisSearch()
      return
    }

    const queue: EvalUpdate[] = []
    let bestmoveSeen = false
    let wake: (() => void) | null = null

    let resolveBestmove!: () => void
    const bestmove = new Promise<void>((resolve) => {
      resolveBestmove = resolve
    })

    const subscriber: Subscriber = (message) => {
      if (message.kind === 'info') {
        queue.push(message.update)
        wake?.()
      } else if (message.kind === 'bestmove') {
        onBestmove?.(message.move === '(none)' ? null : message.move)
        bestmoveSeen = true
        resolveBestmove()
        wake?.()
      }
    }

    const abort = () => {
      bestmoveSeen = true
      resolveBestmove()
      wake?.()
    }

    aborts.add(abort)
    subscribers.add(subscriber)
    searchActive = true

    for (const command of setup) transport.send(command)
    transport.send(`position fen ${fen}`)
    transport.send(go)

    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!
          continue
        }
        if (bestmoveSeen) return
        await new Promise<void>((resolve) => {
          wake = () => {
            wake = null
            resolve()
          }
        })
      }
    } finally {
      // Reached both on normal completion and when the consumer breaks out of
      // the loop. In the second case the engine is still thinking.
      aborts.delete(abort)
      if (!bestmoveSeen) transport.send('stop')
      await bestmove
      subscribers.delete(subscriber)
      searchActive = false
      releaseThisSearch()
    }
  }

  function analyze(fen: string, options: AnalyzeOptions): AsyncIterable<EvalUpdate> {
    return search(
      fen,
      [
        ...strengthCommands(FULL_STRENGTH),
        `setoption name UCI_Chess960 value ${options.chess960}`,
        `setoption name MultiPV value ${options.multiPV}`,
      ],
      `go depth ${options.depth}`,
    )
  }

  async function play(fen: string, limits: PlayLimits): Promise<PlayResult> {
    const go = Object.entries(limits.go)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key} ${Math.max(0, Math.round(value))}`)
      .join(' ')
    let move: string | null = null
    let score: Score | null = null
    const updates = search(
      fen,
      [
        ...strengthCommands(limits.strength),
        'setoption name UCI_Chess960 value false',
        'setoption name MultiPV value 1',
      ],
      `go ${go}`.trim(),
      (best) => (move = best),
    )
    for await (const update of updates) if (update.multipv === 1) score = update.score
    return { move, score }
  }

  return {
    analyze,
    play,
    stop,
    terminate: () => {
      // Copy first: aborting resumes a generator, which deletes itself from the set.
      for (const abort of [...aborts]) abort()
      subscribers.clear()
      transport.terminate()
    },
  }
}
