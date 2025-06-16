import type { MoveLabel } from '../game/review'

export type LabelMeta = {
  name: string
  glyph: string
  /** Tailwind text colour class. */
  textClass: string
  /** CSS colour for SVG and inline styles. */
  fill: string
}

export const LABEL_META: Record<MoveLabel, LabelMeta> = {
  brilliant: { name: 'Brilliant', glyph: '!!', textClass: 'text-label-brilliant', fill: 'var(--color-label-brilliant)' },
  great: { name: 'Great move', glyph: '!', textClass: 'text-label-great', fill: 'var(--color-label-great)' },
  best: { name: 'Best move', glyph: '★', textClass: 'text-label-best', fill: 'var(--color-label-best)' },
  excellent: { name: 'Excellent', glyph: '', textClass: 'text-label-best', fill: 'var(--color-label-best)' },
  good: { name: 'Good', glyph: '', textClass: 'text-fg-secondary', fill: 'var(--color-fg-secondary)' },
  book: { name: 'Book', glyph: '', textClass: 'text-label-book', fill: 'var(--color-label-book)' },
  inaccuracy: { name: 'Inaccuracy', glyph: '?!', textClass: 'text-label-inaccuracy', fill: 'var(--color-label-inaccuracy)' },
  mistake: { name: 'Mistake', glyph: '?', textClass: 'text-label-mistake', fill: 'var(--color-label-mistake)' },
  miss: { name: 'Miss', glyph: '×', textClass: 'text-label-miss', fill: 'var(--color-label-miss)' },
  blunder: { name: 'Blunder', glyph: '??', textClass: 'text-label-blunder', fill: 'var(--color-label-blunder)' },
}

/** Display order, best first. */
export const LABEL_ORDER: MoveLabel[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
]

/** Labels worth a marker on the evaluation graph. */
export const NOTABLE: ReadonlySet<MoveLabel> = new Set(['brilliant', 'mistake', 'miss', 'blunder'])
