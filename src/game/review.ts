// game/ may not import engine/, so these mirror engine's Score and EvalUpdate
// structurally. An engine value can be passed here as is.
export type EngineScore = { type: 'cp' | 'mate'; value: number }
export type EngineLine = { score: EngineScore; pv: string[] }
/** Engine lines for one position, side-to-move perspective, best first. Empty when the game is over there. */
export type PositionEval = { lines: EngineLine[] }

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** The lichess win-probability curve, side-to-move perspective, 0..100. */
export function winPercent(score: EngineScore): number {
  if (score.type === 'mate') return score.value > 0 ? 100 : 0
  const cp = clamp(score.value, -1000, 1000)
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

/** lichess per-move accuracy from the mover's win% before and after the move. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (winBefore - winAfter)) - 3.166924740191411
  // +1 is lichess's allowance for imperfect analysis.
  return clamp(raw + 1, 0, 100)
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

function stdDev(values: number[]): number {
  const average = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)))
}

/**
 * lichess game accuracy: per-move accuracies, weighted by how volatile the game
 * was around each move, averaged with their harmonic mean.
 *
 * @param whiteWins White's win% in every position, start included.
 * @param moverIsBook For each move, whether it was a book move (excluded).
 * @param firstMover The side to move in the first position.
 */
export function gameAccuracy(
  whiteWins: number[],
  moverIsBook: boolean[],
  firstMover: 'w' | 'b' = 'w',
): { white: number; black: number } {
  const size = clamp(Math.round(whiteWins.length / 10), 2, 8)
  const windows: number[][] = []
  for (let i = 0; i < Math.min(size, whiteWins.length) - 2; i += 1) windows.push(whiteWins.slice(0, size))
  for (let i = 0; i + size <= whiteWins.length; i += 1) windows.push(whiteWins.slice(i, i + size))
  const weights = windows.map((window) => clamp(stdDev(window), 0.5, 12))

  const perSide = { w: [] as { accuracy: number; weight: number }[], b: [] as { accuracy: number; weight: number }[] }
  for (let i = 0; i + 1 < whiteWins.length; i += 1) {
    if (moverIsBook[i]) continue
    const mover = (i % 2 === 0) === (firstMover === 'w') ? 'w' : 'b'
    const before = mover === 'w' ? whiteWins[i] : 100 - whiteWins[i]
    const after = mover === 'w' ? whiteWins[i + 1] : 100 - whiteWins[i + 1]
    perSide[mover].push({ accuracy: moveAccuracy(before, after), weight: weights[i] ?? 0.5 })
  }

  const aggregate = (moves: { accuracy: number; weight: number }[]) => {
    if (moves.length === 0) return 100
    const totalWeight = moves.reduce((sum, move) => sum + move.weight, 0)
    const weighted = moves.reduce((sum, move) => sum + move.accuracy * move.weight, 0) / totalWeight
    const harmonic = moves.length / moves.reduce((sum, move) => sum + 1 / Math.max(1, move.accuracy), 0)
    return (weighted + harmonic) / 2
  }

  return { white: aggregate(perSide.w), black: aggregate(perSide.b) }
}
