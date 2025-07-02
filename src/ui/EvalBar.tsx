import type { Score } from '../engine/uci'

/** Logistic curve: 400 centipawns ≈ 76% expected score. */
export function whiteWinProbability(score: Score): number {
  if (score.type === 'mate') return score.value > 0 ? 1 : 0
  return 1 / (1 + Math.pow(10, -score.value / 400))
}

export function formatScore(score: Score): string {
  if (score.type === 'mate') {
    return score.value >= 0 ? `M${score.value}` : `-M${Math.abs(score.value)}`
  }
  const pawns = score.value / 100
  if (pawns === 0) return '0.00'
  return `${pawns > 0 ? '+' : '-'}${Math.abs(pawns).toFixed(2)}`
}

export function EvalBar({
  score,
  orientation,
  readout,
}: {
  score: Score | null
  orientation: 'white' | 'black'
  /** Replaces the formatted score, e.g. with a game result. */
  readout?: string
}) {
  const whiteShare = score ? whiteWinProbability(score) : 0.5

  return (
    <div
      data-testid="eval-bar"
      className={`relative w-7 shrink-0 self-stretch overflow-hidden rounded-md border border-border bg-well ${
        orientation === 'white' ? 'flex flex-col-reverse' : 'flex flex-col'
      }`}
    >
      <div
        className="w-full bg-fg transition-[height] duration-200"
        style={{ height: `${whiteShare * 100}%` }}
      />
      {/*
        The readout sits at the bottom, so what lies under it — the light white
        fill or the dark bar body — depends on the orientation and on white's
        share. Neither a constant colour nor a share threshold works here: the
        filled/unfilled boundary is the readout's pixel height divided by the
        bar's, and the bar ranges from ~300px to 640px. So the text carries its
        own dark scrim: 16.3:1 over the body, 10.9:1 over the fill. No geometry
        needed.
      */}
      <span className="absolute inset-x-0.5 bottom-1 rounded-sm bg-well/85 py-px text-center font-mono text-[10px] font-semibold text-fg tabular-nums">
        {readout ?? (score ? formatScore(score) : '…')}
      </span>
    </div>
  )
}
