// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { Nav } from './Nav'

it('links the main pages, without the unfinished ones', () => {
  render(
    <MemoryRouter>
      <Nav />
    </MemoryRouter>,
  )
  expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
    'Analyzer',
    'Play vs computer',
    'Game review',
  ])
})
