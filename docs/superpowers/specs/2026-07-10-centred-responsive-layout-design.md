# Centred responsive layout — design

Date: 2026-07-10
Status: approved, awaiting an implementation plan
Predecessors:
- `2026-07-09-chess-analyzer-design.md` (the analyzer, implemented)
- `2026-07-10-visual-layer-design.md` (the dark theme, implemented)

## Problem

The analyzer's content has no width limit and hugs the left edge. On a 1920px
monitor the right column (`flex-1`) stretches to nearly 1200px and the cards turn
into bedsheets. Below the breakpoint the columns stack, but they stay pinned to
the left rather than centred. Page padding is constant (24px) and eats a visible
share of a phone screen.

We bring the layout to the geometry of: a centring container,
a two-column grid of fixed widths, a centred stack on narrow screens.

## What was measured on the original

Taken with `getComputedStyle` on the live page, not eyeballed:

| Element | Classes |
| --- | --- |
| Page container | `mx-auto min-h-screen max-w-[1600px] p-3 sm:p-6` |
| Header inner | `container mx-auto px-4` |
| Content grid | `flex flex-col items-center gap-6 lg:gap-8`, then `xl:grid xl:grid-cols-[minmax(0,680px)_450px] xl:items-start xl:justify-center` |
| Board column | `order-1 flex w-full max-w-[650px] flex-1` |
| Right column | `order-2 flex w-full flex-col gap-4` |

The original's board is 632px.

## Decisions

### Container

`Shell` wraps its content in `<main className="mx-auto w-full max-w-[1600px] p-3 sm:p-6">`.

The header stays full-bleed (its background and bottom border run edge to edge),
but its inner row gets the same centring container. Otherwise the logo drifts to
the edge of the monitor while the content below it stays centred.

### Grid

`Analyzer` stops being a flex row with `flex-1` on the right column.

- By default: `flex flex-col items-center gap-6` — a centred stack.
- On a wide screen: `grid grid-cols-[minmax(0,680px)_450px] items-start justify-center`.

The right column is exactly `450px` and no longer stretches. The board column is
`680px`, which is precisely `640` (board) + `28` (eval bar) + `10` (gap).

**The board row must have a width that does not depend on the board.** Today it
is `flex shrink-0 gap-2.5`, i.e. it shrinks to its content. Left that way, the
formula `calc(100% - 2.375rem)` would reference a width that the board itself
defines — a circular dependency, which the browser resolves to zero. The row
becomes `flex w-full gap-2.5` inside a `w-full max-w-[680px]` wrapper, and
`shrink-0` is dropped.

Error messages (`role="alert"`) stay **above** the grid rather than inside it:
inside a `grid` they would become a third cell.

### The breakpoint moves from 1100px to 1280px

Two columns need `680 + 450 + 24` (gap) `+ 48` (padding) `= 1202px`. They do not
fit at 1100px. We set 1280px, matching the original's `xl`. A 1280×800 laptop
gets the two-column layout with nothing to spare; anything narrower gets the
centred stack.

The `--breakpoint-wide` token in `src/styles/index.css` changes from `1100px` to
`1280px`. The name `wide` is kept so the markup needs no rewrite.

### The board is decoupled from page padding

Today, on a narrow screen, `--board-size: min(100vw - 5.375rem, 640px)`, where
`5.375rem` is the page padding (`p-6` in `Shell`), the eval bar's width (`w-7`)
and the gap (`gap-2.5`) added up by hand — three values from three different
files. The branch's final review called this a landmine: changing `p-6` produces
horizontal scrolling and nothing catches it. Moving to `p-3 sm:p-6` breaks the
formula immediately.

Now that the board column has a width of its own, the board is sized **from its
parent** rather than from the window:

```css
.board-wrap {
  width: min(var(--board-max), calc(100% - 2.375rem));
  aspect-ratio: 1;
}
```

`2.375rem` is only the eval bar (`1.75rem`) and the gap (`0.625rem`) — exactly
what shares the row with the board. Page padding leaves the formula, because
`100%` already accounts for it. The media query for `--board-size` is deleted.

`--board-max` replaces `--board-size` and equals `min(80vh, 640px)` at every
width. On a narrow screen `calc(100% - 2.375rem)` takes over; on a wide one,
`80vh` or `640px` does.

**The position editor shows a board with no eval bar beside it.** The same
`.board-wrap` class would subtract 2.375rem there for an element that is not
present, and the board would be 38px narrower for no reason. So the subtrahend
moves into a variable with a fallback — `calc(100% - var(--row-extras, 2.375rem))` —
and the editor adds a modifier, `.board-wrap--solo { --row-extras: 0px }`.

### The eval bar stretches to the row

`EvalBar` stops setting its own height through `style={{ height: 'var(--board-size)' }}`
and takes `self-stretch` instead. The board sets the row's height. The two can no
longer drift apart by construction, rather than by agreement between two files.

## Files

- `src/ui/Shell.tsx` — centring container for `<main>` and for the header row.
- `src/pages/Analyzer.tsx` — a grid instead of a flex row; board column gets `max-w`.
- `src/styles/index.css` — `--breakpoint-wide: 1280px`; `--board-max` replaces
  `--board-size`; the media query is deleted.
- `src/ui/board.css` — `.board-wrap` sizes from its parent; `.board-wrap--solo`
  is added.
- `src/ui/EvalBar.tsx` — `self-stretch` instead of an inline height.
- `src/ui/PositionEditor.tsx` — the board gets `.board-wrap--solo`.
- `README.md` — the "Design" section names `--board-size`; rename it to
  `--board-max` and rewrite the sentence about where the size comes from.

Untouched: `src/engine/`, `src/game/`, `src/hooks/`.

## Testing

There is no behavioural code here, so no new unit tests are added. **All 88
existing tests must pass without a single edit**, including the five line-preview
tests in `src/pages/Analyzer.test.tsx` and the `EvalBar` tests.

Verification happens in the browser, at widths 1920, 1440, 1280, 1279, 1100, 768,
390. At each one:

- the page does not scroll horizontally;
- the content is centred (left and right gutters equal to the pixel);
- the board and the eval bar are the same height;
- at 1280 and above, two columns; at 1279 and below, a centred stack;
- the header tabs scroll horizontally when they do not fit.

**Measure the gutters against `document.documentElement.clientWidth`, not
`window.innerWidth`.** A vertical scrollbar counts towards `innerWidth` but not
towards the coordinate system of `getBoundingClientRect`. On the prototype this
produced a discrepancy of exactly 15px and a false conclusion that the content
was off-centre.

The layout was verified on a throwaway prototype before this plan was written: at
1920/1440/1280 it yields the grid, at 1279/1100/768/390 the centred stack; the
board is 640px everywhere except on a phone, where it is `390 - 24 - 38 = 328px`;
there is no horizontal scrolling at any width; board and eval bar heights match
everywhere.

## Out of scope

- We do not change the board's maximum width (640px) or the `min(80vh, 640px)` rule.
- We do not introduce a third breakpoint.
- We do not touch fonts, colours or palette tokens.
