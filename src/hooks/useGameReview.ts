import { useEffect, useState } from 'react'
import { analyzeAll, REVIEW_OPTIONS } from '../engine/batch'
import { createEngine } from '../engine/engine'
import { createWorkerTransport, isMultiThreaded } from '../engine/transport'
import { isBookPosition } from '../game/book'
import type { GameRecord } from '../game/record'
import { reviewGame, type PositionEval, type ReviewResult } from '../game/review'

export type GameReviewState = {
  result: ReviewResult
  /** Positions evaluated so far. */
  evaluated: number
  /** Positions in the game, start included. */
  total: number
  done: boolean
  multiThreaded: boolean
  error: string | null
}

const EMPTY: ReviewResult = { moves: [], whiteWins: [], accuracy: null }
const CRASHED = 'The engine crashed. Please reload the page.'
const noBook = () => false

/**
 * Runs the engine over every position of a game and classifies the moves as it
 * goes. The review restarts whenever `record` changes identity, so callers must
 * memoise it.
 */
export function useGameReview(record: GameRecord | null): GameReviewState {
  const [result, setResult] = useState<ReviewResult>(EMPTY)
  const [evaluated, setEvaluated] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setResult(EMPTY)
    setEvaluated(0)
    setError(null)
    if (!record) return

    let cancelled = false
    const fail = () => {
      if (!cancelled) setError(CRASHED)
    }
    const engine = createEngine(createWorkerTransport(undefined, fail))
    // The book only describes games from the standard start.
    const isBook = record.customStart ? noBook : isBookPosition
    const evals: PositionEval[] = []

    analyzeAll(
      engine,
      record.positions,
      REVIEW_OPTIONS,
      (index, lines) => {
        if (cancelled) return
        evals[index] = { lines }
        setResult(reviewGame(record, evals, isBook))
        setEvaluated(index + 1)
      },
      () => cancelled,
    ).catch(fail)

    return () => {
      cancelled = true
      engine.terminate()
    }
  }, [record])

  const total = record?.positions.length ?? 0
  return {
    result,
    evaluated,
    total,
    done: total > 0 && evaluated === total,
    multiThreaded: isMultiThreaded(),
    error,
  }
}
