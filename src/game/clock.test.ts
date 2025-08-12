import { expect, it } from 'vitest'
import { createClock, flagged, pressClock, startClock, stopClock, timeLeft } from './clock'

const MIN = 60_000

it('runs only the side to move', () => {
  const clock = startClock(createClock(5 * MIN, 0), 'w', 0)
  expect(timeLeft(clock, 'w', 1500)).toBe(5 * MIN - 1500)
  expect(timeLeft(clock, 'b', 1500)).toBe(5 * MIN)
})

it('adds the increment to the side that moved and starts the other', () => {
  const clock = pressClock(startClock(createClock(3 * MIN, 2000), 'w', 0), 2000)
  expect(clock.remaining.w).toBe(3 * MIN)
  expect(clock.running).toBe('b')
  expect(clock.since).toBe(2000)
  expect(timeLeft(clock, 'b', 5000)).toBe(3 * MIN - 3000)
})

it('flags the side whose time is gone', () => {
  const clock = startClock(createClock(MIN, 0), 'w', 0)
  expect(flagged(clock, MIN - 1)).toBeNull()
  expect(flagged(clock, MIN)).toBe('w')
  expect(timeLeft(clock, 'w', 2 * MIN)).toBe(0)
})

it('freezes when stopped', () => {
  const clock = stopClock(startClock(createClock(MIN, 0), 'w', 0), 1000)
  expect(clock.running).toBeNull()
  expect(timeLeft(clock, 'w', 50_000)).toBe(MIN - 1000)
  expect(flagged(clock, 10 * MIN)).toBeNull()
})

it('ignores a press on a stopped clock', () => {
  const clock = createClock(MIN, 1000)
  expect(pressClock(clock, 5000)).toEqual(clock)
})
