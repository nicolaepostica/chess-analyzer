import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Score } from '../engine/uci'
import type { Square } from '../game/game'
import { parseGameRecord, type RecordResult } from '../game/record'
import { useGameReview } from '../hooks/useGameReview'
import { fetchChessComPgn, parseReviewParams } from '../sources/chesscom'
import { Board } from '../ui/Board'
import { SECONDARY_BUTTON } from '../ui/buttonStyles'
import { Card } from '../ui/Card'
import { EvalBar } from '../ui/EvalBar'
import { EvalGraph } from '../ui/EvalGraph'
import { MoveHint } from '../ui/MoveHint'
import { ReviewControls } from '../ui/ReviewControls'
import { ReviewMoveList } from '../ui/ReviewMoveList'
import { ReviewSummary } from '../ui/ReviewSummary'

// The board is read-only here; a stable empty map keeps Board's sync effect quiet.
const NO_DESTS: Map<Square, Square[]> = new Map()
const noMove = () => {}
const PLAY_INTERVAL_MS = 1000

const ALERT = 'rounded-lg border border-accent-alt/40 bg-accent-alt/10 p-3 text-sm'
const FIELD =
  'w-full rounded-lg border border-border bg-black/35 px-2.5 py-2 font-mono text-xs text-fg placeholder:text-fg-muted'

const FETCH_ERRORS = {
  'not-found': 'Game not found in the archive yet — chess.com may take a minute to publish it.',
  network: 'Could not reach chess.com.',
}

/** A finished game has no engine score; show the result instead. */
const RESULTS: Record<number, { score: Score; readout: string }> = {
  100: { score: { type: 'cp', value: 10000 }, readout: '1-0' },
  50: { score: { type: 'cp', value: 0 }, readout: '½-½' },
  0: { score: { type: 'cp', value: -10000 }, readout: '0-1' },
}

function recordError(result: RecordResult): string | null {
  if (result.ok) return null
  if (result.reason === 'unsupported-variant') return "This variant isn't supported yet."
  if (result.reason === 'no-moves') return 'This game has no moves to review.'
  return `Could not read this PGN: ${result.message}`
}

export function GameReview() {
  const request = useMemo(() => parseReviewParams(window.location.search), [])
  const user = request.kind === 'chesscom' || request.kind === 'pgn' ? request.user : null

  const [pgn, setPgn] = useState<string | null>(request.kind === 'pgn' ? request.pgn : null)
  const [draft, setDraft] = useState('')
  const [fetchError, setFetchError] = useState<keyof typeof FETCH_ERRORS | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (request.kind !== 'chesscom') return
    let live = true
    setFetchError(null)
    void fetchChessComPgn(request).then((result) => {
      if (!live) return
      if (result.ok) setPgn(result.pgn)
      else setFetchError(result.reason)
    })
    return () => {
      live = false
    }
  }, [request, attempt])

  // Memoised: useGameReview restarts whenever the record changes identity.
  const parsed = useMemo(() => (pgn === null ? null : parseGameRecord(pgn)), [pgn])
  const record = parsed?.ok ? parsed.record : null
  const review = useGameReview(record)

  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    setCurrent(0)
    setPlaying(false)
  }, [record])
  const last = record ? record.positions.length - 1 : 0
  const go = useCallback((position: number) => setCurrent(Math.max(0, Math.min(last, position))), [last])

  // Autoplay: one move per second, stopping on the last position.
  useEffect(() => {
    if (!playing) return
    if (current >= last) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => setCurrent((position) => Math.min(last, position + 1)), PLAY_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [playing, current, last])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: last }[event.key]
      if (next === undefined) return
      event.preventDefault()
      go(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, last, go])

  const headers = record?.headers ?? {}
  const userColor = useMemo(() => {
    const name = user?.toLowerCase()
    if (!name) return null
    if (headers.White?.toLowerCase() === name) return 'white'
    if (headers.Black?.toLowerCase() === name) return 'black'
    return null
  }, [user, headers.White, headers.Black])
  const orientation = userColor ?? 'white'
  const whiteName = userColor === 'white' ? 'You' : userColor === 'black' ? 'Opponent' : headers.White || 'White'
  const blackName = userColor === 'black' ? 'You' : userColor === 'white' ? 'Opponent' : headers.Black || 'Black'

  const analyze = (fen: string) => window.open(`${import.meta.env.BASE_URL}?fen=${encodeURIComponent(fen)}`, '_blank')

  const loading = request.kind === 'chesscom' && pgn === null && fetchError === null
  const errors = [
    request.kind === 'invalid' ? `This review link is broken: ${request.message}.` : null,
    fetchError ? FETCH_ERRORS[fetchError] : null,
    parsed ? recordError(parsed) : null,
    record && !review.multiThreaded
      ? 'Multi-threaded engine unavailable (no cross-origin isolation). Falling back to the slower single-threaded build.'
      : null,
    review.error,
  ].filter((message): message is string => message !== null)

  const pasteBox = (
    <Card title="Review a game">
      <label htmlFor="pgn-input" className="mb-2 block text-sm text-fg-secondary">
        Paste a PGN
      </label>
      <textarea
        id="pgn-input"
        rows={6}
        className={FIELD}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button
        type="button"
        className={`mt-3 ${SECONDARY_BUTTON}`}
        onClick={() => {
          setFetchError(null)
          setPgn(draft.trim())
        }}
      >
        Review PGN
      </button>
    </Card>
  )

  const moves = review.result.moves
  const move = current > 0 ? (moves[current - 1] ?? null) : null
  const fen = record?.positions[current]
  // Start: the engine's view of the first move. After a move: its evaluation, or
  // the result when the game ended there. A ply not reached yet stays empty.
  const finished = move && !move.playedScoreWhite ? RESULTS[review.result.whiteWins[current]] : undefined
  const barScore = current === 0 ? (moves[0]?.bestScoreWhite ?? null) : (move?.playedScoreWhite ?? finished?.score ?? null)

  return (
    <div className="flex flex-col gap-6">
      {errors.map((message) => (
        <p key={message} role="alert" className={ALERT}>
          {message}
          {fetchError && message === FETCH_ERRORS[fetchError] && (
            <button type="button" className={`ml-3 ${SECONDARY_BUTTON}`} onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </button>
          )}
        </p>
      ))}

      {loading && <p className="text-sm text-fg-secondary">Loading the game from chess.com…</p>}

      {!record && !loading && pasteBox}

      {record && fen && (
        <>
          <div className="flex flex-col items-center gap-6 wide:grid wide:grid-cols-[minmax(0,680px)_450px] wide:items-start wide:justify-center">
            <div data-testid="board-column" className="flex w-full max-w-[680px] flex-col gap-2">
              <div className="flex w-full gap-2.5">
                <EvalBar score={barScore} readout={finished?.readout} orientation={orientation} />
                <Board
                  fen={fen}
                  dests={NO_DESTS}
                  orientation={orientation}
                  turn={fen.split(' ')[1] === 'w' ? 'white' : 'black'}
                  onMove={noMove}
                />
              </div>
              {/* Indented by the eval bar's width (w-7) plus the gap, so it lines up with the board. */}
              <div className="pl-[2.375rem]">
                <EvalGraph
                  whiteWins={review.result.whiteWins}
                  total={record.positions.length}
                  moves={moves}
                  current={current}
                  onSelect={go}
                />
                {!review.done && (
                  <p data-testid="review-progress" className="mt-1 text-right font-mono text-xs text-fg-secondary">
                    Analyzing… {review.evaluated} / {review.total}
                  </p>
                )}
              </div>
            </div>

            <div className="flex w-full min-w-0 max-w-[650px] flex-col gap-4 wide:max-w-none">
              <Card title="Game review">
                <ReviewSummary
                  moves={moves}
                  accuracy={review.result.accuracy}
                  whiteName={whiteName}
                  blackName={blackName}
                />
              </Card>
              <Card title="Moves">
                <ReviewMoveList moves={moves} current={current} onSelect={go} />
                <div className="mt-3">
                  <ReviewControls
                    playing={playing}
                    atStart={current === 0}
                    atEnd={current === last}
                    onFirst={() => go(0)}
                    onPrevious={() => go(current - 1)}
                    onTogglePlay={() => setPlaying((value) => !value)}
                    onNext={() => go(current + 1)}
                    onLast={() => go(last)}
                  />
                </div>
              </Card>
              <Card title="This move">
                {current > 0 && !move ? (
                  <p className="text-sm text-fg-secondary">Not analysed yet.</p>
                ) : (
                  <MoveHint move={move} onAnalyze={analyze} />
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
