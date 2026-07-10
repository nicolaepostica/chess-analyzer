# Visual Layer Implementation Plan

> **For agentic workers:** work the tasks in order, one at a time. Steps are marked with checkboxes (`- [ ]`). Every task ends with a commit and a push.
>
> If your harness is Claude Code with the superpowers plugin, use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. If not, walk the steps top to bottom; it changes nothing.

**Goal:** Dress the working analyzer in the OduSphere dark palette: tokens, three fonts, a sticky header with pill tabs, cards in the right column, accessible focus, and narrow screens.

**Architecture:** Tailwind v4 reads the `@theme` block from a single file, `src/styles/index.css`, and generates utilities. The board's size lives in the `--board-size` CSS variable, and the eval bar's height is computed from the same one — they cannot drift apart. The logic (`engine/`, `game/`, `hooks/`) is not touched at all: if a repaint required changing it, an abstraction has leaked.

**Tech Stack:** Tailwind CSS v4, `@tailwindcss/vite`, `@fontsource` (Inter, Space Grotesk, JetBrains Mono), React 19, Vite 6, vitest.

**Spec:** `docs/superpowers/specs/2026-07-10-visual-layer-design.md`

## Global Constraints

- Exact versions: `tailwindcss@4.3.2`, `@tailwindcss/vite@4.3.2`, `@fontsource/inter@5.2.8`, `@fontsource/space-grotesk@5.2.10`, `@fontsource/jetbrains-mono@5.2.8`.
- **The existing 59 tests must pass without a single edit.** We change presentation, not behaviour. The one exception is Task 5, which **appends** five tests to `src/ui/EvalBar.test.tsx`, because restyling the bar introduces new behaviour (the score's colour depends on the fill). The five previous tests in that file do not change.
- **Do not touch** `src/engine/`, `src/game/`, `src/hooks/`. The one exception is that `useAnalysis` already returns `depth`; nothing needs adding.
- **Never set text in the `decor` colour (`#5B6184`).** The `text-decor` class is forbidden; a test checks this. The colour is only for dividers and disabled elements.
- The interface language is **English**. Do not translate the existing labels.
- The board's cap is `min(80vh, 640px)`; do not change it.
- Dark theme only. There is no light theme.
- Preserve the handles: `data-testid="eval-bar"`; `role="alert"` on every error message; the accessible button names `Load FEN`, `Load PGN`, `Back to game`, `Edit position`, `Apply`, `Cancel`, `Clear board`, `Eraser`; the `fen-input`, `pgn-input`, `depth`, `multipv` field ids with their `<label htmlFor>`; the `line-list`, `pv-move`, `position-editor`, `palette`, `editor-controls` classes.
- We work on the `chess-analyzer-core` branch. Every task: commit + `git push`.

## Environment premises

Verified on a live setup before this plan was written:

- `npx vite build` with `@tailwindcss/vite` succeeds; `@fontsource` fonts land in the bundle as `.woff2`.
- `@theme { --color-fg-muted: … }` produces `.text-fg-muted{color:var(--color-fg-muted)}`.
- `--font-display` produces `.font-display`.
- `ring-accent/35` produces `--tw-ring-color:#2dd4ff59`, i.e. the alpha modifier works on custom colours.

---

### Task 1: Tailwind, tokens and fonts

**Files:**
- Create: `src/styles/index.css`
- Modify: `vite.config.ts`
- Modify: `src/main.tsx`
- Modify: `src/ui/board.css`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the `bg-bg`, `bg-surface`, `border-border`, `text-fg`, `text-fg-secondary`, `text-fg-muted`, `text-accent`, `text-accent-alt`, `font-display`, `font-sans`, `font-mono` utilities; the `--board-size` and `--color-*` CSS variables; the `wide` breakpoint (1100px).

- [ ] **Step 1: Install the dependencies**

```bash
npm i -D tailwindcss@4.3.2 @tailwindcss/vite@4.3.2
npm i @fontsource/inter@5.2.8 @fontsource/space-grotesk@5.2.10 @fontsource/jetbrains-mono@5.2.8
```

The fonts go into `dependencies`, not `devDependencies`: their `@import` ends up in the production bundle.

- [ ] **Step 2: Wire the plugin into `vite.config.ts`**

Add the import and the plugin; leave everything else as is:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  test: {
    environment: 'node',
    testTimeout: 60_000,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 3: Create `src/styles/index.css`**

The token values come from the spec verbatim. `--color-fg-muted` is the lightened `#6E78A2`, not the original `#5B6184`: that one gives a contrast of 3.38:1 and fails WCAG AA. The threshold must hold on **both** backgrounds: the page and a card. The intermediate `#6E76A0` clears it on the page (4.62:1) but fails on a card (4.458:1).

```css
@import "tailwindcss";

@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/space-grotesk/500.css";
@import "@fontsource/space-grotesk/700.css";
@import "@fontsource/jetbrains-mono/400.css";
@import "@fontsource/jetbrains-mono/600.css";

@theme {
  --color-bg: #04050A;
  --color-surface: rgba(255, 255, 255, 0.024);
  --color-border: rgba(255, 255, 255, 0.08);
  --color-well: #11131C;

  --color-fg: #EEF0FA;
  --color-fg-secondary: #9AA1BD;
  --color-fg-muted: #6E78A2;

  --color-accent: #2DD4FF;
  --color-accent-alt: #7C83FF;
  --color-decor: #5B6184;

  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --breakpoint-wide: 1100px;
}

@layer base {
  :root {
    /* The single source of the board's size. The eval bar's height comes from
       here too, so the two cannot drift apart. */
    --board-size: min(80vh, 640px);
    color-scheme: dark;
  }

  /* On a narrow screen the window's height no longer constrains: the board sizes
     from the width, or it runs off a phone screen.
     We subtract not only the page padding (2 x 1.5rem) but also what shares the
     board's row: the eval bar (1.75rem) and the gap (0.625rem). 5.375rem total.
     Subtracting the padding alone means horizontal scrolling by exactly the
     bar's width plus the gap. */
  @media (max-width: 1099px) {
    :root {
      --board-size: min(100vw - 5.375rem, 640px);
    }
  }

  body {
    background-color: var(--color-bg);
    color: var(--color-fg);
    font-family: var(--font-sans);
  }

  /* Focus is invisible everywhere, because the buttons' default styles were stripped.
     A violet second accent, so the ring does not blend into the cyan active tab. */
  :focus-visible {
    outline: 2px solid var(--color-accent-alt);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 4: Import the styles in `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Tie the board to `--board-size` in `src/ui/board.css`**

The file stays plain CSS: it is the only place chessground's styles are imported, and they cannot move into utilities.

```css
@import 'chessground/assets/chessground.base.css';
@import 'chessground/assets/chessground.brown.css';
@import 'chessground/assets/chessground.cburnett.css';

.board-wrap {
  width: var(--board-size);
  aspect-ratio: 1;
  flex: none;
  border-radius: 6px;
  overflow: hidden;
}
```

- [ ] **Step 6: Check that the utilities are really generated**

```bash
npm run build
grep -c 'text-fg-muted' dist/assets/*.css
```

Expected: the build succeeds and `grep` prints `1` or more.

If it prints `0`, Tailwind did not see the plugin, or `index.css` is not imported from `main.tsx`.

- [ ] **Step 7: Check that nothing broke**

Run: `npm test`
Expected: PASS, 59 tests. Not one test was edited.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/main.tsx src/styles/index.css src/ui/board.css
git commit -m "feat(ui): add tailwind v4, design tokens and self-hosted fonts"
git push
```

---

### Task 2: A palette contrast test

The WCAG check becomes a test rather than a one-off measurement. An attempt to bring back a pretty but dim colour runs into a red build.

**Files:**
- Create: `src/styles/contrast.ts`
- Test: `src/styles/contrast.test.ts`

**Interfaces:**
- Consumes: `src/styles/index.css` (read from disk as text).
- Produces:
  - `type Rgb = { r: number; g: number; b: number }`
  - `function parseColor(value: string): { rgb: Rgb; alpha: number }`
  - `function compositeOver(fg: Rgb, alpha: number, bg: Rgb): Rgb`
  - `function relativeLuminance(rgb: Rgb): number`
  - `function contrastRatio(a: Rgb, b: Rgb): number`

- [ ] **Step 1: Write a failing test**

`src/styles/contrast.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compositeOver, contrastRatio, parseColor, relativeLuminance } from './contrast'

const css = readFileSync(fileURLToPath(new URL('./index.css', import.meta.url)), 'utf8')

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`token --color-${name} not found in index.css`)
  return match[1].trim()
}

const bg = parseColor(token('bg')).rgb
const surfaceRaw = parseColor(token('surface'))
const surface = compositeOver(surfaceRaw.rgb, surfaceRaw.alpha, bg)

const TEXT_TOKENS = ['fg', 'fg-secondary', 'fg-muted', 'accent', 'accent-alt'] as const

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

  it('composites a translucent surface over the page background', () => {
    expect(compositeOver({ r: 255, g: 255, b: 255 }, 0, bg)).toEqual(bg)
    expect(compositeOver({ r: 255, g: 255, b: 255 }, 1, bg)).toEqual({ r: 255, g: 255, b: 255 })
  })
})

describe('palette accessibility', () => {
  for (const name of TEXT_TOKENS) {
    it(`${name} meets WCAG AA on the page background`, () => {
      expect(contrastRatio(parseColor(token(name)).rgb, bg)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${name} meets WCAG AA on a card surface`, () => {
      expect(contrastRatio(parseColor(token(name)).rgb, surface)).toBeGreaterThanOrEqual(4.5)
    })
  }

  // #5B6184 is the muted tone. It yields 3.38:1 and is unfit for text.
  // This test pins exactly that: the colour stays in the palette, but for non-text use only.
  it('keeps the decorative tone below the text threshold, by design', () => {
    expect(contrastRatio(parseColor(token('decor')).rgb, bg)).toBeLessThan(4.5)
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/styles/contrast.test.ts`
Expected: FAIL — `Failed to resolve import "./contrast"`.

- [ ] **Step 3: Write `src/styles/contrast.ts`**

```ts
export type Rgb = { r: number; g: number; b: number }

const HEX = /^#([0-9a-f]{6})$/i
const RGBA = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i

export function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const trimmed = value.trim()

  const hex = trimmed.match(HEX)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { rgb: { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }, alpha: 1 }
  }

  const rgba = trimmed.match(RGBA)
  if (rgba) {
    return {
      rgb: { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) },
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    }
  }

  throw new Error(`Unsupported colour: ${value}`)
}

/** A translucent surface over a background yields the colour a human actually sees. */
export function compositeOver(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha))
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b) }
}

/** WCAG 2.1, the definition of relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run src/styles/contrast.test.ts`
Expected: PASS, 17 tests.

If `fg-muted meets WCAG AA on the page background` fails, the original `#5B6184` made it into `index.css`. If only `on a card surface` fails, the intermediate `#6E76A0` did — it clears the threshold on the page but not on a card.

- [ ] **Step 5: Add a guard test forbidding `text-decor`**

The spec's ban ("never set text in the `decor` colour") will not enforce itself. This test catches a violation on the very next run.

First extend the imports at the **top** of `src/styles/contrast.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
```

Then append to the end of the file:

```ts
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(tsx?|css)$/.test(entry) ? [full] : []
  })
}

it('never types text in the decorative tone', () => {
  const src = fileURLToPath(new URL('..', import.meta.url))
  const offenders = sourceFiles(src).filter((file) => {
    if (file.endsWith('contrast.test.ts')) return false
    return /\btext-decor\b/.test(readFileSync(file, 'utf8'))
  })
  expect(offenders).toEqual([])
})
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, 77 tests (59 previous + 18 new). Not one previous test was edited.

- [ ] **Step 7: Commit**

```bash
git add src/styles/contrast.ts src/styles/contrast.test.ts
git commit -m "test(ui): guard palette contrast against WCAG AA"
git push
```

---

### Task 3: The shell and pill tabs

**Files:**
- Create: `src/ui/Shell.tsx`
- Modify: `src/ui/Nav.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: the utilities from Task 1; `react-router`.
- Produces: `function Shell(props: { children: ReactNode }): JSX.Element`; `function Nav(): JSX.Element`.

- [ ] **Step 1: Rewrite `src/ui/Nav.tsx`**

Pills. The active one is translucent cyan; the inactive ones are the muted tone. `overflow-x-auto` instead of a hamburger: nobody builds a menu for five items.

```tsx
import { NavLink } from 'react-router'

const LINKS = [
  { to: '/', label: 'Analyzer' },
  { to: '/best-move', label: 'Best move' },
  { to: '/play', label: 'Play vs computer' },
  { to: '/freestyle', label: 'Chess960' },
  { to: '/import', label: 'Import game' },
]

const BASE = 'whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition-colors'

export function Nav() {
  return (
    <nav className="flex gap-1.5 overflow-x-auto">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end
          className={({ isActive }) =>
            isActive
              ? `${BASE} border-accent/35 bg-accent/10 text-fg`
              : `${BASE} border-transparent text-fg-muted hover:text-fg-secondary`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Create `src/ui/Shell.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Nav } from './Nav'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-white/2 backdrop-blur">
        <div className="flex h-15 items-center gap-7 px-6">
          <span className="font-display text-lg font-bold whitespace-nowrap">
            Chess<span className="text-accent">Analyzer</span>
          </span>
          <Nav />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Wrap the routes in `src/App.tsx`**

The stubs get their styling for free, because they live inside `Shell`.

```tsx
import { BrowserRouter, Route, Routes } from 'react-router'
import { Analyzer } from './pages/Analyzer'
import { BestMove } from './pages/BestMove'
import { Freestyle } from './pages/Freestyle'
import { ImportGame } from './pages/ImportGame'
import { PlayVsComputer } from './pages/PlayVsComputer'
import { Shell } from './ui/Shell'

export function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Analyzer />} />
          <Route path="/best-move" element={<BestMove />} />
          <Route path="/play" element={<PlayVsComputer />} />
          <Route path="/freestyle" element={<Freestyle />} />
          <Route path="/import" element={<ImportGame />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Style the four stubs**

All four share a structure. `src/pages/BestMove.tsx`:

```tsx
export function BestMove() {
  return (
    <p className="text-fg-secondary">
      Best-move search will arrive alongside the simplified analyzer interface.
    </p>
  )
}
```

`src/pages/PlayVsComputer.tsx`:

```tsx
export function PlayVsComputer() {
  return <p className="text-fg-secondary">Play against the computer will arrive in sub-project 2.</p>
}
```

`src/pages/Freestyle.tsx`:

```tsx
export function Freestyle() {
  return <p className="text-fg-secondary">Chess960 will arrive in sub-project 2.</p>
}
```

`src/pages/ImportGame.tsx`:

```tsx
export function ImportGame() {
  return <p className="text-fg-secondary">Game import will arrive in sub-project 3.</p>
}
```

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: PASS, 77 tests.

Run: `npm run dev`, open `http://localhost:5173/play`.
Expected: a dark background, a sticky header, the "Play vs computer" tab lit in cyan and the rest muted. Tab gives a visible violet ring on the tabs.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Shell.tsx src/ui/Nav.tsx src/App.tsx src/pages/
git commit -m "feat(ui): add app shell with pill navigation"
git push
```

---

### Task 4: The card

Removes the threefold duplication in the right column's markup.

**Files:**
- Create: `src/ui/Card.tsx`
- Create: `src/ui/DepthBadge.tsx`
- Test: `src/ui/DepthBadge.test.tsx`

**Interfaces:**
- Consumes: the utilities from Task 1.
- Produces:
  - `function Card(props: { title: string; aside?: ReactNode; children: ReactNode }): JSX.Element`
  - `function DepthBadge(props: { reached: number; target: number }): JSX.Element`

- [ ] **Step 1: Write a failing test for `DepthBadge`**

This is the `Depth` split the task exists for: today the interface prints `Depth: 18` twice, and there is no telling the requested depth from the reached one.

`src/ui/DepthBadge.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { DepthBadge } from './DepthBadge'

it('shows progress towards the requested depth', () => {
  render(<DepthBadge reached={12} target={18} />)
  expect(screen.getByTestId('depth-badge')).toHaveTextContent('depth 12/18')
})

it('shows a dash while the engine has not reported a depth yet', () => {
  render(<DepthBadge reached={0} target={18} />)
  expect(screen.getByTestId('depth-badge')).toHaveTextContent('depth —/18')
})

it('does not exceed the target when the engine overshoots', () => {
  render(<DepthBadge reached={20} target={18} />)
  expect(screen.getByTestId('depth-badge')).toHaveTextContent('depth 18/18')
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/ui/DepthBadge.test.tsx`
Expected: FAIL — `Failed to resolve import "./DepthBadge"`.

- [ ] **Step 3: Write `src/ui/DepthBadge.tsx`**

The engine sometimes reports a depth slightly above the requested one (it finishes the last iteration in full). Showing `20/18` is meaningless.

```tsx
export function DepthBadge({ reached, target }: { reached: number; target: number }) {
  const shown = reached === 0 ? '—' : String(Math.min(reached, target))

  return (
    <span data-testid="depth-badge" className="font-mono text-[13px] text-fg-muted tabular-nums">
      depth <b className="font-semibold text-accent">{shown}</b>/{target}
    </span>
  )
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run src/ui/DepthBadge.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write `src/ui/Card.tsx`**

```tsx
import type { ReactNode } from 'react'

export function Card({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface px-[18px] py-4">
      <div className="mb-3.5 flex items-center justify-between gap-4">
        <h2 className="font-display text-[15px] font-medium text-fg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, 80 tests.

- [ ] **Step 7: Commit**

```bash
git add src/ui/Card.tsx src/ui/DepthBadge.tsx src/ui/DepthBadge.test.tsx
git commit -m "feat(ui): add card and depth badge components"
git push
```

---

### Task 5: The eval bar

Right now its JSX has `#403d39`, `24px` and `min(80vh, 640px)` baked in — three magic values that must agree with the board but are connected to it by nothing.

**Files:**
- Modify: `src/ui/EvalBar.tsx`

**Interfaces:**
- Consumes: `--board-size` from Task 1; `Score` from `src/engine/uci`.
- Produces: the same public interface. `whiteWinProbability` and `formatScore` **do not change**.

- [ ] **Step 1: Rewrite `src/ui/EvalBar.tsx`**

The `whiteWinProbability` and `formatScore` exports are covered by tests and correct — they must not be touched. Only the markup changes.

```tsx
import type { Score } from '../engine/uci'

/** A logistic curve: 400 centipawns ≈ 76% expected score. */
export function whiteWinProbability(score: Score): number {
  if (score.type === 'mate') return score.value > 0 ? 1 : 0
  return 1 / (1 + Math.pow(10, -score.value / 400))
}

export function formatScore(score: Score): string {
  if (score.type === 'mate') {
    return score.value >= 0 ? `M${score.value}` : `-M${Math.abs(score.value)}`
  }
  const pawns = score.value / 100
  if (pawns === 0) return '0.00'
  return `${pawns > 0 ? '+' : '-'}${Math.abs(pawns).toFixed(2)}`
}

export function EvalBar({
  score,
  orientation,
}: {
  score: Score | null
  orientation: 'white' | 'black'
}) {
  const whiteShare = score ? whiteWinProbability(score) : 0.5

  return (
    <div
      data-testid="eval-bar"
      className={`relative w-7 shrink-0 overflow-hidden rounded-md border border-border bg-well ${
        orientation === 'white' ? 'flex flex-col-reverse' : 'flex flex-col'
      }`}
      style={{ height: 'var(--board-size)' }}
    >
      <div
        className="w-full bg-fg transition-[height] duration-200"
        style={{ height: `${whiteShare * 100}%` }}
      />
      {/*
        The readout sits at the bottom, so what lies under it — the light white
        fill or the dark bar body — depends on the orientation and on white's
        share. Neither a constant colour nor a share threshold works here: the
        filled/unfilled boundary is the readout's pixel height divided by the
        bar's, and the bar ranges from ~300px to 640px. So the text carries its
        own dark scrim: 16.3:1 over the body, 10.9:1 over the fill. No geometry
        needed.
      */}
      <span className="absolute inset-x-0.5 bottom-1 rounded-sm bg-well/85 py-px text-center font-mono text-[10px] font-semibold text-fg tabular-nums">
        {score ? formatScore(score) : '…'}
      </span>
    </div>
  )
}
```

The height comes from the same `--board-size` as the board, so the bar cannot end up taller or shorter than it.

The `z-1` class is unnecessary: the readout is absolutely positioned and the fill is static, so the readout paints on top by the ordinary stacking rules.

- [ ] **Step 2: Append a test for the readout's legibility**

Constant dark text is unreadable when the side the board faces is being mated: the fill is zero, and `#04050A` lands on `#11131C` — a contrast of 1.10:1. A threshold on white's share does not save it either, because the boundary depends on the bar's pixel height (for the white orientation it moves from 0.053 at 300px to 0.025 at 640px; for black, from 0.987 to 0.994). The scrim removes the question entirely.

The previous tests do not catch this, because they only look at `textContent`.

Append to `src/ui/EvalBar.test.tsx`:

```tsx
const readout = () => screen.getByTestId('eval-bar').querySelector('span')!

it('keeps the readout legible when White has collapsed and the fill is gone', () => {
  render(<EvalBar score={{ type: 'mate', value: -1 }} orientation="white" />)
  expect(readout()).toHaveClass('text-fg')
  expect(readout()).toHaveClass('bg-well/85')
})

it('keeps the readout legible when the fill covers the whole bar', () => {
  render(<EvalBar score={{ type: 'mate', value: 1 }} orientation="white" />)
  expect(readout()).toHaveClass('text-fg')
  expect(readout()).toHaveClass('bg-well/85')
})

it('never paints the readout in the page background colour', () => {
  render(<EvalBar score={{ type: 'cp', value: 650 }} orientation="black" />)
  expect(readout()).not.toHaveClass('text-bg')
})
```

The third test aims at the concrete failing case: the board is flipped to black, White is six and a half pawns better, and the fill has not reached the readout.

This is the one place in the whole plan where an existing test file is edited, and it is edited by appending, not by changing the previous tests.

- [ ] **Step 3: Verify**

Run: `npx vitest run src/ui/EvalBar.test.tsx`
Expected: PASS, 8 tests — five previous, unedited, and three new.

- [ ] **Step 4: Commit**

```bash
git add src/ui/EvalBar.tsx src/ui/EvalBar.test.tsx
git commit -m "feat(ui): restyle eval bar, keep the readout legible over any fill"
git push
```

---

### Task 6: The line list

**Files:**
- Modify: `src/ui/LineList.tsx`
- Delete: `src/ui/line-list.css`

**Interfaces:**
- Consumes: `EvalUpdate` from `src/engine/uci`; `formatScore` from `./EvalBar`.
- Produces: the same `LineList({ lines, onSelect })` interface.

- [ ] **Step 1: Rewrite `src/ui/LineList.tsx`**

The `line-list` and `pv-move` classes are preserved: the in-browser walkthrough navigates by them. The monospaced font and `tabular-nums` are not cosmetic — the score updates up to ten times a second, and with a proportional font the varying digit widths would make neighbouring elements twitch.

```tsx
import type { EvalUpdate } from '../engine/uci'
import { formatScore } from './EvalBar'

export type LineListProps = {
  lines: EvalUpdate[]
  onSelect: (line: EvalUpdate, plyCount: number) => void
}

export function LineList({ lines, onSelect }: LineListProps) {
  if (lines.length === 0) return <p className="py-2 text-sm text-fg-muted">Analyzing…</p>

  return (
    <ol className="line-list">
      {lines.map((line, index) => (
        <li
          key={line.multipv}
          className={`flex items-baseline gap-3 py-[7px] ${
            index > 0 ? 'border-t border-white/5' : ''
          }`}
        >
          <span className="w-2.5 shrink-0 text-xs text-fg-muted tabular-nums">{line.multipv}</span>
          <span
            className={`w-11 shrink-0 text-right font-mono text-[13px] tabular-nums ${
              index === 0 ? 'font-semibold text-accent' : 'text-fg-secondary'
            }`}
          >
            {formatScore(line.score)}
          </span>
          <span
            className={`flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[13px] ${
              index === 0 ? 'text-fg' : 'text-fg-secondary'
            }`}
          >
            {line.pv.slice(0, 8).map((move, ply) => (
              <button
                key={`${move}-${ply}`}
                type="button"
                className="pv-move rounded px-1 py-px hover:bg-white/6"
                onClick={() => onSelect(line, ply + 1)}
              >
                {move}
              </button>
            ))}
          </span>
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 2: Delete `src/ui/line-list.css`**

```bash
git rm --quiet src/ui/line-list.css
```

The `import './line-list.css'` is already absent from the component's new version.

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: PASS, 80 tests.

Run: `npx tsc --noEmit`
Expected: no errors. If it complains about a missing `./line-list.css`, the import survived.

- [ ] **Step 4: Commit**

```bash
git add src/ui/LineList.tsx
git commit -m "feat(ui): restyle line list with tailwind, drop its stylesheet"
git push
```

---

### Task 7: The analyzer's layout

Two spec items get fixed here as well: the duplicated `Depth` and the over-broad dimming.

**Files:**
- Modify: `src/pages/Analyzer.tsx`

**Interfaces:**
- Consumes: `Shell` (through `App`), `Card`, `DepthBadge`, `EvalBar`, `LineList`, `SettingsPanel`, `PositionInput`, `PositionEditor`, `Board`.
- Produces: nothing new outward.

- [ ] **Step 1: Rewrite the markup of `src/pages/Analyzer.tsx`**

The logic (`selectLine`, `onMove`, `loadGame`, `applyEditedFen`, `displayFen`, `displayTurn`) **does not change by a single line** — it is covered by five tests and contains a recently fixed preview bug. Only what `return` returns changes.

```tsx
import { useCallback, useMemo, useState } from 'react'
import type { Chess } from 'chess.js'
import type { EvalUpdate } from '../engine/uci'
import { createGame, getState, legalDests, tryMove } from '../game/game'
import { previewFen } from '../game/preview'
import { useAnalysis } from '../hooks/useAnalysis'
import { useSettings } from '../hooks/useSettings'
import { Board } from '../ui/Board'
import { Card } from '../ui/Card'
import { DepthBadge } from '../ui/DepthBadge'
import { EvalBar } from '../ui/EvalBar'
import { LineList } from '../ui/LineList'
import { PositionEditor } from '../ui/PositionEditor'
import { PositionInput } from '../ui/PositionInput'
import { SettingsPanel } from '../ui/SettingsPanel'
import { linesToArrows } from '../ui/arrows'

export function Analyzer() {
  const [game, setGame] = useState(() => createGame())
  const [state, setState] = useState(() => getState(game))
  const [preview, setPreview] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const dests = useMemo(() => legalDests(game), [state.fen])
  const [settings, updateSettings] = useSettings()
  const displayFen = preview ?? state.fen
  const previewing = preview !== null
  const displayTurn = displayFen.split(' ')[1] === 'w' ? 'white' : 'black'
  const analysis = useAnalysis(displayFen, settings)
  const arrows = useMemo(() => linesToArrows(analysis.lines), [analysis.lines])

  // Lines describe the position on screen, so walk them from there — not from
  // the game position, which may be several plies behind during a preview.
  // An unplayable line leaves the board where it is rather than snapping back.
  const selectLine = useCallback(
    (line: EvalUpdate, plyCount: number) => {
      const next = previewFen(displayFen, line.pv.slice(0, plyCount))
      if (next) setPreview(next)
    },
    [displayFen],
  )

  const onMove = useCallback(
    (from: string, to: string) => {
      setPreview(null)
      if (tryMove(game, from, to)) setState(getState(game))
    },
    [game],
  )

  const loadGame = useCallback((next: Chess) => {
    setPreview(null)
    setGame(next)
    setState(getState(next))
  }, [])

  const applyEditedFen = useCallback(
    (fen: string) => {
      setEditing(false)
      setPreview(null)
      loadGame(createGame(fen))
    },
    [loadGame],
  )

  const best = analysis.lines[0] ?? null

  if (editing) {
    return (
      <PositionEditor
        initialFen={state.fen}
        onApply={applyEditedFen}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const ALERT = 'rounded-lg border border-accent-alt/40 bg-accent-alt/10 p-3 text-sm'
  const SECONDARY_BUTTON =
    'rounded-lg border border-border bg-white/3 px-3.5 py-2 text-[13px] text-fg-secondary hover:text-fg'

  return (
    <div className="flex flex-col gap-6">
      {/* Alerts live ABOVE the columns. Inside wide:flex-row they would become
          a third column beside the board. */}
      {!analysis.multiThreaded && (
        <p role="alert" className={ALERT}>
          Multi-threaded engine unavailable (no cross-origin isolation). Falling back to the slower
          single-threaded build.
        </p>
      )}
      {analysis.error && (
        <p role="alert" className={ALERT}>
          {analysis.error}
        </p>
      )}

      <div className="flex flex-col gap-6 wide:flex-row wide:items-start">
        <div className="flex shrink-0 gap-2.5">
          <EvalBar score={best?.score ?? null} orientation="white" />
          <Board
            fen={displayFen}
            dests={previewing ? new Map() : dests}
            orientation="white"
            turn={displayTurn}
            arrows={arrows}
            onMove={onMove}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Card
            title="Stockfish 18"
            aside={<DepthBadge reached={analysis.depth} target={settings.depth} />}
          >
            {/* Dim only the numbers. The settings sliders are not stale, no reason to dim them. */}
            <div className={analysis.stale ? 'opacity-50' : undefined}>
              <LineList lines={analysis.lines} onSelect={selectLine} />
            </div>
            {previewing && (
              <button type="button" className={`mt-3 ${SECONDARY_BUTTON}`} onClick={() => setPreview(null)}>
                Back to game
              </button>
            )}
          </Card>

          <Card title="Settings">
            <SettingsPanel settings={settings} onChange={updateSettings} />
          </Card>

          <Card title="Position">
            <PositionInput onLoad={loadGame} />
            <button type="button" className={`mt-3 ${SECONDARY_BUTTON}`} onClick={() => setEditing(true)}>
              Edit position
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

The `<h1>Chess Analyzer</h1>` heading is gone: the logo lives in the header, and the original needed a big heading with a subtitle for search rankings.

`DepthBadge` receives `analysis.depth` (reached) and `settings.depth` (target) — the same two numbers that used to be printed as two indistinguishable `Depth: 18` lines.

- [ ] **Step 2: Check that behaviour did not drift**

Run: `npx vitest run src/pages/Analyzer.test.tsx`
Expected: PASS, 5 tests. The test file was not edited.

Those five tests check exactly what a re-layout breaks easily: showing the game position, entering a preview, deepening a preview, whose turn it is in the shown position, and returning to the game.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: PASS, 80 tests.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Analyzer.tsx
git commit -m "feat(ui): lay out analyzer, split target depth from reached depth"
git push
```

---

### Task 8: Settings and position input

**Files:**
- Modify: `src/ui/SettingsPanel.tsx`
- Modify: `src/ui/PositionInput.tsx`

**Interfaces:**
- Consumes: `AnalyzeOptions` from `src/engine/engine`; `isValidFen`, `createGame` from `src/game/game`; `loadPgn` from `src/game/pgn`.
- Produces: the same interfaces.

- [ ] **Step 1: Rewrite `src/ui/SettingsPanel.tsx`**

`id="depth"` and `id="multipv"` with their `<label htmlFor>` are preserved. The label becomes `Target depth` — now it is clear this is the request, not the fact.

```tsx
import type { AnalyzeOptions } from '../engine/engine'

const ROW = 'flex items-center gap-3.5'
const LABEL = 'w-30 shrink-0 text-[13px] text-fg-secondary'
const VALUE = 'w-6 shrink-0 text-right font-mono text-[13px] text-fg tabular-nums'
const RANGE = 'h-1 flex-1 cursor-pointer appearance-none rounded-sm bg-white/10 accent-accent'

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: AnalyzeOptions
  onChange: (patch: Partial<AnalyzeOptions>) => void
}) {
  return (
    <div className="settings flex flex-col gap-2.5">
      <div className={ROW}>
        <label htmlFor="depth" className={LABEL}>
          Target depth
        </label>
        <input
          id="depth"
          type="range"
          min={1}
          max={30}
          value={settings.depth}
          className={RANGE}
          onChange={(event) => onChange({ depth: Number(event.target.value) })}
        />
        <span className={VALUE}>{settings.depth}</span>
      </div>

      <div className={ROW}>
        <label htmlFor="multipv" className={LABEL}>
          Variations
        </label>
        <input
          id="multipv"
          type="range"
          min={1}
          max={5}
          value={settings.multiPV}
          className={RANGE}
          onChange={(event) => onChange({ multiPV: Number(event.target.value) })}
        />
        <span className={VALUE}>{settings.multiPV}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `src/ui/PositionInput.tsx`**

The accessible names `Load FEN` and `Load PGN`, the `id="fen-input"` and `id="pgn-input"`, and `role="alert"` are preserved — four tests hang on them.

```tsx
import type { Chess } from 'chess.js'
import { useState } from 'react'
import { createGame, isValidFen } from '../game/game'
import { loadPgn } from '../game/pgn'

const FIELD =
  'w-full rounded-lg border border-border bg-black/35 px-2.5 py-2 font-mono text-xs text-fg placeholder:text-fg-muted'
const BUTTON =
  'rounded-lg border border-border bg-white/3 px-3.5 py-2 text-[13px] text-fg-secondary hover:text-fg'

export type PositionInputProps = {
  onLoad: (game: Chess) => void
}

export function PositionInput({ onLoad }: PositionInputProps) {
  const [fen, setFen] = useState('')
  const [pgn, setPgn] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submitFen = () => {
    if (!isValidFen(fen.trim())) {
      setError('Invalid FEN')
      return
    }
    setError(null)
    onLoad(createGame(fen.trim()))
  }

  const submitPgn = () => {
    const result = loadPgn(pgn.trim())
    if (!result.ok) {
      setError(`Could not parse PGN: ${result.error}`)
      return
    }
    setError(null)
    onLoad(result.game)
  }

  return (
    <section className="position-input flex flex-col gap-2">
      <label htmlFor="fen-input" className="text-[13px] text-fg-secondary">
        FEN
      </label>
      <input id="fen-input" className={FIELD} value={fen} onChange={(e) => setFen(e.target.value)} />
      <button type="button" className={`${BUTTON} self-start`} onClick={submitFen}>
        Load FEN
      </button>

      <label htmlFor="pgn-input" className="mt-2 text-[13px] text-fg-secondary">
        PGN
      </label>
      <textarea
        id="pgn-input"
        rows={3}
        className={FIELD}
        value={pgn}
        onChange={(e) => setPgn(e.target.value)}
      />
      <button type="button" className={`${BUTTON} self-start`} onClick={submitPgn}>
        Load PGN
      </button>

      {error && (
        <p role="alert" className="text-[13px] text-accent-alt">
          {error}
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npx vitest run src/ui/PositionInput.test.tsx src/hooks/useSettings.test.ts`
Expected: PASS, 9 tests. The test files were not edited.

- [ ] **Step 4: Commit**

```bash
git add src/ui/SettingsPanel.tsx src/ui/PositionInput.tsx
git commit -m "feat(ui): restyle settings and position input"
git push
```

---

### Task 9: The position editor

**Files:**
- Modify: `src/ui/PositionEditor.tsx`

**Interfaces:**
- Consumes: `chessground`; `EMPTY_PLACEMENT`, `composeFen`, `validatePlacement` from `src/game/editor`.
- Produces: the same `PositionEditor({ initialFen, onApply, onCancel })` interface.

- [ ] **Step 1: Style `src/ui/PositionEditor.tsx`**

The `position-editor`, `palette`, `editor-controls` classes and the `Eraser`, `Clear board`, `Apply`, `Cancel` button names are preserved — the in-browser walkthrough navigates by them. The chessground initialization and `apply()` do not change.

Replace only `return (...)` with:

```tsx
  return (
    <section className="position-editor flex flex-col gap-4">
      <div className="board-wrap" ref={element} />

      <div className="palette flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={selected === null}
          onClick={() => setSelected(null)}
          className={`rounded-lg border px-3 py-2 text-[13px] ${
            selected === null
              ? 'border-accent/35 bg-accent/10 text-fg'
              : 'border-border bg-white/3 text-fg-secondary hover:text-fg'
          }`}
        >
          Eraser
        </button>
        {PIECES.map((piece) => (
          <button
            key={piece.key}
            type="button"
            aria-pressed={selected?.key === piece.key}
            onClick={() => setSelected(piece)}
            className={`h-10 w-10 rounded-lg border text-xl leading-none ${
              selected?.key === piece.key
                ? 'border-accent/35 bg-accent/10 text-fg'
                : 'border-border bg-white/3 text-fg-secondary hover:text-fg'
            }`}
          >
            {piece.label}
          </button>
        ))}
      </div>

      <div className="editor-controls flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-border bg-white/3 px-3.5 py-2 text-[13px] text-fg-secondary hover:text-fg"
          onClick={() => api.current?.set({ fen: EMPTY_PLACEMENT })}
        >
          Clear board
        </button>

        <label className="flex items-center gap-1.5 text-[13px] text-fg-secondary">
          <input
            type="radio"
            checked={turn === 'w'}
            onChange={() => setTurn('w')}
            className="accent-accent"
          />
          White to move
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-fg-secondary">
          <input
            type="radio"
            checked={turn === 'b'}
            onChange={() => setTurn('b')}
            className="accent-accent"
          />
          Black to move
        </label>

        <button
          type="button"
          className="rounded-lg border border-accent bg-accent px-3.5 py-2 text-[13px] font-semibold text-bg"
          onClick={apply}
        >
          Apply
        </button>
        <button
          type="button"
          className="rounded-lg border border-border bg-white/3 px-3.5 py-2 text-[13px] text-fg-secondary hover:text-fg"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-accent-alt">
          {error}
        </p>
      )}
    </section>
  )
```

- [ ] **Step 2: Verify**

Run: `npm test`
Expected: PASS, 80 tests.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/PositionEditor.tsx
git commit -m "feat(ui): restyle position editor"
git push
```

---

### Task 10: Browser check

The only task without tests: it checks what is cheaper to see than to describe. Needs a browser.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Build and run**

```bash
npm run build
npm run dev
```

Expected: the build succeeds and the dev server comes up.

- [ ] **Step 2: Check the analyzer on a wide screen**

Open `http://localhost:5173` in a window at least 1280 wide.

Expected:
- The background is near-black and the font is Inter, not Times.
- The header is sticky, the `ChessAnalyzer` logo has its second word in cyan, and the "Analyzer" tab is lit.
- The board is wooden, 640px, with the eval bar to its left at the same height and no gap at the bottom.
- The `Stockfish 18` card is on the right, its title carrying a `depth 18/18` counter that **climbs as the search runs** rather than appearing at once.
- The slider is called `Target depth`. The `Depth: 18` line no longer appears twice on screen.
- Three lines, the first with a cyan score. The moves are separated by a gap.

- [ ] **Step 3: Check the dimming**

Make a move on the board.

Expected: only the line list dims; the `Target depth` and `Variations` sliders stay at full brightness.

- [ ] **Step 4: Check line preview**

Click the first move of the first line, then the first move in the refreshed list, then once more.

Expected: the preview goes deeper each time and the `Back to game` button does not disappear. Clicking it puts all 32 pieces back.

- [ ] **Step 5: Check the editor**

Click `Edit position`, pick the queen, place it on `d4`, click `Clear board`, then `Apply`.

Expected: the message `Invalid position: both kings must be on the board.` appears in violet.

- [ ] **Step 6: Check the keyboard**

Press Tab starting from the address bar.

Expected: every interactive element — tabs, sliders, fields, buttons, moves within lines — receives a visible violet ring.

- [ ] **Step 7: Check a narrow screen**

Narrow the window to 900px.

Expected: the board and the cards stack, the board sizes from the width and does not run off the screen, and the header tabs scroll horizontally.

- [ ] **Step 8: Update `README.md`**

Replace the `## Tools` section with:

```markdown
## Tools

- `/` — position analyzer (live evaluation, MultiPV, best-move arrows, FEN/PGN
  input, position editor, line preview).
- `/best-move`, `/play`, `/freestyle`, `/import` — stubs for upcoming sub-projects
  (play vs. computer, Chess960, game import).

## Design

Dark theme only. Tokens live in
`src/styles/index.css` and their contrast is enforced by
`src/styles/contrast.test.ts`.
```

- [ ] **Step 9: Commit**

```bash
git add README.md
git commit -m "docs: describe the visual layer"
git push
```

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Tailwind v4, the Vite plugin | 1 |
| Palette tokens, `#6E78A2` instead of `#5B6184` | 1 |
| Three fonts through `@fontsource`, self-hosted | 1 |
| `--board-size` as the single source of the size | 1 |
| A focus ring in `accent-alt` | 1 |
| Narrow screens, the 1100px breakpoint | 1 (`--board-size`, breakpoint) and 7 (`wide:flex-row`) |
| A token contrast test | 2 |
| The `text-decor` ban | 2 |
| Sticky header, pill tabs, horizontal scroll | 3 |
| Stubs get their styling through `Shell` | 3 |
| The card, removing the threefold duplication | 4 |
| Splitting `Depth` into target and reached | 4 (`DepthBadge`) and 7 (wiring) |
| The eval bar without inline styles | 5 |
| The line list, deleting `line-list.css` | 6 |
| The analyzer's layout, dropping the big heading | 7 |
| Dimming only the numbers | 7 |
| `Target depth` instead of `Depth` | 8 |
| Styling the position input | 8 |
| Styling the position editor | 9 |
| Browser check, README | 10 |
| The 59 previous tests pass unedited | checked in 1, 5, 6, 7, 8, 9 |

## What this plan does not do

- A light theme. The tokens are ready for one: override `--color-*` under `:root[data-theme="light"]`.
- Animation beyond what the eval bar already has.
- An image logo: text only.
- The AI chat (sub-project 4). No card is reserved for it.
