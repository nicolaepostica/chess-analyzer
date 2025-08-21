import type { Outcome } from '../game/outcome'
import { SECONDARY_BUTTON } from './buttonStyles'

export type GameOverCardProps = { outcome: Outcome; onReview: () => void; onNewGame: () => void }

const PRIMARY = 'rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg hover:bg-accent/85'

export function GameOverCard({ outcome, onReview, onNewGame }: GameOverCardProps) {
  const result = outcome.result === '1/2-1/2' ? '½-½' : outcome.result
  const reason = outcome.reason[0].toUpperCase() + outcome.reason.slice(1)
  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="font-display text-xl text-fg">
        {result} · {reason}
      </p>
      <div className="flex gap-2">
        <button type="button" className={PRIMARY} onClick={onReview}>
          Review this game
        </button>
        <button type="button" className={SECONDARY_BUTTON} onClick={onNewGame}>
          New game
        </button>
      </div>
    </div>
  )
}
