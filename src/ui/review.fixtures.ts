import type { MoveLabel, ReviewedMove } from '../game/review'

/** A reviewed move with sensible defaults, for component tests. */
export function reviewedMove(overrides: Partial<ReviewedMove> & { ply: number; label: MoveLabel }): ReviewedMove {
  const color = overrides.ply % 2 === 0 ? 'w' : 'b'
  return {
    san: 'e4',
    uci: 'e2e4',
    color,
    fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    loss: 0,
    bestUci: 'e2e4',
    bestSan: 'e4',
    bestScoreWhite: { type: 'cp', value: 30 },
    playedScoreWhite: { type: 'cp', value: 30 },
    ...overrides,
  }
}
