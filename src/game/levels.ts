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

export type TimeControl =
  | { id: string; label: string; initialMs: number; incrementMs: number }
  | { id: 'untimed'; label: string }

const timed = (minutes: number, incrementS: number): TimeControl => ({
  id: `${minutes}+${incrementS}`,
  label: `${minutes}+${incrementS}`,
  initialMs: minutes * 60_000,
  incrementMs: incrementS * 1000,
})

export const TIME_CONTROLS: TimeControl[] = [
  timed(1, 0),
  timed(3, 2),
  timed(5, 0),
  timed(10, 0),
  timed(15, 10),
  { id: 'untimed', label: 'No clock' },
]

export const isTimed = (tc: TimeControl): tc is Extract<TimeControl, { initialMs: number }> => 'initialMs' in tc

export function pgnTimeControl(tc: TimeControl): string {
  return isTimed(tc) ? `${tc.initialMs / 1000}+${tc.incrementMs / 1000}` : '-'
}
