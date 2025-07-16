// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ReviewMoveList } from './ReviewMoveList'
import { reviewedMove } from './review.fixtures'

const moves = [
  reviewedMove({ ply: 0, label: 'best', san: 'e4' }),
  reviewedMove({ ply: 1, label: 'blunder', san: 'Qd2' }),
]

it('shows each move with its label badge', () => {
  render(<ReviewMoveList moves={moves} current={0} onSelect={() => {}} />)
  const buttons = screen.getAllByTestId('review-move')
  expect(buttons).toHaveLength(2)
  expect(within(buttons[1]).getByRole('img', { name: 'Blunder' })).toHaveTextContent('??')
  expect(within(buttons[0]).getByRole('img', { name: 'Best move' })).toHaveTextContent('★')
})

it('marks book moves with a book badge', () => {
  render(<ReviewMoveList moves={[reviewedMove({ ply: 0, label: 'book', san: 'd4' })]} current={0} onSelect={() => {}} />)
  expect(within(screen.getByTestId('review-move')).getByRole('img', { name: 'Book' })).toBeInTheDocument()
})

it('shows no badge for ordinary good moves', () => {
  render(<ReviewMoveList moves={[reviewedMove({ ply: 0, label: 'good', san: 'd4' })]} current={0} onSelect={() => {}} />)
  expect(within(screen.getByTestId('review-move')).queryByRole('img')).not.toBeInTheDocument()
})

it('draws pieces as figurines, filled for White and outlined for Black', () => {
  render(
    <ReviewMoveList
      moves={[
        reviewedMove({ ply: 0, label: 'good', san: 'Nxd5' }),
        reviewedMove({ ply: 1, label: 'good', san: 'Qxd2+' }),
        reviewedMove({ ply: 2, label: 'good', san: 'e8=Q#' }),
        reviewedMove({ ply: 3, label: 'good', san: 'O-O-O' }),
      ]}
      current={0}
      onSelect={() => {}}
    />,
  )
  const text = screen.getAllByTestId('review-move').map((button) => button.textContent)
  expect(text).toEqual(['♞xd5', '♕xd2+', 'e8=♛#', 'O-O-O'])
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
