# Centred Responsive Layout Implementation Plan

> **For agentic workers:** work the tasks in order, one at a time. Steps are marked with checkboxes (`- [ ]`). Every task ends with a commit and a push.
>
> If your harness is Claude Code with the superpowers plugin, use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. If not, walk the steps top to bottom.

**Goal:** Centre the analyzer's content in a width-limited container, replace the fluid right column with a fixed-width grid, and decouple the board's size from the page padding.

**Architecture:** The shell gets `mx-auto max-w-[1600px]`. The analyzer becomes a centred stack, and on a wide screen a `[minmax(0,680px) 450px]` grid with `justify-center`. The board sizes from its column's width rather than from `100vw`, so page padding leaves the formula. The eval bar stretches to the row and cannot drift away from the board.

**Tech Stack:** Tailwind CSS v4, React 19, Vite 6, vitest.

**Spec:** `docs/specs/2026-07-10-centred-responsive-layout-design.md`

## Global Constraints

- **All 88 existing tests must pass without a single edit.** This work adds no new tests: there is no behaviour here, only layout.
- **Do not touch** `src/engine/`, `src/game/`, `src/hooks/`.
- Preserve the handles: `data-testid="eval-bar"`; `role="alert"` on both messages; the accessible button names `Load FEN`, `Load PGN`, `Back to game`, `Edit position`, `Apply`, `Cancel`, `Clear board`, `Eraser`; the `fen-input`, `pgn-input`, `depth`, `multipv` field ids; the `line-list`, `pv-move`, `position-editor`, `palette`, `editor-controls`, `board-wrap` classes.
- Dark theme only. Interface language is English. The `text-decor` class is forbidden (a test checks this).
- The board's maximum stays `min(80vh, 640px)`. The eval bar's width stays `w-7` (1.75rem) and the gap stays `gap-2.5` (0.625rem).
- We work on the `chess-analyzer-core` branch. Every task: commit + `git push`.

## Premises verified on a prototype

The layout was verified on a throwaway static prototype before this plan was written. At widths 1920/1440/1280 it yields the grid; at 1279/1100/768/390, the centred stack. The board is 640px everywhere except on a phone, where it is `390 - 24 - 38 = 328px`. There is no horizontal scrolling at any width. Board and eval bar heights match everywhere.

**Measure the gutters against `document.documentElement.clientWidth`, not `window.innerWidth`.** A vertical scrollbar counts towards `innerWidth` but not towards the coordinate system of `getBoundingClientRect`. On the prototype this produced a discrepancy of exactly 15px and a false conclusion that the content was off-centre.

---

### Task 1: A centring container in the shell

The safest part: the analyzer's layout does not change yet, so a regression shows up immediately.

**Files:**
- Modify: `src/ui/Shell.tsx`

**Interfaces:**
- Consumes: `Nav` from `./Nav`.
- Produces: a `<main>` and a header row constrained to `max-w-[1600px]` and centred.

- [ ] **Step 1: Rewrite `src/ui/Shell.tsx`**

The header stays full-bleed — its background and bottom border run edge to edge. Only its inner row is centred, with the same padding as `<main>`, or the logo and the board end up on different verticals.

```tsx
import type { ReactNode } from 'react'
import { Nav } from './Nav'

const CONTAINER = 'mx-auto w-full max-w-[1600px] px-3 sm:px-6'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-white/2 backdrop-blur">
        <div className={`${CONTAINER} flex h-15 items-center gap-7`}>
          <span className="font-display text-lg font-bold whitespace-nowrap">
            Chess<span className="text-accent">Analyzer</span>
          </span>
          <Nav />
        </div>
      </header>
      <main className={`${CONTAINER} py-3 sm:py-6`}>{children}</main>
    </div>
  )
}
```

Padding is now `12px` on a phone and `24px` from 640px of width up — as in the original (`p-3 sm:p-6`). The horizontal padding moved into a shared constant; the vertical padding is set separately, because the header sets its height through `h-15`.

- [ ] **Step 2: Verify**

Run: `npm test`
Expected: PASS, 88 tests. Not one test was edited.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: the build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/ui/Shell.tsx
git commit -m "feat(ui): centre the page in a max-width container"
git push
```

---

### Task 2: A grid instead of a fluid column

**Files:**
- Modify: `src/styles/index.css` (the `--breakpoint-wide` line only)
- Modify: `src/pages/Analyzer.tsx` (the `return` block only)

**Interfaces:**
- Consumes: `--breakpoint-wide` from `@theme`; the `EvalBar`, `Board`, `Card`, `DepthBadge`, `LineList`, `SettingsPanel`, `PositionInput` components.
- Produces: a board column of width `max-w-[680px]`, containing a `flex w-full gap-2.5` row — Task 3 will lean on that width.

- [ ] **Step 1: Move the breakpoint in `src/styles/index.css`**

Two columns need `680 + 450 + 24` (gap) `+ 48` (padding) `= 1202px`. They do not fit in the previous `1100px`.

Replace the line in the `@theme` block:

```css
  --breakpoint-wide: 1280px;
```

The name `wide` is kept, so the markup needs no rewrite.

- [ ] **Step 2: Rewrite the `return` block in `src/pages/Analyzer.tsx`**

The logic (`selectLine`, `onMove`, `loadGame`, `applyEditedFen`, `displayFen`, `displayTurn`, `previewing`, `dests`, `arrows`, `best`) and the early `return` for `editing` **do not change by a single line**. Only the markup below the `ALERT` constant changes.

```tsx
  return (
    <div className="flex flex-col gap-6">
      {/* Alerts live above the grid. Inside it they would become a third cell. */}
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

      <div className="flex flex-col items-center gap-6 wide:grid wide:grid-cols-[minmax(0,680px)_450px] wide:items-start wide:justify-center">
        {/* The wrapper gives the row a width that does not depend on the board:
            otherwise calc(100% - 2.375rem) in board.css would reference a width
            the board itself defines. */}
        <div className="w-full max-w-[680px]">
          <div className="flex w-full gap-2.5">
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
        </div>

        <div className="flex w-full min-w-0 max-w-[650px] flex-col gap-4 wide:max-w-none">
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

Three changes against the previous markup. The outer container became `flex flex-col items-center`, and on a wide screen a `grid` of two columns with `justify-center`. The board row lost `shrink-0` and gained `w-full` inside a `max-w-[680px]` wrapper. The right column lost `flex-1` and gained a `max-w-[650px]` that is lifted on a wide screen, where the grid column sets the width.

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: PASS, 88 tests. The five tests in `src/pages/Analyzer.test.tsx` are the main watchdog: they mock `Board` and check line preview, which a re-layout breaks easily.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles/index.css src/pages/Analyzer.tsx
git commit -m "feat(ui): lay the analyzer out as a centred two-column grid"
git push
```

---

### Task 3: The board sizes from its column

Here the landmine found by the final review disappears: `5.375rem` added up, by hand, the page padding, the eval bar's width and the gap — three values from three files. Task 1 already changed the padding to `p-3 sm:p-6`, so the old formula is wrong right now.

**Files:**
- Modify: `src/styles/index.css` (the `@layer base` block)
- Modify: `src/ui/board.css`
- Modify: `src/ui/EvalBar.tsx`
- Modify: `src/ui/PositionEditor.tsx`

**Interfaces:**
- Consumes: the `max-w-[680px]` wrapper and the `flex w-full gap-2.5` row from Task 2.
- Produces: the `--board-max` variable (replacing `--board-size`) and the `.board-wrap--solo` modifier class.

- [ ] **Step 1: Replace the variable in `src/styles/index.css`**

In the `@layer base` block, replace the `:root` declaration and **delete the media query entirely**:

```css
@layer base {
  :root {
    /* Upper bound only. The board's real width comes from its column, so the
       page padding never enters the formula. */
    --board-max: min(80vh, 640px);
    color-scheme: dark;
  }

  body {
```

That is, remove the `--board-size: min(80vh, 640px);` line together with its comment, and the whole block

```css
  @media (max-width: 1099px) {
    :root {
      --board-size: min(100vw - 5.375rem, 640px);
    }
  }
```

- [ ] **Step 2: Rewrite `src/ui/board.css`**

```css
@import 'chessground/assets/chessground.base.css';
@import 'chessground/assets/chessground.brown.css';
@import 'chessground/assets/chessground.cburnett.css';

.board-wrap {
  /* Sized from its column, never from the viewport. The only things sharing the
     board's row are the eval bar (1.75rem) and the gap beside it (0.625rem);
     the page padding is already accounted for by `100%`. */
  width: min(var(--board-max), calc(100% - var(--row-extras, 2.375rem)));
  aspect-ratio: 1;
  flex: none;
  border-radius: 6px;
  overflow: hidden;
}

/* The position editor shows the board with no eval bar beside it. */
.board-wrap--solo {
  --row-extras: 0px;
}
```

- [ ] **Step 3: Stretch the eval bar to the row in `src/ui/EvalBar.tsx`**

Remove the inline height, add `self-stretch`. The board sets the row's height, so the bar cannot end up taller or shorter than it — that is now a property of the layout rather than an agreement between two files.

Replace the opening `<div>` with:

```tsx
    <div
      data-testid="eval-bar"
      className={`relative w-7 shrink-0 self-stretch overflow-hidden rounded-md border border-border bg-well ${
        orientation === 'white' ? 'flex flex-col-reverse' : 'flex flex-col'
      }`}
    >
```

The `style` attribute is deleted entirely. Everything else in the component — the fill, the readout with its scrim, the `whiteWinProbability` and `formatScore` functions — is left alone.

- [ ] **Step 4: Mark the editor's board as solo**

In `src/ui/PositionEditor.tsx` replace

```tsx
      <div className="board-wrap" ref={element} />
```

with

```tsx
      <div className="board-wrap board-wrap--solo" ref={element} />
```

Without this, the editor's board would give up 38 pixels to an eval bar that is not beside it.

- [ ] **Step 5: Make sure the old variable survives nowhere**

Run: `grep -rn 'board-size' src/ README.md`
Expected: the only match is line 46 of `README.md`. It gets fixed in Task 4. If `grep` finds anything under `src/`, the edit is incomplete.

- [ ] **Step 6: Verify**

Run: `npm test`
Expected: PASS, 88 tests. The five `EvalBar.test.tsx` tests were not edited — they check the readout's text and classes, not its height.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/styles/index.css src/ui/board.css src/ui/EvalBar.tsx src/ui/PositionEditor.tsx
git commit -m "feat(ui): size the board from its column, stretch the eval bar to match"
git push
```

---

### Task 4: Browser check and README

The only task that needs a live browser. Layout is not covered by tests.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Start the app**

```bash
npm run dev
```

Open `http://localhost:5173` and wait for the engine to evaluate the starting position.

- [ ] **Step 2: Measure the layout at seven widths**

Resizing the browser window is unreliable: automation tools often fail to apply a viewport change to an already-open page. Instead, insert a same-origin iframe into the page and change **its** width — media queries inside an iframe respond to its own width, and `contentDocument` is reachable because the origin is shared.

Run in the browser console:

```js
window.__probe = (width) =>
  new Promise((resolve) => {
    let f = document.getElementById('probe')
    if (!f) {
      f = document.createElement('iframe')
      f.id = 'probe'
      f.src = '/'
      f.style.cssText = 'position:fixed;left:-9999px;top:0;height:900px;border:0'
      document.body.appendChild(f)
    }
    f.style.width = width + 'px'
    const read = () => {
      const d = f.contentDocument
      const w = f.contentWindow
      const board = d.querySelector('.board-wrap')
      if (!board) return setTimeout(read, 200)
      const layoutW = d.documentElement.clientWidth
      const bar = d.querySelector('[data-testid=eval-bar]').getBoundingClientRect()
      const b = board.getBoundingClientRect()
      // The nearest flex-col ancestor is the grid container. The outer page
      // container is flex-col too, so do not climb any higher.
      const grid = board.closest('.items-center')
      const c = grid.getBoundingClientRect()
      const left = Math.round(c.left)
      const right = Math.round(layoutW - c.right)
      resolve({
        width,
        layoutW,
        board: Math.round(b.width),
        sameHeight: Math.abs(b.height - bar.height) < 1,
        display: w.getComputedStyle(grid).display,
        gutters: [left, right],
        centred: Math.abs(left - right) <= 1,
        scrollsX: d.documentElement.scrollWidth > layoutW + 1,
      })
    }
    setTimeout(read, 400)
  })

// Run them in turn:
for (const w of [1920, 1440, 1280, 1279, 1100, 768, 390]) console.log(await window.__probe(w))
```

Expected at each width:

| Width | `display` | `board` | `centred` | `scrollsX` | `sameHeight` |
| --- | --- | --- | --- | --- | --- |
| 1920 | `grid` | 640 | `true` | `false` | `true` |
| 1440 | `grid` | 640 | `true` | `false` | `true` |
| 1280 | `grid` | 640 | `true` | `false` | `true` |
| 1279 | `flex` | 640 | `true` | `false` | `true` |
| 1100 | `flex` | 640 | `true` | `false` | `true` |
| 768 | `flex` | 640 | `true` | `false` | `true` |
| 390 | `flex` | 328 | `true` | `false` | `true` |

If `centred` is false and the `gutters` differ by exactly 15, you are measuring against `innerWidth` rather than `clientWidth`. The scrollbar counts towards the former and not the latter.

If `board` at 390 equals 366, then `.board-wrap--solo` has been applied to the analyzer's board and not only to the editor's.

- [ ] **Step 3: Check the position editor**

Click `Edit position`, then `Clear board`, then `Apply`.
Expected: the message `Invalid position: both kings must be on the board.` appears. The editor's board fills the whole width of its column, not 38px less.

- [ ] **Step 4: Check line preview**

Click the first move of the first line three times in a row.
Expected: the preview goes one ply deeper each time and the `Back to game` button does not disappear; clicking it brings back 32 pieces.

- [ ] **Step 5: Check the header**

Narrow the window until the five tabs no longer fit.
Expected: the tabs scroll horizontally; the page does not scroll sideways; the logo and the board's left edge sit on the same vertical.

- [ ] **Step 6: Update `README.md`**

Replace the paragraph

```markdown
The board's size is the CSS variable `--board-size`. The eval bar takes its
height from the same variable, so the two cannot drift apart.
```

with

```markdown
The page is centred in a `max-w-[1600px]` container. Above 1280px the analyzer
is a two-column grid; below it the columns stack, centred.

The board sizes itself from the width of its column, capped by `--board-max`
(`min(80vh, 640px)`). The eval bar stretches to the row, so the two cannot
drift apart — the page padding never enters the arithmetic.
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: describe the centred responsive layout"
git push
```

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| The `mx-auto max-w-[1600px] p-3 sm:p-6` container | 1 |
| Centring the header's inner row | 1 |
| The `[minmax(0,680px) 450px]` grid with `justify-center` | 2 |
| A centred stack below the breakpoint | 2 |
| The right column exactly 450px, no `flex-1` | 2 |
| The board row gains `w-full`, loses `shrink-0` | 2 |
| `role="alert"` messages stay above the grid | 2 |
| Breakpoint 1100px → 1280px | 2 |
| `--board-max` replaces `--board-size`, media query deleted | 3 |
| The board sizes from its parent | 3 |
| The eval bar gets `self-stretch` | 3 |
| The editor's board subtracts no eval bar | 3 |
| A check at seven widths through `clientWidth` | 4 |
| README | 4 |
| 88 tests pass unedited | checked in 1, 2, 3 |

## What this plan does not do

- It does not change the board's maximum (`min(80vh, 640px)`), the eval bar's width, or the gap.
- It does not introduce a third breakpoint.
- It does not touch fonts, colours or palette tokens.
- It adds no unit tests: there is no behaviour here, only layout.
