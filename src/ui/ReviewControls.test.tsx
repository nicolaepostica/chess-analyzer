// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ReviewControls } from './ReviewControls'

const handlers = () => ({ onFirst: vi.fn(), onPrevious: vi.fn(), onTogglePlay: vi.fn(), onNext: vi.fn(), onLast: vi.fn() })

it('calls the matching handler for each button', async () => {
  const h = handlers()
  render(<ReviewControls {...h} playing={false} atStart={false} atEnd={false} />)
  for (const [name, fn] of [
    ['First move', h.onFirst],
    ['Previous move', h.onPrevious],
    ['Play', h.onTogglePlay],
    ['Next move', h.onNext],
    ['Last move', h.onLast],
  ] as const) {
    await userEvent.click(screen.getByRole('button', { name }))
    expect(fn).toHaveBeenCalledTimes(1)
  }
})

it('offers Pause while playing', () => {
  render(<ReviewControls {...handlers()} playing atStart={false} atEnd={false} />)
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
})

it('disables moving past either end', () => {
  const { rerender } = render(<ReviewControls {...handlers()} playing={false} atStart atEnd={false} />)
  expect(screen.getByRole('button', { name: 'First move' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Previous move' })).toBeDisabled()
  rerender(<ReviewControls {...handlers()} playing={false} atStart={false} atEnd />)
  expect(screen.getByRole('button', { name: 'Next move' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Last move' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
})
