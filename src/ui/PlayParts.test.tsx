// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ChessClock } from './ChessClock'
import { GameControls } from './GameControls'
import { GameOverCard } from './GameOverCard'
import { PlayMoveList } from './PlayMoveList'

it('formats the clock, with tenths under ten seconds', () => {
  const { rerender } = render(<ChessClock name="You" ms={245_000} active />)
  expect(screen.getByTestId('clock')).toHaveTextContent('4:05')
  expect(screen.getByTestId('clock')).toHaveAttribute('data-active', 'true')
  rerender(<ChessClock name="You" ms={9_400} active={false} />)
  expect(screen.getByTestId('clock')).toHaveTextContent('0:09.4')
  expect(screen.getByTestId('clock')).toHaveAttribute('data-active', 'false')
})

it('shows just the name without a clock', () => {
  render(<ChessClock name="Stockfish · 1500" ms={null} active={false} />)
  expect(screen.getByTestId('clock')).toHaveTextContent('Stockfish · 1500')
  expect(screen.getByTestId('clock')).not.toHaveTextContent(':')
})

const controls = () => ({
  onTakeBack: vi.fn(),
  onHint: vi.fn(),
  onToggleEval: vi.fn(),
  onOfferDraw: vi.fn(),
  onResign: vi.fn(),
})

it('calls the game controls', async () => {
  const h = controls()
  render(<GameControls {...h} canTakeBack canHint evalVisible={false} disabled={false} />)
  for (const [name, fn] of [
    ['Take back', h.onTakeBack],
    ['Hint', h.onHint],
    ['Show eval bar', h.onToggleEval],
    ['Offer draw', h.onOfferDraw],
    ['Resign', h.onResign],
  ] as const) {
    await userEvent.click(screen.getByRole('button', { name }))
    expect(fn).toHaveBeenCalledTimes(1)
  }
})

it('disables take back and hint when they make no sense', () => {
  render(<GameControls {...controls()} canTakeBack={false} canHint={false} evalVisible disabled={false} />)
  expect(screen.getByRole('button', { name: 'Take back' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Hide eval bar' })).toBeEnabled()
})

it('announces the result and offers review or a new game', async () => {
  const onReview = vi.fn()
  const onNewGame = vi.fn()
  render(
    <GameOverCard outcome={{ result: '1-0', reason: 'checkmate', winner: 'w' }} onReview={onReview} onNewGame={onNewGame} />,
  )
  expect(screen.getByRole('status')).toHaveTextContent('1-0 · Checkmate')
  await userEvent.click(screen.getByRole('button', { name: 'Review this game' }))
  await userEvent.click(screen.getByRole('button', { name: 'New game' }))
  expect(onReview).toHaveBeenCalled()
  expect(onNewGame).toHaveBeenCalled()
})

it('writes a draw as ½-½', () => {
  render(
    <GameOverCard outcome={{ result: '1/2-1/2', reason: 'draw agreed', winner: null }} onReview={() => {}} onNewGame={() => {}} />,
  )
  expect(screen.getByRole('status')).toHaveTextContent('½-½ · Draw agreed')
})

it('lists the moves with figurines', () => {
  render(<PlayMoveList sans={['e4', 'e5', 'Nf3']} firstColor="w" />)
  expect(screen.getAllByTestId('play-move').map((m) => m.textContent)).toEqual(['e4', 'e5', '♞f3'])
})
