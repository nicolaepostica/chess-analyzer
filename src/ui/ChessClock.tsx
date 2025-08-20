export type ChessClockProps = { name: string; ms: number | null; active: boolean }

function format(ms: number): string {
  const total = Math.max(0, ms)
  const minutes = Math.floor(total / 60_000)
  const seconds = Math.floor((total % 60_000) / 1000)
  if (total < 10_000) return `0:0${seconds}.${Math.floor((total % 1000) / 100)}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function ChessClock({ name, ms, active }: ChessClockProps) {
  return (
    <div
      data-testid="clock"
      data-active={active ? 'true' : 'false'}
      className={`flex items-center justify-between rounded-lg px-3 py-2 ${active ? 'bg-fg text-bg' : 'bg-well text-fg'}`}
    >
      <span className={`text-sm ${active ? 'text-bg' : 'text-fg-secondary'}`}>{name}</span>
      {ms !== null && <span className="font-mono text-2xl tabular-nums">{format(ms)}</span>}
    </div>
  )
}
