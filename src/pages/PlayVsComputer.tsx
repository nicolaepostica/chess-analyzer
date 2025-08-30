import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Chess } from 'chess.js'
import type { EvalUpdate } from '../engine/uci'
import { createClock, flagged, pressClock, startClock, stopClock, timeLeft, type ClockState } from '../game/clock'
import { createGame, legalDests, tryMove, type Square } from '../game/game'
import { LEVELS, TIME_CONTROLS, isTimed, levelName, pgnTimeControl, type Level, type TimeControl } from '../game/levels'
import { DRAW_AGREED, boardOutcome, playPgn, resignOutcome, timeoutOutcome, type Outcome } from '../game/outcome'
import { useAnalysis } from '../hooks/useAnalysis'
import { useComputerOpponent, type ClockInfo } from '../hooks/useComputerOpponent'
import { usePlaySettings } from '../hooks/usePlaySettings'
import { Board, type Arrow } from '../ui/Board'
import { Card } from '../ui/Card'
import { ChessClock } from '../ui/ChessClock'
import { EvalBar } from '../ui/EvalBar'
import { GameControls } from '../ui/GameControls'
import { GameOverCard } from '../ui/GameOverCard'
import { PlayMoveList } from '../ui/PlayMoveList'
import { PlaySetup } from '../ui/PlaySetup'

type Side = 'w' | 'b'
type Match = { userColor: Side; level: Level; timeControl: TimeControl }

const TICK_MS = 100
const DRAW_MARGIN_CP = 50
const EVAL_OPTIONS = { depth: 18, multiPV: 1, chess960: false }
const NO_DESTS: Map<Square, Square[]> = new Map()
const NO_ARROWS: Arrow[] = []
const ALERT = 'rounded-lg border border-accent-alt/40 bg-accent-alt/10 p-3 text-sm'

/** Full-strength analysis for the eval bar; mounted only on the user's turn. */
function EvalEngine({ fen, onLines }: { fen: string; onLines: (lines: EvalUpdate[]) => void }) {
  const { lines } = useAnalysis(fen, EVAL_OPTIONS)
  useEffect(() => onLines(lines), [lines, onLines])
  return null
}

const uciArrow = (uci: string): Arrow[] => [{ orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush: 'green' }]

export function PlayVsComputer() {
  const navigate = useNavigate()
  const opponent = useComputerOpponent()
  const [settings, updateSettings] = usePlaySettings()

  const [match, setMatch] = useState<Match | null>(null)
  const gameRef = useRef<Chess>(createGame())
  const [fen, setFen] = useState(gameRef.current.fen())
  const [clock, setClock] = useState<ClockState | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [evalVisible, setEvalVisible] = useState(false)
  const [evalLines, setEvalLines] = useState<EvalUpdate[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const game = gameRef.current
  const playing = match !== null && outcome === null
  const userTurn = playing && fen.split(' ')[1] === match.userColor

  const finish = useCallback(
    (result: Outcome) => {
      opponent.cancel()
      setOutcome(result)
      setClock((current) => (current ? stopClock(current, Date.now()) : current))
    },
    [opponent],
  )

  /** Plays a move for whoever is to move, presses the clock and checks for the end. */
  const commit = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!tryMove(game, from, to, promotion ?? 'q')) return false
      setHint(null)
      setMessage(null)
      setClock((current) => (current ? pressClock(current, Date.now()) : current))
      setFen(game.fen())
      const ended = boardOutcome(game)
      if (ended) finish(ended)
      return true
    },
    [game, finish],
  )

  const start = () => {
    const color = settings.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.color
    const level = LEVELS.find((l) => l.level === settings.level) ?? LEVELS[4]
    const timeControl = TIME_CONTROLS.find((t) => t.id === settings.timeControl) ?? TIME_CONTROLS[2]
    gameRef.current = createGame()
    setFen(gameRef.current.fen())
    setOutcome(null)
    setHint(null)
    setMessage(null)
    setEvalLines([])
    const at = Date.now()
    setNow(at)
    setClock(isTimed(timeControl) ? startClock(createClock(timeControl.initialMs, timeControl.incrementMs), 'w', at) : null)
    setMatch({ userColor: color, level, timeControl })
  }

  // The computer's turn: ask the engine, ignore the answer if the position moved on.
  const clockRef = useRef(clock)
  clockRef.current = clock
  useEffect(() => {
    if (!playing || userTurn) return
    let active = true
    const current = clockRef.current
    const at = Date.now()
    const info: ClockInfo = current
      ? { wtime: timeLeft(current, 'w', at), btime: timeLeft(current, 'b', at), winc: current.incrementMs, binc: current.incrementMs }
      : null
    void opponent.move(fen, match.level, info).then((uci) => {
      if (!active || !uci || gameRef.current.fen() !== fen) return
      commit(uci.slice(0, 2), uci.slice(2, 4), uci[4])
    })
    return () => {
      active = false
      opponent.cancel()
    }
  }, [playing, userTurn, fen, match, opponent, commit])

  // The clock: re-render the time and catch a flag fall.
  useEffect(() => {
    if (!playing || !clock) return
    const timer = setInterval(() => {
      const at = Date.now()
      setNow(at)
      const side = flagged(clock, at)
      if (side) finish(timeoutOutcome(gameRef.current, side))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [playing, clock, finish])

  const userMove = useCallback(
    (from: string, to: string) => {
      if (userTurn) commit(from, to)
    },
    [userTurn, commit],
  )

  const userMoves = match ? game.history({ verbose: true }).filter((m) => m.color === match.userColor).length : 0
  const takeBack = () => {
    if (!match) return
    opponent.cancel()
    // Undo the computer's reply too, if it already came.
    if (game.turn() === match.userColor) game.undo()
    game.undo()
    const at = Date.now()
    setClock((current) => (current ? startClock(stopClock(current, at), match.userColor, at) : current))
    setHint(null)
    setMessage(null)
    setFen(game.fen())
  }

  const askHint = async () => {
    const position = fen
    const uci = await opponent.hint(position)
    if (uci && gameRef.current.fen() === position) setHint(uci)
  }

  const offerDraw = () => {
    const score = opponent.lastScoreWhite
    if (score?.type === 'cp' && Math.abs(score.value) <= DRAW_MARGIN_CP) finish(DRAW_AGREED)
    else setMessage('Stockfish declines the draw.')
  }

  const review = () => {
    if (!match || !outcome) return
    const computer = `Stockfish Level ${match.level.level} (${match.level.label})`
    const pgn = playPgn(game, {
      white: match.userColor === 'w' ? 'You' : computer,
      black: match.userColor === 'b' ? 'You' : computer,
      outcome,
      timeControl: pgnTimeControl(match.timeControl),
      date: new Date(),
    })
    navigate(`/import?pgn=${encodeURIComponent(pgn)}&user=You`)
  }

  const dests = useMemo(() => (userTurn ? legalDests(createGame(fen)) : NO_DESTS), [userTurn, fen])
  const arrows = useMemo(() => (hint ? uciArrow(hint) : NO_ARROWS), [hint])

  if (!match) {
    return (
      <div className="mx-auto w-full max-w-[520px]">
        <Card title="Play vs computer">
          <PlaySetup settings={settings} onChange={updateSettings} onStart={start} />
        </Card>
      </div>
    )
  }

  const computerColor: Side = match.userColor === 'w' ? 'b' : 'w'
  const ms = (side: Side) => (clock ? timeLeft(clock, side, now) : null)
  const running = clock?.running ?? null
  const orientation = match.userColor === 'w' ? 'white' : 'black'
  const history = game.history()

  return (
    <div className="flex flex-col gap-6">
      {opponent.error && (
        <p role="alert" className={ALERT}>
          {opponent.error}
        </p>
      )}
      {evalVisible && userTurn && <EvalEngine fen={fen} onLines={setEvalLines} />}

      <div className="flex flex-col items-center gap-6 wide:grid wide:grid-cols-[minmax(0,640px)_minmax(0,380px)] wide:items-start wide:justify-center">
        <div className="flex w-full max-w-[680px] gap-2.5">
          {evalVisible && <EvalBar score={evalLines[0]?.score ?? null} orientation={orientation} />}
          <Board fen={fen} dests={dests} orientation={orientation} turn={fen.split(' ')[1] === 'w' ? 'white' : 'black'} arrows={arrows} onMove={userMove} />
        </div>

        <div className="flex w-full min-w-0 max-w-[650px] flex-col gap-3 wide:max-w-none">
          <ChessClock name={levelName(match.level)} ms={ms(computerColor)} active={running === computerColor} />
          <Card title="Moves">
            <PlayMoveList sans={history} firstColor="w" />
          </Card>
          <ChessClock name="You" ms={ms(match.userColor)} active={running === match.userColor} />
          {message && (
            <p role="alert" className={ALERT}>
              {message}
            </p>
          )}
          {outcome ? (
            <Card title="Game over">
              <GameOverCard outcome={outcome} onReview={review} onNewGame={() => setMatch(null)} />
            </Card>
          ) : (
            <GameControls
              canTakeBack={userMoves > 0}
              canHint={userTurn}
              evalVisible={evalVisible}
              disabled={!playing}
              onTakeBack={takeBack}
              onHint={() => void askHint()}
              onToggleEval={() => setEvalVisible((visible) => !visible)}
              onOfferDraw={offerDraw}
              onResign={() => finish(resignOutcome(match.userColor))}
            />
          )}
        </div>
      </div>
    </div>
  )
}
