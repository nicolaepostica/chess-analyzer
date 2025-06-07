import type { AnalyzeOptions, Engine } from './engine'
import type { EvalUpdate } from './uci'

/**
 * Two lines per position: "great" and "brilliant" need the runner-up.
 * Measured 2025-06-07 in Node, single-threaded lite build, 110-position game:
 * depth 14 → 24 s, depth 16 → 73 s, depth 18 → 189 s. Depth 16 keeps a 40-move
 * game under a minute even without the multi-threaded build.
 */
export const REVIEW_OPTIONS: AnalyzeOptions = { depth: 16, multiPV: 2, chess960: false }

/**
 * Evaluates positions one after another. For each, reports the last update of
 * every line, best first, from the side to move's perspective. A finished game
 * position yields no lines.
 */
export async function analyzeAll(
  engine: Engine,
  fens: string[],
  options: AnalyzeOptions,
  onResult: (index: number, lines: EvalUpdate[]) => void,
  isCancelled: () => boolean,
): Promise<void> {
  for (const [index, fen] of fens.entries()) {
    if (isCancelled()) return
    const latest = new Map<number, EvalUpdate>()
    for await (const update of engine.analyze(fen, options)) {
      // Breaking out runs analyze()'s finally, which stops the search and
      // waits for bestmove before the next one may start.
      if (isCancelled()) return
      latest.set(update.multipv, update)
    }
    onResult(index, [...latest.values()].sort((a, b) => a.multipv - b.multipv))
  }
}
