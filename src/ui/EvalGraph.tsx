import type { MouseEvent } from 'react'
import type { ReviewedMove } from '../game/review'
import { LABEL_META, NOTABLE } from './labels'

export type EvalGraphProps = {
  /** White's win% per evaluated position, from the start. */
  whiteWins: number[]
  /** Positions in the whole game, so the line grows left to right while reviewing. */
  total: number
  moves: ReviewedMove[]
  /** Position index on the board. */
  current: number
  onSelect: (position: number) => void
}

const WIDTH = 1000
const HEIGHT = 100

export function EvalGraph({ whiteWins, total, moves, current, onSelect }: EvalGraphProps) {
  const last = Math.max(1, total - 1)
  const x = (position: number) => (position / last) * WIDTH
  const y = (win: number) => HEIGHT - win
  const points = whiteWins.map((win, i) => `${x(i)},${y(win)}`).join(' ')
  // The area under the line is White's share, as on the eval bar.
  const area = whiteWins.length > 0 ? `0,${HEIGHT} ${points} ${x(whiteWins.length - 1)},${HEIGHT}` : ''

  const select = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    onSelect(Math.round(fraction * last))
  }

  return (
    <div data-testid="eval-graph" className="relative h-24 w-full overflow-hidden rounded-lg border border-border bg-well">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-full w-full cursor-pointer"
        onClick={select}
        aria-label="Evaluation graph"
        role="img"
      >
        {area && <polygon points={area} className="fill-fg/85" />}
        <line x1={0} x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} className="stroke-fg-muted/40" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {points && <polyline points={points} fill="none" className="stroke-fg" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
        <line x1={x(current)} x2={x(current)} y1={0} y2={HEIGHT} className="stroke-accent" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Markers are HTML so they stay round while the SVG stretches. */}
      {moves
        .filter((move) => NOTABLE.has(move.label) && whiteWins[move.ply + 1] !== undefined)
        .map((move) => (
          <span
            key={move.ply}
            data-testid="graph-marker"
            title={`${move.san}: ${LABEL_META[move.label].name}`}
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bg"
            style={{
              left: `${(x(move.ply + 1) / WIDTH) * 100}%`,
              top: `${y(whiteWins[move.ply + 1])}%`,
              background: LABEL_META[move.label].fill,
            }}
          />
        ))}
    </div>
  )
}
