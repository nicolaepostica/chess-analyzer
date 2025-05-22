import { describe, expect, it } from 'vitest'
import { gameAccuracy, moveAccuracy, winPercent } from './review'

describe('winPercent', () => {
  it('is 50 for an equal position', () => {
    expect(winPercent({ type: 'cp', value: 0 })).toBe(50)
  })

  it('follows the lichess curve', () => {
    expect(winPercent({ type: 'cp', value: 100 })).toBeCloseTo(59.1, 1)
    expect(winPercent({ type: 'cp', value: -100 })).toBeCloseTo(40.9, 1)
  })

  it('maps mate scores to 0 or 100', () => {
    expect(winPercent({ type: 'mate', value: 3 })).toBe(100)
    expect(winPercent({ type: 'mate', value: -2 })).toBe(0)
    expect(winPercent({ type: 'mate', value: 0 })).toBe(0)
  })

  it('clamps centipawns to ±1000', () => {
    expect(winPercent({ type: 'cp', value: 5000 })).toBe(winPercent({ type: 'cp', value: 1000 }))
    expect(winPercent({ type: 'cp', value: 1000 })).toBeLessThan(100)
  })
})

describe('moveAccuracy', () => {
  it('is 100 when nothing is lost', () => {
    expect(moveAccuracy(60, 60)).toBe(100)
    expect(moveAccuracy(60, 70)).toBe(100)
  })

  it('decays with the win% lost', () => {
    expect(moveAccuracy(70, 50)).toBeCloseTo(41.0, 0)
  })

  it('stays within 0..100', () => {
    expect(moveAccuracy(100, 0)).toBe(0)
  })
})

describe('gameAccuracy', () => {
  it('gives both sides 100 for a flat game', () => {
    expect(gameAccuracy([50, 50, 50, 50, 50], [false, false, false, false])).toEqual({
      white: 100,
      black: 100,
    })
  })

  it('penalises only the side that lost ground', () => {
    // Move 0 (White) keeps 50, move 1 (Black) keeps 50, move 2 (White) drops to 20.
    const result = gameAccuracy([50, 50, 50, 20, 20], [false, false, false, false])
    expect(result.black).toBe(100)
    expect(result.white).toBeLessThan(result.black)
  })

  it('excludes book moves', () => {
    const result = gameAccuracy([50, 50, 50, 20, 20], [false, false, true, false])
    expect(result.white).toBe(100)
  })

  it('starts counting from Black when Black moves first', () => {
    // Move 0 is Black's and loses ground for Black (White's win% rises).
    const result = gameAccuracy([50, 80, 80, 80], [false, false, false], 'b')
    expect(result.white).toBe(100)
    expect(result.black).toBeLessThan(100)
  })
})
