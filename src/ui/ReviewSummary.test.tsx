// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { MoveHint } from './MoveHint'
import { ReviewSummary } from './ReviewSummary'
import { reviewedMove } from './review.fixtures'

const moves = [
  reviewedMove({ ply: 0, label: 'best' }),
  reviewedMove({ ply: 1, label: 'blunder' }),
  reviewedMove({ ply: 2, label: 'blunder' }),
]

it('shows accuracy with one decimal', () => {
  render(<ReviewSummary moves={moves} accuracy={{ white: 87.43, black: 72.06 }} whiteName="You" blackName="Opponent" />)
  expect(screen.getByTestId('accuracy-white')).toHaveTextContent('87.4')
  expect(screen.getByTestId('accuracy-black')).toHaveTextContent('72.1')
  expect(screen.getByText('You')).toBeInTheDocument()
})

it('shows a placeholder until accuracy is known', () => {
  render(<ReviewSummary moves={moves} accuracy={null} whiteName="a" blackName="b" />)
  expect(screen.getByTestId('accuracy-white')).toHaveTextContent('…')
})

it('counts labels per player', () => {
  render(<ReviewSummary moves={moves} accuracy={null} whiteName="a" blackName="b" />)
  expect(screen.getByTestId('count-blunder-white')).toHaveTextContent('1')
  expect(screen.getByTestId('count-blunder-black')).toHaveTextContent('1')
  expect(screen.getByTestId('count-best-white')).toHaveTextContent('1')
})

it('colours the counts and shows the label badge, chess.com-style', () => {
  render(<ReviewSummary moves={moves} accuracy={null} whiteName="a" blackName="b" />)
  expect(screen.getByTestId('count-blunder-white')).toHaveClass('text-label-blunder')
  expect(screen.getByTestId('count-best-black')).toHaveClass('text-label-best')
  expect(screen.getByRole('img', { name: 'Blunder' })).toBeInTheDocument()
})

it('names the better move after a mistake', () => {
  const move = reviewedMove({
    ply: 0,
    label: 'mistake',
    san: 'Qd2',
    uci: 'd1d2',
    bestUci: 'f1e2',
    bestSan: 'Be2',
    bestScoreWhite: { type: 'cp', value: 60 },
    playedScoreWhite: { type: 'cp', value: -210 },
  })
  render(<MoveHint move={move} onAnalyze={() => {}} />)
  expect(screen.getByText(/Best was Be2/)).toHaveTextContent('+0.60')
  expect(screen.getByText(/after Qd2/)).toHaveTextContent('-2.10')
})

it('acknowledges the best move', () => {
  render(<MoveHint move={reviewedMove({ ply: 0, label: 'best' })} onAnalyze={() => {}} />)
  expect(screen.getByText(/Best move/)).toBeInTheDocument()
})

it('opens the position before the move for analysis', async () => {
  const onAnalyze = vi.fn()
  const move = reviewedMove({ ply: 0, label: 'good' })
  render(<MoveHint move={move} onAnalyze={onAnalyze} />)
  await userEvent.click(screen.getByRole('button', { name: 'Analyze position' }))
  expect(onAnalyze).toHaveBeenCalledWith(move.fenBefore)
})
