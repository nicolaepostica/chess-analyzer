// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { PlaySetup } from './PlaySetup'

const settings = { level: 5, color: 'random' as const, timeControl: '5+0' }

it('shows the selected level with its Elo', () => {
  render(<PlaySetup settings={{ ...settings, level: 7 }} onChange={() => {}} onStart={() => {}} />)
  expect(screen.getByText('Level 7 · 1900 Elo')).toBeInTheDocument()
})

it('changes the level with the slider', () => {
  const onChange = vi.fn()
  render(<PlaySetup settings={settings} onChange={onChange} onStart={() => {}} />)
  fireEvent.change(document.querySelector('#level')!, { target: { value: '7' } })
  expect(onChange).toHaveBeenCalledWith({ level: 7 })
})

it('picks colour and time control with chips', async () => {
  const onChange = vi.fn()
  render(<PlaySetup settings={settings} onChange={onChange} onStart={() => {}} />)
  expect(screen.getByRole('button', { name: '5+0' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Random' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: '3+2' }))
  expect(onChange).toHaveBeenCalledWith({ timeControl: '3+2' })
  await userEvent.click(screen.getByRole('button', { name: 'Black' }))
  expect(onChange).toHaveBeenCalledWith({ color: 'b' })
})

it('starts the game', async () => {
  const onStart = vi.fn()
  render(<PlaySetup settings={settings} onChange={() => {}} onStart={onStart} />)
  await userEvent.click(screen.getByRole('button', { name: 'Start game' }))
  expect(onStart).toHaveBeenCalled()
})
