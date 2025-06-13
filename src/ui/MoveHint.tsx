import type { ReviewedMove } from '../game/review'
import { SECONDARY_BUTTON } from './buttonStyles'
import { formatScore } from './EvalBar'
import { LABEL_META } from './labels'

export type MoveHintProps = {
  /** The move that led to the position on the board; null at the start. */
  move: ReviewedMove | null
  onAnalyze: (fen: string) => void
}

export function MoveHint({ move, onAnalyze }: MoveHintProps) {
  if (!move) return <p className="text-sm text-fg-secondary">Start of the game. Use ← and → to step through it.</p>

  const meta = LABEL_META[move.label]
  const missedBetter = move.bestUci !== null && move.bestUci !== move.uci && move.bestSan !== null

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className={meta.textClass}>
        <span className="font-mono">
          {move.san}
          {meta.glyph}
        </span>{' '}
        {meta.name}
      </p>
      {missedBetter && (
        <p className="text-fg-secondary">
          Best was {move.bestSan}
          {move.bestScoreWhite && ` (${formatScore(move.bestScoreWhite)})`}
          {move.playedScoreWhite && `; after ${move.san} ${formatScore(move.playedScoreWhite)}`}
        </p>
      )}
      <button type="button" className={`self-start ${SECONDARY_BUTTON}`} onClick={() => onAnalyze(move.fenBefore)}>
        Analyze position
      </button>
    </div>
  )
}
