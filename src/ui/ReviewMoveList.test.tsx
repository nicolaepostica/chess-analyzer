// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ReviewMoveList } from './ReviewMoveList'
import { reviewedMove } from './review.fixtures'

const moves = [
  reviewedMove({ ply: 0, label: 'best', san: 'e4' }),
  reviewedMove({ ply: 1, label: 'blunder', san: 'Qd2' }),
]

it('shows each move with its glyph', () => {
  render(<ReviewMoveList moves={moves} current={0} onSelect={() => {}} />)
  const buttons = screen.getAllByTestId('review-move')
  expect(buttons).toHaveLength(2)
  expect(buttons[1]).toHaveTextContent('Qd2??')
})

it('highlights the move that led to the current position', () => {
  render(<ReviewMoveList moves={moves} current={2} onSelect={() => {}} />)
  expect(screen.getAllByTestId('review-move')[1]).toHaveAttribute('aria-current', 'true')
  expect(screen.getAllByTestId('review-move')[0]).not.toHaveAttribute('aria-current')
})

it('selects the position after the clicked move', async () => {
  const onSelect = vi.fn()
  render(<ReviewMoveList moves={moves} current={0} onSelect={onSelect} />)
  await userEvent.click(screen.getAllByTestId('review-move')[0])
  expect(onSelect).toHaveBeenCalledWith(1)
})
