import { useCallback, useMemo, useState } from 'react'
import type { Chess } from 'chess.js'
import type { EvalUpdate } from '../engine/uci'
import type { Square } from '../game/game'
import { createGame, getState, isValidFen, legalDests, tryMove } from '../game/game'
import { previewFen } from '../game/preview'
import { useAnalysis } from '../hooks/useAnalysis'
import { useSettings } from '../hooks/useSettings'
import { Board } from '../ui/Board'
import { Card } from '../ui/Card'
import { DepthBadge } from '../ui/DepthBadge'
import { EvalBar } from '../ui/EvalBar'
import { LineList } from '../ui/LineList'
import { PositionEditor } from '../ui/PositionEditor'
import { PositionInput } from '../ui/PositionInput'
import { SettingsPanel } from '../ui/SettingsPanel'
import { linesToArrows } from '../ui/arrows'
import { SECONDARY_BUTTON } from '../ui/buttonStyles'

// Board's sync effect keys on dests by identity. A fresh Map each render would
// re-run api.set() on every render and cut the move animation short.
const NO_DESTS: Map<Square, Square[]> = new Map()

/** The game review opens positions here as ?fen=. Not useSearchParams: tests render without a router. */
function initialFen(): string | undefined {
  const fen = new URLSearchParams(window.location.search).get('fen')
  return fen && isValidFen(fen) ? fen : undefined
}

export function Analyzer() {
  const [game, setGame] = useState(() => createGame(initialFen()))
  const [state, setState] = useState(() => getState(game))
  const [preview, setPreview] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const dests = useMemo(() => legalDests(game), [state.fen])
  const [settings, updateSettings] = useSettings()
  const displayFen = preview ?? state.fen
  const previewing = preview !== null
  const displayTurn = displayFen.split(' ')[1] === 'w' ? 'white' : 'black'
  const analysis = useAnalysis(displayFen, settings)
  const arrows = useMemo(() => linesToArrows(analysis.lines), [analysis.lines])

  // Lines describe the position on screen, so walk them from there — not from
  // the game position, which may be several plies behind during a preview.
  // An unplayable line leaves the board where it is rather than snapping back.
  const selectLine = useCallback(
    (line: EvalUpdate, plyCount: number) => {
      const next = previewFen(displayFen, line.pv.slice(0, plyCount))
      if (next) setPreview(next)
    },
    [displayFen],
  )

  const onMove = useCallback(
    (from: string, to: string) => {
      setPreview(null)
      if (tryMove(game, from, to)) setState(getState(game))
    },
    [game],
  )

  const loadGame = useCallback((next: Chess) => {
    setPreview(null)
    setGame(next)
    setState(getState(next))
  }, [])

  const applyEditedFen = useCallback(
    (fen: string) => {
      setEditing(false)
      setPreview(null)
      loadGame(createGame(fen))
    },
    [loadGame],
  )

  const best = analysis.lines[0] ?? null

  if (editing) {
    return (
      <PositionEditor
        initialFen={state.fen}
        onApply={applyEditedFen}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const ALERT = 'rounded-lg border border-accent-alt/40 bg-accent-alt/10 p-3 text-sm'

  return (
    <div className="flex flex-col gap-6">
      {/* Alerts live above the grid. Inside it they would become a third cell. */}
      {!analysis.multiThreaded && (
        <p role="alert" className={ALERT}>
          Multi-threaded engine unavailable (no cross-origin isolation). Falling back to the slower
          single-threaded build.
        </p>
      )}
      {analysis.error && (
        <p role="alert" className={ALERT}>
          {analysis.error}
        </p>
      )}

      <div className="flex flex-col items-center gap-6 wide:grid wide:grid-cols-[minmax(0,680px)_450px] wide:items-start wide:justify-center">
        {/* The wrapper gives the row a width that does not depend on the board:
            otherwise calc(100% - 2.375rem) in board.css would reference a width
            the board itself defines. */}
        <div className="w-full max-w-[680px]">
          <div className="flex w-full gap-2.5">
            <EvalBar score={best?.score ?? null} orientation="white" />
            <Board
              fen={displayFen}
              dests={previewing ? NO_DESTS : dests}
              orientation="white"
              turn={displayTurn}
              arrows={arrows}
              onMove={onMove}
            />
          </div>
        </div>

        <div className="flex w-full min-w-0 max-w-[650px] flex-col gap-4 wide:max-w-none">
          <Card
            title="Stockfish 18"
            aside={<DepthBadge reached={analysis.depth} target={settings.depth} />}
          >
            {/* Dim only the numbers. The settings sliders are not stale, no reason to dim them. */}
            <div className={analysis.stale ? 'opacity-50' : undefined}>
              <LineList lines={analysis.lines} onSelect={selectLine} />
            </div>
            {previewing && (
              <button type="button" className={`mt-3 ${SECONDARY_BUTTON}`} onClick={() => setPreview(null)}>
                Back to game
              </button>
            )}
          </Card>

          <Card title="Settings">
            <SettingsPanel settings={settings} onChange={updateSettings} />
          </Card>

          <Card title="Position">
            <PositionInput onLoad={loadGame} />
            <button type="button" className={`mt-3 ${SECONDARY_BUTTON}`} onClick={() => setEditing(true)}>
              Edit position
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
