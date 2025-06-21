import { describe, expect, it } from 'vitest'
import { parseGameRecord, type GameRecord } from './record'
import { reviewGame, type EngineLine, type PositionEval } from './review'

function record(pgn: string): GameRecord {
  const result = parseGameRecord(pgn)
  if (!result.ok) throw new Error(result.message)
  return result.record
}

const fromFen = (fen: string, moves: string) => record(`[SetUp "1"]\n[FEN "${fen}"]\n\n${moves} *`)

/** Inverse of the lichess curve: the centipawn score that gives this win%. */
const cpForWin = (win: number) => -Math.log(100 / win - 1) / 0.00368208

const cp = (value: number, pv: string[] = ['a2a3']): EngineLine => ({ score: { type: 'cp', value }, pv })
const at = (...lines: EngineLine[]): PositionEval => ({ lines })
const noBook = () => false

describe('loss bands', () => {
  // White's best keeps 50%; the played move e4 leaves White with 50 - loss.
  const labelFor = (loss: number) => {
    const game = record('1. e4 *')
    const evals = [at(cp(0, ['d2d4'])), at(cp(-cpForWin(50 - loss), ['e7e5']))]
    return reviewGame(game, evals, noBook).moves[0]
  }

  it.each([
    [1.5, 'excellent'],
    [4, 'good'],
    [9, 'inaccuracy'],
    [19, 'mistake'],
    [25, 'blunder'],
  ])('loss %s is %s', (loss, label) => {
    const move = labelFor(loss)
    expect(move.label).toBe(label)
    expect(move.loss).toBeCloseTo(loss, 5)
  })
})

describe('best and great', () => {
  const game = record('1. e4 *')
  const after = at(cp(-30, ['e7e5']))

  it("labels the engine's top move Best even at zero loss", () => {
    const move = reviewGame(game, [at(cp(30, ['e2e4']), cp(20, ['d2d4'])), after], noBook).moves[0]
    expect(move.label).toBe('best')
    expect(move.loss).toBe(0)
  })

  it('labels the only good move Great', () => {
    const evals = [at(cp(cpForWin(50), ['e2e4']), cp(cpForWin(38), ['d2d4'])), at(cp(0, ['e7e5']))]
    expect(reviewGame(game, evals, noBook).moves[0].label).toBe('great')
  })

  it('keeps Best when the alternative is close', () => {
    const evals = [at(cp(cpForWin(50), ['e2e4']), cp(cpForWin(45), ['d2d4'])), at(cp(0, ['e7e5']))]
    expect(reviewGame(game, evals, noBook).moves[0].label).toBe('best')
  })

  it('keeps Best for a forced move with a single line', () => {
    expect(reviewGame(game, [at(cp(0, ['e2e4'])), at(cp(0, ['e7e5']))], noBook).moves[0].label).toBe('best')
  })
})

describe('brilliant', () => {
  // Rook takes a pawn-defended knight: an exchange sacrifice.
  const sacrifice = fromFen('6k1/8/2p5/3n4/8/8/8/3R2K1 w - - 0 1', '1. Rxd5')

  it('labels a sound sacrifice in a non-winning position Brilliant', () => {
    const evals = [at(cp(50, ['d1d5'])), at(cp(-50, ['c6d5', 'g1f2']))]
    expect(reviewGame(sacrifice, evals, noBook).moves[0].label).toBe('brilliant')
  })

  it('does not call a sacrifice Brilliant when already winning', () => {
    const winning = cpForWin(95)
    const evals = [at(cp(winning, ['d1d5'])), at(cp(-winning, ['c6d5', 'g1f2']))]
    expect(reviewGame(sacrifice, evals, noBook).moves[0].label).toBe('best')
  })

  it('does not call a quiet move Brilliant when the opponent merely trades', () => {
    // After a3 the engine expects Nxd4 Qxd4: material dips, then comes straight back.
    const quiet = fromFen('4k3/8/4n3/8/3N4/8/P7/3QK3 w - - 0 1', '1. a3')
    const evals = [at(cp(50, ['a2a3'])), at(cp(-50, ['e6d4', 'd1d4']))]
    expect(reviewGame(quiet, evals, noBook).moves[0].label).toBe('best')
  })

  it('does not call an even trade Brilliant', () => {
    const trade = fromFen('6k1/8/2p5/3n4/8/4N3/8/6K1 w - - 0 1', '1. Nxd5')
    const evals = [at(cp(50, ['e3d5'])), at(cp(-50, ['c6d5', 'g1f2']))]
    expect(reviewGame(trade, evals, noBook).moves[0].label).toBe('best')
  })
})

describe('miss', () => {
  const game = record('1. e4 e5 *')

  it('labels failing to punish a blunder a Miss', () => {
    // White blunders 50 → 25; Black, at 75, gives back 12.
    const evals = [
      at(cp(0, ['d2d4'])),
      at(cp(cpForWin(75), ['d7d5'])),
      at(cp(cpForWin(37), ['g1f3'])),
    ]
    const moves = reviewGame(game, evals, noBook).moves
    expect(moves[0].label).toBe('blunder')
    expect(moves[1].label).toBe('miss')
  })

  it('keeps Mistake when the position was not winning', () => {
    // White 50 → 38 (mistake); Black, at 62, gives back 12.
    const evals = [
      at(cp(0, ['d2d4'])),
      at(cp(cpForWin(62), ['d7d5'])),
      at(cp(cpForWin(50), ['g1f3'])),
    ]
    const moves = reviewGame(game, evals, noBook).moves
    expect(moves[0].label).toBe('mistake')
    expect(moves[1].label).toBe('mistake')
  })
})

describe('book', () => {
  it('labels book moves Book until the first non-book move', () => {
    const game = record('1. e4 e5 2. Nf3 Nc6 *')
    const inBook = new Set([game.positions[1], game.positions[2], game.positions[4]])
    const evals = [
      at(cp(0, ['d2d4'])),
      at(cp(cpForWin(75), ['e7e5'])), // White's e4 "loses" 25: still Book
      at(cp(cpForWin(25), ['g1f3'])),
      at(cp(cpForWin(75), ['b8c6'])),
      at(cp(cpForWin(25), ['f1b5'])),
    ]
    const labels = reviewGame(game, evals, (fen) => inBook.has(fen)).moves.map((move) => move.label)
    expect(labels[0]).toBe('book')
    expect(labels[1]).toBe('book')
    expect(labels[2]).not.toBe('book')
    expect(labels[3]).not.toBe('book')
  })
})

describe('terminal positions', () => {
  it('classifies a mating move as Best when the final position has no lines', () => {
    const game = fromFen('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', '1. Ra8#')
    const result = reviewGame(game, [at({ score: { type: 'mate', value: 1 }, pv: ['a1a8'] }), at()], noBook)
    expect(result.moves[0].label).toBe('best')
    expect(result.moves[0].bestSan).toBe('Ra8#')
    expect(result.whiteWins).toEqual([100, 100])
  })

  it('scores a stalemate as a draw', () => {
    const game = fromFen('7k/8/8/8/8/8/8/K5Q1 w - - 0 1', '1. Qg6')
    const result = reviewGame(game, [at(cp(900, ['g1g7'])), at()], noBook)
    expect(result.whiteWins[1]).toBe(50)
    expect(result.moves[0].label).toBe('blunder')
  })
})

describe('partial evaluation', () => {
  const game = record('1. e4 e5 2. Nf3 *')
  const evals = [at(cp(30, ['e2e4'])), at(cp(50, ['e7e5'])), at(cp(20, ['g1f3'])), at(cp(-25, ['b8c6']))]

  it('returns only completed plies while evals are partial', () => {
    const result = reviewGame(game, evals.slice(0, 2), noBook)
    expect(result.moves).toHaveLength(1)
    expect(result.whiteWins).toHaveLength(2)
    expect(result.accuracy).toBeNull()
  })

  it('computes accuracy once every position is evaluated', () => {
    const result = reviewGame(game, evals, noBook)
    expect(result.moves).toHaveLength(3)
    expect(result.accuracy).not.toBeNull()
  })

  it("reports the engine's best in White's perspective", () => {
    const move = reviewGame(game, evals, noBook).moves[1]
    expect(move.bestScoreWhite).toEqual({ type: 'cp', value: -50 })
    expect(move.playedScoreWhite).toEqual({ type: 'cp', value: 20 })
    expect(move.bestSan).toBe('e5')
  })
})
