import { expect, it } from 'vitest'
import { LEVELS, TIME_CONTROLS, customTimeControl, levelName, pgnTimeControl, resolveTimeControl, timeCategory } from './levels'

it('has eleven levels with honest labels', () => {
  expect(LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  expect(LEVELS.map((l) => l.label)).toEqual(['~800', '~1000', '~1200', '1350', '1500', '1700', '1900', '2100', '2400', '2700', 'Max'])
})

it('weakens the bottom levels with a growing node cap on the weakest setting', () => {
  const bottom = LEVELS.slice(0, 3)
  for (const l of bottom) expect(l.strength).toEqual({ limit: true, elo: 1320 })
  expect(bottom.map((l) => l.nodes)).toEqual([50, 300, 1500])
})

it('limits the middle levels by Elo, rising with the level', () => {
  const middle = LEVELS.slice(3, 10)
  for (const l of middle) {
    expect(l.strength.limit).toBe(true)
    expect(String(l.strength.elo)).toBe(l.label)
    expect(l.nodes).toBeUndefined()
  }
})

it('plays at full strength on the top level', () => {
  expect(LEVELS[10].strength).toEqual({ limit: false, skill: 20 })
  expect(LEVELS[10].nodes).toBeUndefined()
})

it('names the opponent after its level', () => {
  expect(levelName(LEVELS[4])).toBe('Stockfish · 1500')
  expect(levelName(LEVELS[0])).toBe('Stockfish · ~800')
  expect(levelName(LEVELS[10])).toBe('Stockfish · Max')
})

it('offers the usual time controls, from bullet to classical', () => {
  expect(TIME_CONTROLS.map((t) => t.id)).toEqual([
    '1+0', '2+1', '3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10', '30+0', '30+20', 'untimed',
  ])
})

it('names the category from the estimated game length', () => {
  const categories = TIME_CONTROLS.map((t) => ('category' in t ? t.category : null))
  expect(categories).toEqual([
    'Bullet', 'Bullet', 'Blitz', 'Blitz', 'Blitz', 'Blitz', 'Rapid', 'Rapid', 'Rapid', 'Classical', 'Classical', null,
  ])
  expect(timeCategory(2, 2)).toBe('Blitz')
  expect(timeCategory(20, 10)).toBe('Classical')
})

it('builds a custom time control, clamped to sane bounds', () => {
  expect(customTimeControl({ minutes: 12, increment: 3 })).toEqual({
    id: 'custom', label: '12+3', category: 'Rapid', initialMs: 720_000, incrementMs: 3000,
  })
  expect(customTimeControl({ minutes: 0, increment: -4 })).toMatchObject({ initialMs: 60_000, incrementMs: 0 })
  expect(customTimeControl({ minutes: 999, increment: 999 })).toMatchObject({ initialMs: 180 * 60_000, incrementMs: 60_000 })
})

it('resolves a stored choice to a time control', () => {
  const custom = { minutes: 7, increment: 2 }
  expect(resolveTimeControl('3+2', custom).id).toBe('3+2')
  expect(resolveTimeControl('untimed', custom).id).toBe('untimed')
  expect(resolveTimeControl('custom', custom)).toMatchObject({ label: '7+2', initialMs: 420_000 })
  expect(resolveTimeControl('7+7', custom).id).toBe('5+0')
})

it('writes PGN time controls', () => {
  const byId = (id: string) => TIME_CONTROLS.find((t) => t.id === id)!
  expect(pgnTimeControl(byId('5+0'))).toBe('300+0')
  expect(pgnTimeControl(byId('3+2'))).toBe('180+2')
  expect(pgnTimeControl(byId('untimed'))).toBe('-')
  expect(pgnTimeControl(customTimeControl({ minutes: 7, increment: 2 }))).toBe('420+2')
})
