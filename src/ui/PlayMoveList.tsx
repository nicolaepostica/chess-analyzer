import { SanText } from './SanText'

export type PlayMoveListProps = { sans: string[]; firstColor: 'w' | 'b' }

export function PlayMoveList({ sans, firstColor }: PlayMoveListProps) {
  // Pair moves into numbered rows; if Black moved first, its move opens row 1 alone.
  const offset = firstColor === 'b' ? 1 : 0
  const rows: (string | undefined)[][] = []
  sans.forEach((san, i) => {
    const slot = i + offset
    rows[Math.floor(slot / 2)] ??= [undefined, undefined]
    rows[Math.floor(slot / 2)][slot % 2] = san
  })

  return (
    <ol className="grid max-h-[28rem] grid-cols-[2.5rem_1fr_1fr] gap-x-2 gap-y-0.5 overflow-y-auto font-mono text-[13px] text-fg-secondary">
      {rows.map((row, r) => (
        <li key={r} className="contents">
          <span className="py-0.5 text-fg-muted">{r + 1}.</span>
          {row.map((san, c) =>
            san ? (
              <span key={c} data-testid="play-move" className="py-0.5">
                <SanText san={san} color={c === 0 ? 'w' : 'b'} />
              </span>
            ) : (
              <span key={c} />
            ),
          )}
        </li>
      ))}
    </ol>
  )
}
