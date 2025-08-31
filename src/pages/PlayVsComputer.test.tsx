// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { BoardProps } from '../ui/Board'

let boardProps: BoardProps | null = null
vi.mock('../ui/Board', () => ({
  Board: (props: BoardProps) => {
    boardProps = props
    return <div data-testid="board" data-fen={props.fen} data-orientation={props.orientation} />
  },
}))

type Deferred = { fen: string; resolve: (move: string | null) => void }
const moveCalls: Deferred[] = []
const opponent = {
  move: vi.fn((fen: string) => new Promise<string | null>((resolve) => moveCalls.push({ fen, resolve }))),
  hint: vi.fn(async () => 'g1f3' as string | null),
  cancel: vi.fn(),
  resetScore: vi.fn(),
  lastScoreWhite: null as null | { type: 'cp' | 'mate'; value: number },
  multiThreaded: true,
  error: null as string | null,
}
vi.mock('../hooks/useComputerOpponent', () => ({ useComputerOpponent: () => opponent }))

vi.mock('../hooks/useAnalysis', () => {
  const state = {
    lines: [{ depth: 18, multipv: 1, score: { type: 'cp', value: 35 }, pv: ['e7e5'] }],
    depth: 18,
    stale: false,
    multiThreaded: true,
    error: null,
  }
  return { useAnalysis: () => state }
})

const { PlayVsComputer } = await import('./PlayVsComputer')

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

let location = ''
function LocationProbe() {
  const here = useLocation()
  location = here.pathname + here.search
  return null
}

function renderPage(settings: Record<string, unknown> = {}) {
  localStorage.setItem(
    'chess-analyzer:play',
    JSON.stringify({ level: 5, color: 'w', timeControl: '5+0', ...settings }),
  )
  return render(
    <MemoryRouter initialEntries={['/play']}>
      <Routes>
        <Route path="/play" element={<PlayVsComputer />} />
        <Route path="/import" element={<p>review page</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}

const start = () => userEvent.click(screen.getByRole('button', { name: 'Start game' }))
const board = () => screen.getByTestId('board')
const userMove = (from: string, to: string) => act(() => boardProps!.onMove(from, to))
const computerMove = async (uci: string | null) => {
  await act(async () => moveCalls.at(-1)!.resolve(uci))
}

beforeEach(() => {
  localStorage.clear()
  moveCalls.length = 0
  boardProps = null
  opponent.move.mockClear()
  opponent.hint.mockClear()
  opponent.cancel.mockClear()
  opponent.resetScore.mockClear()
  opponent.lastScoreWhite = null
})
afterEach(() => vi.useRealTimers())

it('starts from the setup and plays as White on the clock', async () => {
  renderPage()
  expect(screen.getByRole('button', { name: 'Start game' })).toBeInTheDocument()
  await start()
  expect(screen.getAllByTestId('clock').map((c) => c.textContent)).toEqual(['Stockfish · 15005:00', 'You5:00'])
  expect(board()).toHaveAttribute('data-orientation', 'white')
  expect(boardProps!.dests.get('e2')).toContain('e4')
})

it("answers the user's move and lists both", async () => {
  renderPage()
  await start()
  userMove('e2', 'e4')
  expect(opponent.move).toHaveBeenCalledWith(AFTER_E4, expect.objectContaining({ level: 5 }), expect.any(Object))
  await computerMove('e7e5')
  expect(screen.getAllByTestId('play-move').map((m) => m.textContent)).toEqual(['e4', 'e5'])
})

it('lets the computer open when the user plays Black', async () => {
  renderPage({ color: 'b' })
  await start()
  expect(opponent.move).toHaveBeenCalledWith(START, expect.anything(), expect.any(Object))
  expect(board()).toHaveAttribute('data-orientation', 'black')
})

it('takes back while the computer is thinking and ignores its late answer', async () => {
  renderPage()
  await start()
  userMove('e2', 'e4')
  const pending = moveCalls[0]
  await userEvent.click(screen.getByRole('button', { name: 'Take back' }))
  expect(opponent.cancel).toHaveBeenCalled()
  expect(board()).toHaveAttribute('data-fen', START)
  await act(async () => pending.resolve('e7e5'))
  expect(board()).toHaveAttribute('data-fen', START)
})

it("takes back the user's move and the computer's reply", async () => {
  renderPage()
  await start()
  userMove('e2', 'e4')
  await computerMove('e7e5')
  await userEvent.click(screen.getByRole('button', { name: 'Take back' }))
  expect(board()).toHaveAttribute('data-fen', START)
})

it('shows a hint as an arrow until the next move', async () => {
  renderPage()
  await start()
  await userEvent.click(screen.getByRole('button', { name: 'Hint' }))
  expect(boardProps!.arrows).toEqual([{ orig: 'g1', dest: 'f3', brush: 'green' }])
  userMove('e2', 'e4')
  expect(boardProps!.arrows ?? []).toEqual([])
})

it('toggles the eval bar', async () => {
  renderPage()
  await start()
  expect(screen.queryByTestId('eval-bar')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Show eval bar' }))
  expect(screen.getByTestId('eval-bar')).toHaveTextContent('+0.35')
  await userEvent.click(screen.getByRole('button', { name: 'Hide eval bar' }))
  expect(screen.queryByTestId('eval-bar')).not.toBeInTheDocument()
})

it('accepts a draw only in a level position', async () => {
  renderPage()
  await start()
  opponent.lastScoreWhite = { type: 'cp', value: 300 }
  await userEvent.click(screen.getByRole('button', { name: 'Offer draw' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Stockfish declines the draw.')
  opponent.lastScoreWhite = { type: 'cp', value: 20 }
  await userEvent.click(screen.getByRole('button', { name: 'Offer draw' }))
  expect(screen.getByRole('status')).toHaveTextContent('½-½ · Draw agreed')
})

it('resigns', async () => {
  renderPage()
  await start()
  await userEvent.click(screen.getByRole('button', { name: 'Resign' }))
  expect(screen.getByRole('status')).toHaveTextContent('0-1 · Resignation')
})

it('loses on time', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  renderPage({ timeControl: '1+0' })
  await start()
  await act(async () => vi.advanceTimersByTime(61_000))
  expect(screen.getByRole('status')).toHaveTextContent('0-1 · Timeout')
  expect(screen.getAllByTestId('clock')[1]).toHaveTextContent('0:00.0')
})

it('ends the game when the computer mates', async () => {
  renderPage()
  await start()
  userMove('f2', 'f3')
  await computerMove('e7e5')
  userMove('g2', 'g4')
  await computerMove('d8h4')
  expect(screen.getByRole('status')).toHaveTextContent('0-1 · Checkmate')
  expect(screen.getAllByTestId('clock').every((c) => c.getAttribute('data-active') === 'false')).toBe(true)
})

it('opens the finished game in Game Review', async () => {
  renderPage()
  await start()
  await userEvent.click(screen.getByRole('button', { name: 'Resign' }))
  await userEvent.click(screen.getByRole('button', { name: 'Review this game' }))
  const url = new URL(location, 'http://x')
  expect(url.pathname).toBe('/import')
  expect(url.searchParams.get('user')).toBe('You')
  expect(url.searchParams.get('pgn')).toContain('[White "You"]')
  expect(url.searchParams.get('pgn')).toContain('[Black "Stockfish Level 5 (1500)"]')
})

it('stops its timer when leaving the page', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const { unmount } = renderPage()
  await start()
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('rejects a move made after the clock ran out', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(new Date(2025, 7, 7, 12, 0, 0))
  renderPage({ timeControl: '1+0' })
  await act(async () => screen.getByRole('button', { name: 'Start game' }).click())
  // Time passes without the clock's interval getting a chance to notice.
  vi.setSystemTime(new Date(2025, 7, 7, 12, 1, 0, 50))
  userMove('e2', 'e4')
  expect(screen.getByRole('status')).toHaveTextContent('0-1 · Timeout')
  expect(board()).toHaveAttribute('data-fen', START)
})

it("forgets the computer's evaluation when a game starts or a move is taken back", async () => {
  renderPage()
  await start()
  expect(opponent.resetScore).toHaveBeenCalledTimes(1)
  userMove('e2', 'e4')
  await computerMove('e7e5')
  await userEvent.click(screen.getByRole('button', { name: 'Take back' }))
  expect(opponent.resetScore).toHaveBeenCalledTimes(2)
})
