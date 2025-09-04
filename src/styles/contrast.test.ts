import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compositeOver, contrastRatio, parseColor, relativeLuminance } from './contrast'

const css = readFileSync(fileURLToPath(new URL('./index.css', import.meta.url)), 'utf8')

// Charcoal lives in the @theme block (the default); every other theme overrides
// colour tokens in a [data-theme="…"] block. A token a theme leaves out falls
// back to the default, exactly as the cascade does in the browser.
const THEMES = ['charcoal', 'lichess', 'wood'] as const
type Theme = (typeof THEMES)[number]

function block(theme: Theme): string {
  if (theme === 'charcoal') return css.match(/@theme\s*{([^}]*)}/)?.[1] ?? ''
  const match = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*{([^}]*)}`))
  if (!match) throw new Error(`theme ${theme} not found in index.css`)
  return match[1]
}

function token(name: string, theme: Theme = 'charcoal'): string {
  for (const source of [block(theme), block('charcoal')]) {
    const match = source.match(new RegExp(`--color-${name}:\\s*([^;]+);`))
    if (match) return match[1].trim()
  }
  throw new Error(`token --color-${name} not found for theme ${theme}`)
}

function backgrounds(theme: Theme) {
  const bg = parseColor(token('bg', theme)).rgb
  const surfaceRaw = parseColor(token('surface', theme))
  return { bg, surface: compositeOver(surfaceRaw.rgb, surfaceRaw.alpha, bg) }
}

const { bg } = backgrounds('charcoal')

const TEXT_TOKENS = [
  'fg',
  'fg-secondary',
  'fg-muted',
  'accent',
  'accent-alt',
  'label-brilliant',
  'label-great',
  'label-best',
  'label-book',
  'label-inaccuracy',
  'label-mistake',
  'label-miss',
  'label-blunder',
] as const

describe('colour maths', () => {
  it('parses hex', () => {
    expect(parseColor('#04050A')).toEqual({ rgb: { r: 4, g: 5, b: 10 }, alpha: 1 })
  })

  it('parses rgba', () => {
    expect(parseColor('rgba(255, 255, 255, 0.024)')).toEqual({
      rgb: { r: 255, g: 255, b: 255 },
      alpha: 0.024,
    })
  })

  it('computes known luminances', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5)
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5)
  })

  it('computes the canonical black-on-white ratio', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 2)
  })

  it('is symmetric', () => {
    const a = { r: 4, g: 5, b: 10 }
    const b = { r: 238, g: 240, b: 250 }
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10)
  })

  // The three tests above cannot fail on a wrong implementation: contrastRatio
  // sorts the luminances before dividing, so symmetry holds for any function,
  // and white maps to 1 and black to 0 under any monotonic curve. These pin the
  // curve and the channel weights themselves.

  it('applies the sRGB gamma curve, not a linear ramp', () => {
    // A linear ramp would give 0.5019…
    expect(relativeLuminance({ r: 128, g: 128, b: 128 })).toBeCloseTo(0.215861, 6)
  })

  it('weights the channels per WCAG, not equally', () => {
    // Swapping the red and green coefficients would give 0.7152 for pure red.
    expect(relativeLuminance({ r: 255, g: 0, b: 0 })).toBeCloseTo(0.2126, 6)
    expect(relativeLuminance({ r: 0, g: 255, b: 0 })).toBeCloseTo(0.7152, 6)
    expect(relativeLuminance({ r: 0, g: 0, b: 255 })).toBeCloseTo(0.0722, 6)
  })

  it('computes known mid-tone ratios', () => {
    const grey = { r: 128, g: 128, b: 128 }
    expect(contrastRatio(grey, { r: 255, g: 255, b: 255 })).toBeCloseTo(3.9494, 3)
    expect(contrastRatio(grey, { r: 0, g: 0, b: 0 })).toBeCloseTo(5.3172, 3)
  })

  it('composites a translucent surface over the page background', () => {
    expect(compositeOver({ r: 255, g: 255, b: 255 }, 0, bg)).toEqual(bg)
    expect(compositeOver({ r: 255, g: 255, b: 255 }, 1, bg)).toEqual({ r: 255, g: 255, b: 255 })
  })
})

for (const theme of THEMES) {
  describe(`${theme} theme accessibility`, () => {
    const { bg, surface } = backgrounds(theme)
    for (const name of TEXT_TOKENS) {
      it(`${name} meets WCAG AA on the page background`, () => {
        expect(contrastRatio(parseColor(token(name, theme)).rgb, bg)).toBeGreaterThanOrEqual(4.5)
      })

      it(`${name} meets WCAG AA on a card surface`, () => {
        expect(contrastRatio(parseColor(token(name, theme)).rgb, surface)).toBeGreaterThanOrEqual(4.5)
      })
    }

    // The decorative tone stays in the palette for borders and ornaments only.
    it('keeps the decorative tone below the text threshold, by design', () => {
      expect(contrastRatio(parseColor(token('decor', theme)).rgb, bg)).toBeLessThan(4.5)
    })
  })
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(tsx?|css)$/.test(entry) ? [full] : []
  })
}

// The decorative tone can reach text three ways: the Tailwind utility, the raw
// variable in an inline style, and the literal hex in an arbitrary value.
const DECOR_HEXES = THEMES.map((theme) => token('decor', theme).replace('#', '\\#'))
const DECOR_IN_TEXT = new RegExp(`\\btext-decor\\b|var\\(\\s*--color-decor\\s*\\)|${DECOR_HEXES.join('|')}`, 'i')

// contrast.test.ts names all three patterns; index.css legitimately defines the token.
const ALLOWED_TO_NAME_IT = ['contrast.test.ts', 'index.css']

it('never types text in the decorative tone', () => {
  const src = fileURLToPath(new URL('..', import.meta.url))
  const offenders = sourceFiles(src).filter((file) => {
    if (ALLOWED_TO_NAME_IT.some((allowed) => file.endsWith(allowed))) return false
    return DECOR_IN_TEXT.test(readFileSync(file, 'utf8'))
  })
  expect(offenders).toEqual([])
})
