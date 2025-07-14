import type { MoveLabel } from '../game/review'
import { LABEL_META } from './labels'

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
      {label === 'book' ? (
        <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
          <path
            fill="currentColor"
            d="M2 3.2c1.9-.6 3.9-.4 5.5.7v9c-1.6-1-3.6-1.2-5.5-.6zm12 0c-1.9-.6-3.9-.4-5.5.7v9c1.6-1 3.6-1.2 5.5-.6z"
          />
        </svg>
      ) : (
        meta.glyph
      )}
    </span>
  )
}
