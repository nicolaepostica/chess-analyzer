import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createEngine, type Engine, type PlayLimits } from '../engine/engine'
import { createWorkerTransport, isMultiThreaded } from '../engine/transport'
import type { Score } from '../engine/uci'
import type { Level } from '../game/levels'

/** Both sides' remaining time and increment in ms; null for an untimed game. */
export type ClockInfo = { wtime: number; btime: number; winc: number; binc: number } | null

export type Opponent = {
  /** The computer's move in this position; null if cancelled or it has none. */
  move(fen: string, level: Level, clock: ClockInfo): Promise<string | null>
  /** The best move at full strength, for the user's hint. */
  hint(fen: string): Promise<string | null>
  /** Stops the current search; its result then resolves to null. */
  cancel(): void
  /** Forgets the last evaluation (new game, take back). */
  resetScore(): void
  /** The computer's evaluation after its latest move search, from White's side. */
  lastScoreWhite: Score | null
  multiThreaded: boolean
  error: string | null
}

const CRASHED = 'The engine crashed. Please reload the page.'
const UNTIMED_MOVE_MS = 1000
// With UCI_LimitStrength on, Stockfish's own time management spends several times
// more of the clock than at full strength (measured: 28 s vs 5 s for one 3+2 move),
// so limited levels get a budget from their remaining time instead.
const LIMITED_MOVE_MS = { min: 200, max: 3000 }
const MOVES_TO_GO = 30

function limitedBudget(fen: string, clock: NonNullable<ClockInfo>): number {
  const black = fen.split(' ')[1] === 'b'
  const remaining = black ? clock.btime : clock.wtime
  const increment = black ? clock.binc : clock.winc
  const budget = Math.min(LIMITED_MOVE_MS.max, Math.max(LIMITED_MOVE_MS.min, Math.round(remaining / MOVES_TO_GO + increment)))
  // Never think past the flag: the increment only arrives after the move.
  return Math.min(budget, Math.round(remaining * 0.8))
}
const HINT: PlayLimits = { strength: { limit: false, skill: 20 }, go: { depth: 14 } }

const toWhite = (score: Score, fen: string): Score =>
  fen.split(' ')[1] === 'b' ? { type: score.type, value: -score.value } : score

/** Owns the Stockfish worker the user plays against. */
export function useComputerOpponent(): Opponent {
  const engineRef = useRef<Engine | null>(null)
  // Every search and every cancel bumps this; a result whose number is stale is dropped.
  const generation = useRef(0)
  const [lastScoreWhite, setLastScoreWhite] = useState<Score | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    engineRef.current = createEngine(createWorkerTransport(undefined, () => alive && setError(CRASHED)))
    return () => {
      alive = false
      generation.current += 1
      engineRef.current?.terminate()
      engineRef.current = null
    }
  }, [])

  const run = useCallback(async (fen: string, limits: PlayLimits, track: boolean) => {
    const engine = engineRef.current
    if (!engine) return null
    const id = ++generation.current
    // A hint may still be running; the computer must not wait behind it.
    engine.stop()
    try {
      const result = await engine.play(fen, limits)
      if (id !== generation.current) return null
      if (track && result.score) setLastScoreWhite(toWhite(result.score, fen))
      return result.move
    } catch {
      if (id === generation.current) setError(CRASHED)
      return null
    }
  }, [])

  const move = useCallback(
    (fen: string, level: Level, clock: ClockInfo) => {
      const go =
        level.nodes !== undefined
          ? { nodes: level.nodes }
          : !clock
            ? { movetime: UNTIMED_MOVE_MS }
            : level.strength.limit
              ? { movetime: limitedBudget(fen, clock) }
              : clock
      return run(fen, { strength: level.strength, go }, true)
    },
    [run],
  )
  const hint = useCallback((fen: string) => run(fen, HINT, false), [run])
  const cancel = useCallback(() => {
    generation.current += 1
    engineRef.current?.stop()
  }, [])

  const resetScore = useCallback(() => setLastScoreWhite(null), [])

  return useMemo(
    () => ({ move, hint, cancel, resetScore, lastScoreWhite, multiThreaded: isMultiThreaded(), error }),
    [move, hint, cancel, resetScore, lastScoreWhite, error],
  )
}
