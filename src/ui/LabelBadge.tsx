import type { MoveLabel } from '../game/review'
import { LABEL_META } from './labels'

/** Labels drawn as an icon rather than a text glyph. */
const ICONS: Partial<Record<MoveLabel, string>> = {
  book: 'M2 3.2c1.9-.6 3.9-.4 5.5.7v9c-1.6-1-3.6-1.2-5.5-.6zm12 0c-1.9-.6-3.9-.4-5.5.7v9c1.6-1 3.6-1.2 5.5-.6z',
  // Thumbs up.
  excellent:
    'M1.5 7h2.5v7h-2.5zM5.2 14V7.2l3-5c.3-.5 1-.6 1.4-.2.4.3.5.8.4 1.3L9.3 6.5h4c.9 0 1.5.8 1.3 1.7l-1.2 4.6c-.2.7-.8 1.2-1.5 1.2z',
  // Check mark.
  good: 'M6.3 12.6 2.4 8.7l1.4-1.4 2.5 2.5 5.9-5.9 1.4 1.4z',
}

/** Whether a label gets a badge in the move list: the named ones and Book. */
export const hasBadge = (label: MoveLabel) => LABEL_META[label].glyph !== '' || label === 'book'

export function LabelBadge({ label }: { label: MoveLabel }) {
  const meta = LABEL_META[label]
  return (
    <span
      role="img"
      aria-label={meta.name}
      title={meta.name}
      className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full font-sans text-[10px] leading-none font-bold text-bg"
      style={{ background: meta.fill }}
    >
      {ICONS[label] ? (
        <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
          <path fill="currentColor" d={ICONS[label]} />
        </svg>
      ) : (
        meta.glyph
      )}
    </span>
  )
}
