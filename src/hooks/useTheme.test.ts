// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { THEMES, useTheme } from './useTheme'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

it('defaults to Charcoal and applies it to the page', () => {
  const { result } = renderHook(() => useTheme())
  expect(result.current[0]).toBe('charcoal')
  expect(document.documentElement.dataset.theme).toBe('charcoal')
})

it('switches theme and remembers it', () => {
  const { result } = renderHook(() => useTheme())
  act(() => result.current[1]('wood'))
  expect(document.documentElement.dataset.theme).toBe('wood')
  expect(localStorage.getItem('chess-analyzer:theme')).toBe('wood')
  expect(renderHook(() => useTheme()).result.current[0]).toBe('wood')
})

it('ignores an unknown stored theme', () => {
  localStorage.setItem('chess-analyzer:theme', 'neon')
  expect(renderHook(() => useTheme()).result.current[0]).toBe('charcoal')
})

it('lists the three themes with names', () => {
  expect(THEMES.map((t) => [t.id, t.name])).toEqual([
    ['charcoal', 'Charcoal'],
    ['lichess', 'Lichess-style'],
    ['wood', 'Wood'],
  ])
})
