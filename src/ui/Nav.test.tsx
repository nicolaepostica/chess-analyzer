// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { Nav } from './Nav'

it('links the main pages, without Best move', () => {
  render(
    <MemoryRouter>
      <Nav />
    </MemoryRouter>,
  )
  expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
    'Analyzer',
    'Play vs computer',
    'Chess960',
    'Game review',
  ])
})
