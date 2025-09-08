// Opponent strength and time controls for play against the computer.
// Stockfish 18 lite: UCI_Elo 1320–3190, Skill Level 0–20. UCI_Elo's floor is
// about Skill Level 0, so the levels below it add a node cap to play weaker.
// Labels below 1320 and the effect of the node caps are estimates.

export type Strength = { limit: boolean; elo?: number; skill?: number }
export type Level = { level: number; label: string; elo: number | null; strength: Strength; nodes?: number }

const capped = (level: number, label: string, nodes: number): Level => ({
  level,
  label,
  elo: null,
  strength: { limit: true, elo: 1320 },
  nodes,
})
const rated = (level: number, elo: number): Level => ({ level, label: String(elo), elo, strength: { limit: true, elo } })

export const LEVELS: Level[] = [
  capped(1, '~800', 50),
  capped(2, '~1000', 300),
  capped(3, '~1200', 1500),
  rated(4, 1350),
  rated(5, 1500),
  rated(6, 1700),
  rated(7, 1900),
  rated(8, 2100),
  rated(9, 2400),
  rated(10, 2700),
  { level: 11, label: 'Max', elo: null, strength: { limit: false, skill: 20 } },
]

export function levelName(level: Level): string {
  return `Stockfish · ${level.label}`
}

export type TimeCategory = 'Bullet' | 'Blitz' | 'Rapid' | 'Classical'
export type TimeControl =
  | { id: string; label: string; category: TimeCategory; initialMs: number; incrementMs: number }
  | { id: 'untimed'; label: string }
export type CustomTime = { minutes: number; increment: number }

/** Lichess's split: estimated length is the base time plus 40 moves of increment. */
export function timeCategory(minutes: number, incrementS: number): TimeCategory {
  const seconds = minutes * 60 + 40 * incrementS
  if (seconds < 180) return 'Bullet'
  if (seconds < 480) return 'Blitz'
  if (seconds < 1500) return 'Rapid'
  return 'Classical'
}

const timed = (minutes: number, incrementS: number, id = `${minutes}+${incrementS}`): TimeControl => ({
  id,
  label: `${minutes}+${incrementS}`,
  category: timeCategory(minutes, incrementS),
  initialMs: minutes * 60_000,
  incrementMs: incrementS * 1000,
})

export const TIME_CONTROLS: TimeControl[] = [
  timed(1, 0),
  timed(2, 1),
  timed(3, 0),
  timed(3, 2),
  timed(5, 0),
  timed(5, 3),
  timed(10, 0),
  timed(10, 5),
  timed(15, 10),
  timed(30, 0),
  timed(30, 20),
  { id: 'untimed', label: 'No clock' },
]

export const CUSTOM_LIMITS = { minutes: { min: 1, max: 180 }, increment: { min: 0, max: 60 } }
const clampInt = (value: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)))

export function customTimeControl(custom: CustomTime): TimeControl {
  return timed(clampInt(custom.minutes, CUSTOM_LIMITS.minutes), clampInt(custom.increment, CUSTOM_LIMITS.increment), 'custom')
}

/** The stored choice ('5+0', 'untimed' or 'custom') as a time control; unknown ids fall back to 5+0. */
export function resolveTimeControl(id: string, custom: CustomTime): TimeControl {
  if (id === 'custom') return customTimeControl(custom)
  return TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS[4]
}

export const isTimed = (tc: TimeControl): tc is Extract<TimeControl, { initialMs: number }> => 'initialMs' in tc

export function pgnTimeControl(tc: TimeControl): string {
  return isTimed(tc) ? `${tc.initialMs / 1000}+${tc.incrementMs / 1000}` : '-'
}
