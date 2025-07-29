import type { ReviewedMove } from '../game/review'
import { Fragment } from 'react'
import { hasBadge, LabelBadge } from './LabelBadge'
import { LABEL_META, LABEL_ORDER } from './labels'

export type ReviewSummaryProps = {
  moves: ReviewedMove[]
  accuracy: { white: number; black: number } | null
  whiteName: string
  blackName: string
}

export function ReviewSummary({ moves, accuracy, whiteName, blackName }: ReviewSummaryProps) {
  const count = (label: string, color: 'w' | 'b') =>
    moves.filter((move) => move.label === label && move.color === color).length

  const player = (name: string, value: number | undefined, testId: string, align: string) => (
    <div className={align}>
      <div className="text-xs text-fg-secondary">{name}</div>
      <div data-testid={testId} className="font-display text-3xl font-medium text-fg">
        {value === undefined ? '…' : value.toFixed(1)}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between">
        {player(whiteName, accuracy?.white, 'accuracy-white', 'text-left')}
        {player(blackName, accuracy?.black, 'accuracy-black', 'text-right')}
      </div>
      <div className="grid grid-cols-[1fr_2.5rem_2.25rem_2.5rem] items-center gap-x-1 gap-y-1.5 text-sm">
        {LABEL_ORDER.map((label) => {
          const meta = LABEL_META[label]
          const tone = label === 'good' ? 'text-fg-secondary' : meta.textClass
          return (
            <Fragment key={label}>
              <span className="text-fg-secondary">{meta.name}</span>
              <span data-testid={`count-${label}-white`} className={`text-right font-mono font-semibold ${tone}`}>
                {count(label, 'w')}
              </span>
              <span className="flex justify-center">{hasBadge(label) && <LabelBadge label={label} />}</span>
              <span data-testid={`count-${label}-black`} className={`font-mono font-semibold ${tone}`}>
                {count(label, 'b')}
              </span>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
