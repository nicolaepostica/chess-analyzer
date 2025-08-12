// A two-sided chess clock with Fischer increment. Pure: every function takes
// the current time and returns a new state.

export type Side = 'w' | 'b'
export type ClockState = { remaining: Record<Side, number>; incrementMs: number; running: Side | null; since: number }

const other = (side: Side): Side => (side === 'w' ? 'b' : 'w')

export function createClock(initialMs: number, incrementMs: number): ClockState {
  return { remaining: { w: initialMs, b: initialMs }, incrementMs, running: null, since: 0 }
}

export function startClock(clock: ClockState, side: Side, now: number): ClockState {
  return { ...clock, running: side, since: now }
}

/** Charges the running side for the time since it started. */
function charge(clock: ClockState, now: number): Record<Side, number> {
  if (!clock.running) return clock.remaining
  return { ...clock.remaining, [clock.running]: Math.max(0, clock.remaining[clock.running] - (now - clock.since)) }
}

/** The running side has moved: charge it, add its increment, start the other side. */
export function pressClock(clock: ClockState, now: number): ClockState {
  if (!clock.running) return clock
  const remaining = charge(clock, now)
  remaining[clock.running] += clock.incrementMs
  return { ...clock, remaining, running: other(clock.running), since: now }
}

export function stopClock(clock: ClockState, now: number): ClockState {
  return { ...clock, remaining: charge(clock, now), running: null, since: now }
}

export function timeLeft(clock: ClockState, side: Side, now: number): number {
  return side === clock.running ? charge(clock, now)[side] : clock.remaining[side]
}

export function flagged(clock: ClockState, now: number): Side | null {
  return clock.running && timeLeft(clock, clock.running, now) <= 0 ? clock.running : null
}
