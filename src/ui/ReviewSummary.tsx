import type { ReviewedMove } from '../game/review'
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
      <table className="w-full text-sm">
        <tbody>
          {LABEL_ORDER.map((label) => {
            const meta = LABEL_META[label]
            return (
              <tr key={label}>
                <td data-testid={`count-${label}-white`} className="w-8 text-left font-mono text-fg">
                  {count(label, 'w')}
                </td>
                <td className={`text-center ${meta.textClass}`}>
                  {meta.glyph && <span className="mr-1 font-mono">{meta.glyph}</span>}
                  {meta.name}
                </td>
                <td data-testid={`count-${label}-black`} className="w-8 text-right font-mono text-fg">
                  {count(label, 'b')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
