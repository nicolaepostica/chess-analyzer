import type { ReviewedMove } from '../game/review'
import { figurine } from './figurine'
import { hasBadge, LabelBadge } from './LabelBadge'
import { LABEL_META } from './labels'

export type ReviewMoveListProps = {
  moves: ReviewedMove[]
  /** Position index on the board; the move that led to it is highlighted. */
  current: number
  onSelect: (position: number) => void
}

export function ReviewMoveList({ moves, current, onSelect }: ReviewMoveListProps) {
  // Rows pair a White and a Black move; a game may start with Black to move.
  const rows: { number: number; white?: ReviewedMove; black?: ReviewedMove }[] = []
  for (const move of moves) {
    const fullMove = Number(move.fenBefore.split(' ')[5] ?? 1)
    const row = rows.at(-1)
    if (move.color === 'b' && row && row.number === fullMove && !row.black) row.black = move
    else rows.push({ number: fullMove, [move.color === 'w' ? 'white' : 'black']: move })
  }

  const cell = (move: ReviewedMove | undefined) => {
    if (!move) return <span />
    const meta = LABEL_META[move.label]
    const active = current === move.ply + 1
    const badge = hasBadge(move.label)
    const tone = badge ? meta.textClass : active ? 'text-fg' : 'text-fg-secondary'
    return (
      <button
        type="button"
        data-testid="review-move"
        aria-current={active ? 'true' : undefined}
        title={meta.name}
        onClick={() => onSelect(move.ply + 1)}
        className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-white/6 ${tone} ${active ? 'bg-accent/15' : ''}`}
      >
        {badge ? <LabelBadge label={move.label} /> : <span className="size-[18px] shrink-0" />}
        <span>
          {[...figurine(move.san, move.color)].map((char, i) =>
            // Monospace fonts draw chess glyphs tiny; give them a text font and room.
            /[♔-♟]/.test(char) ? (
              <span key={i} className="mx-1 inline-block origin-bottom scale-[1.6] font-sans text-[15px] leading-none">
                {char}
              </span>
            ) : (
              char
            ),
          )}
        </span>
      </button>
    )
  }

  return (
    <ol className="grid max-h-80 grid-cols-[2.5rem_1fr_1fr] gap-x-2 gap-y-0.5 overflow-y-auto font-mono text-[13px]">
      {rows.map((row) => (
        <li key={`${row.number}-${row.white?.ply ?? row.black?.ply}`} className="contents">
          <span className="py-0.5 text-fg-muted">{row.number}.</span>
          {cell(row.white)}
          {cell(row.black)}
        </li>
      ))}
    </ol>
  )
}
