// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ThemePicker } from './ThemePicker'

it('opens a menu of themes and picks one', async () => {
  const onChange = vi.fn()
  render(<ThemePicker theme="charcoal" onChange={onChange} />)
  expect(screen.queryByRole('button', { name: 'Wood' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Theme' }))
  expect(screen.getByRole('button', { name: 'Charcoal' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Wood' }))
  expect(onChange).toHaveBeenCalledWith('wood')
  expect(screen.queryByRole('button', { name: 'Wood' })).not.toBeInTheDocument()
})

it('closes when clicking elsewhere', async () => {
  render(
    <div>
      <ThemePicker theme="charcoal" onChange={() => {}} />
      <p>outside</p>
    </div>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Theme' }))
  await userEvent.click(screen.getByText('outside'))
  expect(screen.queryByRole('button', { name: 'Lichess-style' })).not.toBeInTheDocument()
})
