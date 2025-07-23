// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { EvalGraph } from './EvalGraph'
import { reviewedMove } from './review.fixtures'

const moves = [
  reviewedMove({ ply: 0, label: 'best' }),
  reviewedMove({ ply: 1, label: 'blunder' }),
  reviewedMove({ ply: 2, label: 'brilliant' }),
  reviewedMove({ ply: 3, label: 'inaccuracy' }),
]

it('draws one point per evaluated position', () => {
  render(<EvalGraph whiteWins={[50, 52, 20, 80, 75]} total={9} moves={moves} current={0} onSelect={() => {}} />)
  const line = screen.getByTestId('eval-graph').querySelector('polyline')!
  expect(line.getAttribute('points')!.trim().split(/\s+/)).toHaveLength(5)
})

it('renders before anything is evaluated', () => {
  render(<EvalGraph whiteWins={[]} total={9} moves={[]} current={0} onSelect={() => {}} />)
  expect(screen.getByTestId('eval-graph')).toBeInTheDocument()
})

it('marks notable moves', () => {
  render(<EvalGraph whiteWins={[50, 52, 20, 80, 75]} total={9} moves={moves} current={0} onSelect={() => {}} />)
  expect(screen.getAllByTestId('graph-marker')).toHaveLength(2)
})

it('jumps to the position under the click', () => {
  const onSelect = vi.fn()
  render(<EvalGraph whiteWins={[50, 52]} total={9} moves={[]} current={0} onSelect={onSelect} />)
  const svg = screen.getByTestId('eval-graph').querySelector('svg')!
  svg.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 100 }) as DOMRect
  fireEvent.click(svg, { clientX: 200 })
  expect(onSelect).toHaveBeenCalledWith(4)
})

it('marks the current position on the curve', () => {
  render(<EvalGraph whiteWins={[50, 52, 20, 80, 75]} total={5} moves={[]} current={2} onSelect={() => {}} />)
  const dot = screen.getByTestId('graph-current')
  expect(dot.style.left).toBe('50%')
  expect(dot.style.top).toBe('80%')
})

it('keeps the current marker inside the graph at the edges', () => {
  render(<EvalGraph whiteWins={[50, 52]} total={5} moves={[]} current={0} onSelect={() => {}} />)
  expect(parseFloat(screen.getByTestId('graph-current').style.left)).toBeGreaterThan(0)
})

it('hides the current marker until that position is evaluated', () => {
  render(<EvalGraph whiteWins={[50, 52]} total={5} moves={[]} current={4} onSelect={() => {}} />)
  expect(screen.queryByTestId('graph-current')).not.toBeInTheDocument()
})
