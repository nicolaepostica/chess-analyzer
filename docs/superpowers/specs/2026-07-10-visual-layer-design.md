# The analyzer's visual layer — design

Date: 2026-07-10
Status: approved, awaiting an implementation plan
Predecessor: `2026-07-09-chess-analyzer-design.md` (sub-project 1, implemented)

## Problem

The app has no design. Its own CSS runs to 31 non-blank lines, three of which are
`@import`s of chessground styles. Of the nine classes in the markup, only three
have any rules. The page font is `Times`, the buttons are system defaults, and
the whole layout rests on two inline `style={{}}` attributes.

We are building a visual layer: a layout modelled on, palette
and fonts , and a board that stays classic wood.

## Decisions taken during brainstorming

- **Palette and fonts only** from OduSphere. No gradient headings, no glow, no
  glass panels: the analyzer is a dense tool people sit in front of for hours,
  not a landing page.
- **Dark theme only.** OduSphere has no light theme, and we will not invent one.
- **The board stays classic wood** (`#f0d9b5` / `#b58863`), as chessground ships
  by default. The engine's green arrows stay green.
- **The board caps at 640px** — as today; the `min(80vh, 640px)` rule does not
  change. Verified on a true-scale mockup: at a 760 cap the right column shrinks
  to 424px and lines start wrapping onto two rows.
- **Tailwind CSS v4** as the way to write styles.
- **Fonts are self-hosted** through `@fontsource` (npm). They work offline and
  nothing leaves the machine. All three are SIL OFL, compatible with the
  project's GPL-3.0.
- **The interface language is English**, as in the existing code. No i18n.

## Palette

Taken (`getComputedStyle` over rendered
elements).

| Token | Value | Purpose |
| --- | --- | --- |
| `bg` | `#04050A` | page background |
| `surface` | `rgba(255,255,255,0.024)` | cards |
| `border` | `rgba(255,255,255,0.08)` | card and field borders |
| `fg` | `#EEF0FA` | primary text |
| `fg-secondary` | `#9AA1BD` | secondary text |
| `fg-muted` | `#6E78A2` | captions, inactive tabs |
| `accent` | `#2DD4FF` | active tab, best score, primary button |
| `accent-alt` | `#7C83FF` | focus ring only |
| `decor` | `#5B6184` | **non-text**: dividers, disabled elements |

### Contrast

Luminance ratios against the `#04050A` background, computed per WCAG 2.1:

| Pair | Ratio | Verdict |
| --- | --- | --- |
| `fg` on `bg` | 17.92:1 | AAA |
| `fg-secondary` on `bg` | 7.96:1 | AAA |
| `fg-muted` (`#6E78A2`) on `bg` | 4.72:1 | AA |
| `fg-muted` (`#6E78A2`) on a card | 4.56:1 | AA |
| `accent` on `bg` | 11.61:1 | AAA |
| `accent-alt` on `bg` | 6.35:1 | AA |
| `decor` (`#5B6184`) on `bg` | 3.38:1 | **below AA** |

OduSphere's original muted colour is `#5B6184`. On their landing page it sits
under large decorative lettering and gets away with it. In our interface it would
have to set 13px tabs and captions, which does not clear the AA threshold. So a
lightened `#6E78A2` is introduced for text, and `#5B6184` stays in the tokens
**for non-text purposes only**. That restriction is part of the spec, not a
suggestion.

The threshold must be checked against **both** backgrounds. The spec's first
draft named `#6E76A0`, because I only checked the page background (4.62:1).
Against the card background — that is, `surface` at 0.024 opacity composited over
`bg`, which yields `rgb(10, 11, 16)` — the same colour drops to **4.458:1** and
fails. `#6E78A2` gives 4.72:1 and 4.56:1 respectively. This is exactly why the
contrast test must check every text token against both surfaces, not just against
the page background.

## Typography

- **Space Grotesk** — logo, card titles.
- **Inter** — interface text.
- **JetBrains Mono** — anything that is a number or a move: score, depth, lines, FEN.

The monospaced font for numbers is not decoration here. The score updates up to
ten times a second; with a proportional font the varying digit widths would make
neighbouring elements twitch. For the same reason the eval bar and the score
column get `font-variant-numeric: tabular-nums`.

## Layout

Verified on a true-scale 1280×760 mockup.

**Header** (60px, sticky): the `ChessAnalyzer` logo (accent on the second word)
and five pill tabs. The active one has `fg` text, an `accent` background at 0.10
opacity, an `accent` border at 0.35. Inactive ones are `fg-muted`, borderless.

**Body**: two columns with a 24px gap and 24px outer padding. On the left, the
eval bar (28px) flush against the board (640px). On the right, a column (544px)
of three cards: engine, settings, position.

**Engine card**: title `Stockfish 18`, depth counter on the right. Below it, up
to five lines: number, score, moves. The first line has `fg` text and an `accent`
score. The rest are `fg-secondary`.

**There is no big heading with a subtitle.** has one for search
rankings, and we dropped SEO back in the first spec. The ~120px freed up go to
the board.

## Splitting `Depth`

Today the interface prints `Depth: 18` twice — as the settings slider's label
(`SettingsPanel.tsx:12`) and as the depth the engine has reached
(`Analyzer.tsx:98`). There is no telling them apart; the numbers matching is a
coincidence.

The data needed to separate them already exists, and no logic changes:
`settings.depth` is the target, `analysis.depth` is what was reached. The slider
is renamed `Target depth`, and the engine card shows `depth 12/18`, climbing as
the search runs.

## Dimming during a recalculation

Today `Analyzer.tsx` dims the entire right column through `opacity: 0.5`,
including the settings sliders, which are not stale. Only the numbers should dim:
the score, the depth, and the line list.

## Files

**Created**

- `src/styles/index.css` — `@import "tailwindcss"`, an `@theme` block with the
  tokens, imports of the three `@fontsource` fonts. The single entry point for
  styles.
- `src/ui/Shell.tsx` — the sticky header and the page container. All five routes
  wrap in it, so the stub pages get their styling for free.
- `src/ui/Card.tsx` — a card: a title plus an optional slot on the right (the
  depth counter goes there). Removes the threefold duplication in the right
  column's markup.
- `src/styles/contrast.ts` + a test — the WCAG luminance-ratio function.

**Modified**

- `vite.config.ts` — the `@tailwindcss/vite` plugin.
- `src/main.tsx` — import `styles/index.css`.
- `src/ui/EvalBar.tsx` — drop the inline styles (`#403d39` and `24px` are baked
  into the JSX). Leave `whiteWinProbability` and `formatScore` **alone**: they are
  covered by tests.
- `src/ui/Nav.tsx` — the chain of links becomes pills.
- `src/pages/Analyzer.tsx` — drop the two inline `style={{}}`, introduce the grid,
  separate `Depth`, narrow the dimming.
- `src/ui/SettingsPanel.tsx` — rename the label to `Target depth`, restyle.
- `src/ui/PositionInput.tsx`, `src/ui/PositionEditor.tsx` — styling only.
- `src/pages/*.tsx` (the four stubs) — styling through `Shell`.

**Deleted**

- `src/ui/line-list.css` — its rules move into Tailwind utilities.

**Stays plain CSS**

- `src/ui/board.css` — the only place chessground's styles are imported; they
  cannot move into utilities. It changes minimally: `.board-wrap` starts taking
  its width from a `--board-size` variable instead of repeating the
  `min(80vh, 640px)` formula. The eval bar's height is computed from the same
  variable, so the two cannot drift apart.

**Stays untouched**

- `src/engine/`, `src/game/`, `src/hooks/` — if a repaint required touching even
  one file in there, an abstraction has leaked.

## Narrow screens

One breakpoint: below 1100px the columns collapse into a stack — eval bar and
board on top, cards beneath. The board stops sizing from `80vh` and sizes from
the width, or it will run off a phone screen. The header tabs move into a
horizontal scroll: a hamburger for five items is unjustified.

**More than the page padding is subtracted from the width.** Sharing the board's
row are the eval bar (1.75rem) and the gap between them (0.625rem), plus 1.5rem
of page padding on each side. That totals `--board-size: min(100vw - 5.375rem, 640px)`.
Subtracting only the padding (`3rem`) makes the page scroll sideways on a phone
by exactly the bar's width plus the gap — 14px in a 390px window. Verified in a
browser.

## Focus and keyboard

Right now focus is invisible everywhere: the buttons' default styles were
stripped. Every interactive element gets a focus ring in `accent-alt` (`#7C83FF`).
The second accent exists precisely for this, so the ring does not blend into the
cyan active tab.

Moves within lines are already buttons, hence reachable from the keyboard; they
only need a visible state.

## Testing

**A new test — token contrast.** The function computes the luminance ratio, and
the test asserts that every text pair clears 4.5:1. An attempt to bring back a
pretty but dim colour runs into a red build rather than into someone's vigilance.

**The eval bar: the score always sits on a scrim of its own.** The number is
printed at the bar's bottom edge. Beneath it lies either the light white fill or
the dark body — depending on the board's orientation and white's share.

A constant text colour is wrong: when the side the board faces is being mated,
the fill is zero, and dark text on the body gives a contrast of 1.10:1. A
threshold on white's share is wrong too, though less obviously: the filled /
unfilled boundary equals the readout's pixel height divided by the bar's height,
and the bar ranges from ~300px to 640px. For the white orientation the threshold
moves from 0.053 to 0.025; for black, from 0.987 to 0.994. No single number
exists.

So the readout gets a semi-transparent dark scrim of its own (`bg-well/85`) and
light text: 16.3:1 over the body, 10.9:1 over the fill. No geometry to know, no
thresholds. This is the one place where tests are appended to an existing test
file.

**The existing 59 tests must pass without a single edit.** We are changing
presentation, not behaviour. That is the main check that the module boundaries
were drawn correctly. There is exactly one exception, named above: tests are
**appended** in `src/ui/EvalBar.test.tsx`, and the old ones are left alone. The
interface language stays English, so `PositionInput.test.tsx` (which looks for a
`Load FEN` button) and `Analyzer.test.tsx` (which mocks `Board` by its `fen` and
`turn` props) are unaffected.

Restyling must not tear out the handles that tests and screen readers hold on to.
These are preserved:

- `data-testid="eval-bar"` on the eval bar;
- `role="alert"` on error messages (invalid FEN, invalid PGN, a position with no
  kings, an engine crash, no multi-threading);
- accessible button names: `Load FEN`, `Load PGN`, `Back to game`,
  `Edit position`, `Apply`, `Cancel`, `Clear board`, `Eraser`;
- the `fen-input`, `pgn-input`, `depth`, `multipv` field `id`s and their
  associated `<label htmlFor>`;
- the `line-list`, `pv-move`, `position-editor`, `palette`, `editor-controls`
  classes — the in-browser walkthrough navigates by them.

**The visual side is not covered by tests.** Instead, a browser pass down a list:
analyzer, position editor, line preview, narrow screen, keyboard traversal.

## Dependencies

Checked for existence and compatibility:

- `tailwindcss@4.3.2`
- `@tailwindcss/vite@4.3.2` (peer: `vite ^5.2 || ^6 || ^7 || ^8` — our Vite 6 fits)
- `@fontsource/inter@5.2.8`
- `@fontsource/space-grotesk@5.2.10`
- `@fontsource/jetbrains-mono@5.2.8`

## Deliberately out of scope

- A light theme.
- Animation beyond what the eval bar already has.
- An image logo: text only.
- The AI chat: it remains sub-project 4, and no card is reserved for it.

Everything listed gets layered on top of the tokens later and is not part of this
spec.
