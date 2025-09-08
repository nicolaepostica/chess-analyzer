// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { DEFAULT_PLAY_SETTINGS, usePlaySettings } from './usePlaySettings'

const KEY = 'chess-analyzer:play'
beforeEach(() => localStorage.clear())

it('starts from the defaults', () => {
  const { result } = renderHook(() => usePlaySettings())
  expect(result.current[0]).toEqual({ level: 5, color: 'random', timeControl: '5+0', custom: { minutes: 10, increment: 0 } })
  expect(DEFAULT_PLAY_SETTINGS).toEqual(result.current[0])
})

it('persists changes and reads them back', () => {
  const first = renderHook(() => usePlaySettings())
  act(() => first.result.current[1]({ level: 9, timeControl: '3+2' }))
  expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ level: 9, timeControl: '3+2' })
  const second = renderHook(() => usePlaySettings())
  expect(second.result.current[0]).toMatchObject({ level: 9, color: 'random', timeControl: '3+2' })
})

it('falls back per field on bad stored values', () => {
  localStorage.setItem(KEY, JSON.stringify({ level: 99, color: 'b', timeControl: '7+7' }))
  const { result } = renderHook(() => usePlaySettings())
  expect(result.current[0]).toMatchObject({ level: 5, color: 'b', timeControl: '5+0' })
})

it('falls back to the defaults on garbage', () => {
  localStorage.setItem(KEY, 'not json')
  const { result } = renderHook(() => usePlaySettings())
  expect(result.current[0]).toEqual(DEFAULT_PLAY_SETTINGS)
})

it('remembers a custom time control', () => {
  const first = renderHook(() => usePlaySettings())
  act(() => first.result.current[1]({ timeControl: 'custom', custom: { minutes: 7, increment: 2 } }))
  const second = renderHook(() => usePlaySettings())
  expect(second.result.current[0]).toMatchObject({ timeControl: 'custom', custom: { minutes: 7, increment: 2 } })
})

it('falls back on a broken custom time control', () => {
  localStorage.setItem(KEY, JSON.stringify({ timeControl: 'custom', custom: { minutes: 'x' } }))
  const { result } = renderHook(() => usePlaySettings())
  expect(result.current[0]).toMatchObject({ timeControl: 'custom', custom: { minutes: 10, increment: 0 } })
})
