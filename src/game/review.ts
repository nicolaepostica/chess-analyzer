import { Chess } from 'chess.js'
import type { GameRecord, RecordedMove } from './record'

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

export type MoveLabel =
  | 'book'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'miss'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'

export type ReviewedMove = RecordedMove & {
  /** 0-based index into record.moves. */
  ply: number
  label: MoveLabel
  /** Win% points the mover gave up against the engine's best, ≥ 0. */
  loss: number
  bestUci: string | null
  bestSan: string | null
  /** The engine's best in fenBefore, White's perspective. */
  bestScoreWhite: EngineScore | null
  /** The evaluation of fenAfter, White's perspective; null when the game is over there. */
  playedScoreWhite: EngineScore | null
}

export type ReviewResult = {
  /** Only plies whose two positions are evaluated, in order. */
  moves: ReviewedMove[]
  /** White's win% in each evaluated position, from the start. */
  whiteWins: number[]
  /** Null until every position is evaluated. */
  accuracy: { white: number; black: number } | null
}

export const THRESHOLDS = {
  excellent: 2,
  good: 5,
  inaccuracy: 10,
  mistake: 20,
  greatGap: 10,
  brilliantMaxWinBefore: 90,
  sacrificeMin: 2,
  sacrificePlies: 4,
  missMinWinBefore: 70,
} as const

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/** Material of `side` minus material of the opponent, from the FEN placement. */
function materialBalance(fen: string, side: 'w' | 'b'): number {
  let balance = 0
  for (const char of fen.split(' ')[0]) {
    const value = PIECE_VALUES[char.toLowerCase()]
    if (value === undefined) continue
    const owner = char === char.toUpperCase() ? 'w' : 'b'
    balance += owner === side ? value : -value
  }
  return balance
}

/** Plays UCI moves from `fen`, stopping at the first illegal one; returns the FEN after each. */
function walk(fen: string, pv: string[]): string[] {
  const game = new Chess(fen)
  const fens: string[] = []
  for (const uci of pv) {
    try {
      game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    } catch {
      break
    }
    fens.push(game.fen())
  }
  return fens
}

/**
 * The material the mover keeps along a line that starts with the opponent to
 * move: the best of the positions after the mover's own answers (plies 2, 4, …),
 * so a trade the opponent starts and the mover completes nets out. If the line
 * is shorter, the position after the opponent's reply counts. Null when the
 * line is empty.
 */
function keptMaterial(fen: string, pv: string[], side: 'w' | 'b'): number | null {
  const fens = walk(fen, pv.slice(0, THRESHOLDS.sacrificePlies))
  const answers = fens.filter((_, i) => i % 2 === 1)
  const counted = answers.length > 0 ? answers : fens.slice(0, 1)
  if (counted.length === 0) return null
  return Math.max(...counted.map((position) => materialBalance(position, side)))
}

/**
 * A sacrifice gives up material by choice: along the engine's expected reply the
 * mover stays at least `sacrificeMin` down, while the engine's alternative move
 * would have kept that material. Without an alternative (a forced move, or a
 * fork where every move loses the same piece) nothing was sacrificed.
 */
function isSacrifice(move: RecordedMove, replyPv: string[], alternative: EngineLine | undefined): boolean {
  if (!alternative) return false
  const before = materialBalance(move.fenBefore, move.color)
  const played = keptMaterial(move.fenAfter, replyPv, move.color)
  if (played === null || before - played < THRESHOLDS.sacrificeMin) return false

  const [afterAlternative] = walk(move.fenBefore, alternative.pv.slice(0, 1))
  if (!afterAlternative) return false
  const kept = keptMaterial(afterAlternative, alternative.pv.slice(1), move.color) ?? materialBalance(afterAlternative, move.color)
  return kept - played >= THRESHOLDS.sacrificeMin
}

const sideToMove = (fen: string): 'w' | 'b' => (fen.split(' ')[1] === 'b' ? 'b' : 'w')

/** Side-to-move win% of a position; a finished game is scored from its result. */
function positionWin(fen: string, evaluation: PositionEval): number {
  const best = evaluation.lines[0]
  if (best) return winPercent(best.score)
  const game = new Chess(fen)
  if (game.isCheckmate()) return 0
  return 50
}

const toWhite = (score: EngineScore, fen: string): EngineScore =>
  sideToMove(fen) === 'b' ? { type: score.type, value: -score.value } : score

function uciToSan(fen: string, uci: string): string | null {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
  } catch {
    return null
  }
}

function lossLabel(loss: number): MoveLabel {
  if (loss < THRESHOLDS.excellent) return 'excellent'
  if (loss < THRESHOLDS.good) return 'good'
  if (loss < THRESHOLDS.inaccuracy) return 'inaccuracy'
  if (loss < THRESHOLDS.mistake) return 'mistake'
  return 'blunder'
}

/**
 * Labels every move whose before and after positions are evaluated.
 * `evals[i]` belongs to `record.positions[i]` and may be shorter while a review
 * is still running.
 */
export function reviewGame(
  record: GameRecord,
  evals: PositionEval[],
  isBook: (fen: string) => boolean,
): ReviewResult {
  const evaluated = Math.min(evals.length, record.positions.length)
  const whiteWins = record.positions.slice(0, evaluated).map((fen, i) => {
    const win = positionWin(fen, evals[i])
    return sideToMove(fen) === 'w' ? win : 100 - win
  })

  const moves: ReviewedMove[] = []
  const bookFlags: boolean[] = []
  let inBook = true

  for (let ply = 0; ply + 1 < evaluated; ply += 1) {
    const move = record.moves[ply]
    const before = evals[ply]
    const after = evals[ply + 1]
    const best = before.lines[0] ?? null

    const winBefore = positionWin(move.fenBefore, before)
    const winAfter = 100 - positionWin(move.fenAfter, after)
    const loss = Math.max(0, winBefore - winAfter)
    const isBest = best !== null && best.pv[0] === move.uci

    inBook = inBook && isBook(move.fenAfter)
    const second = before.lines[1]
    const previous = moves[ply - 1]?.label

    let label: MoveLabel
    if (inBook) label = 'book'
    else if (
      loss < THRESHOLDS.excellent &&
      winBefore < THRESHOLDS.brilliantMaxWinBefore &&
      isSacrifice(
        move,
        after.lines[0]?.pv ?? [],
        before.lines.find((line) => line.pv[0] !== move.uci),
      )
    )
      label = 'brilliant'
    else if (isBest && second && winPercent(best.score) - winPercent(second.score) >= THRESHOLDS.greatGap)
      label = 'great'
    else if (isBest) label = 'best'
    else if (loss < THRESHOLDS.good) label = lossLabel(loss)
    else if (
      (previous === 'mistake' || previous === 'blunder') &&
      winBefore >= THRESHOLDS.missMinWinBefore &&
      loss >= THRESHOLDS.inaccuracy
    )
      label = 'miss'
    else label = lossLabel(loss)

    bookFlags.push(inBook)
    moves.push({
      ...move,
      ply,
      label,
      loss,
      bestUci: best?.pv[0] ?? null,
      bestSan: best ? uciToSan(move.fenBefore, best.pv[0]) : null,
      bestScoreWhite: best ? toWhite(best.score, move.fenBefore) : null,
      playedScoreWhite: after.lines[0] ? toWhite(after.lines[0].score, move.fenAfter) : null,
    })
  }

  const complete = evaluated === record.positions.length && evaluated > 0
  return {
    moves,
    whiteWins,
    accuracy: complete ? gameAccuracy(whiteWins, bookFlags, sideToMove(record.startFen)) : null,
  }
}
