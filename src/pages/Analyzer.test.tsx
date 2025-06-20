// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { EvalUpdate } from '../engine/uci'
import type { BoardProps } from '../ui/Board'

// The real board drives chessground, which measures DOM geometry jsdom does not
// provide. We only care about which position it was asked to show.
vi.mock('../ui/Board', () => ({
  Board: ({ fen, turn }: BoardProps) => <div data-testid="board" data-fen={fen} data-turn={turn} />,
}))

// The real hook spawns a Stockfish web worker. Stand in for it with lines that
// depend on the position it is asked about, exactly as the engine would.
vi.mock('../hooks/useAnalysis', () => ({
  useAnalysis: (fen: string) => {
    const whiteToMove = fen.split(' ')[1] === 'w'
    const pv = whiteToMove ? ['e2e4', 'e7e5'] : ['g8f6', 'b1c3']
    const lines: EvalUpdate[] = [
      { depth: 12, multipv: 1, score: { type: 'cp', value: 20 }, pv },
    ]
    return { lines, depth: 12, stale: false, multiThreaded: true, error: null }
  },
}))

const { Analyzer } = await import('./Analyzer')

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

const board = () => screen.getByTestId('board')
const backToGame = () => screen.queryByRole('button', { name: 'Back to game' })

beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

it('shows the game position before any line is selected', () => {
  render(<Analyzer />)
  expect(board()).toHaveAttribute('data-fen', START)
  expect(backToGame()).not.toBeInTheDocument()
})

it('previews a line from the game position', async () => {
  render(<Analyzer />)
  await userEvent.click(screen.getByRole('button', { name: 'e2e4' }))

  expect(board()).toHaveAttribute('data-fen', AFTER_E4)
  expect(backToGame()).toBeInTheDocument()
})

it('keeps previewing when a move of the previewed position is clicked', async () => {
  render(<Analyzer />)
  await userEvent.click(screen.getByRole('button', { name: 'e2e4' }))

  // The engine now analyses the previewed position, so its lines are Black's.
  // Clicking one must walk one ply deeper, not bounce back to the game.
  await userEvent.click(screen.getByRole('button', { name: 'g8f6' }))

  expect(backToGame()).toBeInTheDocument()
  expect(board()).toHaveAttribute(
    'data-fen',
    'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2',
  )
})

it('tells the board whose turn it is in the previewed position', async () => {
  render(<Analyzer />)
  expect(board()).toHaveAttribute('data-turn', 'white')

  await userEvent.click(screen.getByRole('button', { name: 'e2e4' }))
  expect(board()).toHaveAttribute('data-turn', 'black')
})

it('returns to the game position', async () => {
  render(<Analyzer />)
  await userEvent.click(screen.getByRole('button', { name: 'e2e4' }))
  await userEvent.click(screen.getByRole('button', { name: 'Back to game' }))

  expect(board()).toHaveAttribute('data-fen', START)
  expect(backToGame()).not.toBeInTheDocument()
})

it('opens the position passed as ?fen=', () => {
  window.history.pushState({}, '', `/?fen=${encodeURIComponent(AFTER_E4)}`)
  render(<Analyzer />)
  expect(board()).toHaveAttribute('data-fen', AFTER_E4)
})

it('ignores an invalid ?fen=', () => {
  window.history.pushState({}, '', '/?fen=garbage')
  render(<Analyzer />)
  expect(board()).toHaveAttribute('data-fen', START)
})
