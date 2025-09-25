# Chess Analyzer Core — Implementation Plan

> **For agentic workers:** work the tasks in order, one at a time. Steps are marked with checkboxes (`- [ ]`) for tracking. Every task ends with a commit and does not depend on which agent runs it, or in what environment.
>
> If your harness is Claude Code with the superpowers plugin, use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. If not, just walk the steps top to bottom; it changes nothing.

**Goal:** A local browser chess analyzer: a board, Stockfish 18 in a Web Worker, live position evaluation, an eval bar, best-move arrows, FEN/PGN input.

**Architecture:** Three modules with hard boundaries. `engine/` knows about UCI and WASM but not about React. `game/` knows the rules of chess but neither the engine nor the DOM. `ui/` holds React components that receive data as props. A single hook, `useAnalysis`, binds them together. The `EngineTransport` seam lets the engine run both in the browser (Worker) and in tests (Node).

**Tech Stack:** Vite, React 19, TypeScript, vitest, `stockfish@18.0.8`, `chess.js@1.4.0`, `chessground@9.2.1`.

**Spec:** `docs/specs/2026-07-09-chess-analyzer-design.md`

## Global Constraints

- All dependencies are pinned to exact versions: `stockfish@18.0.8`, `chess.js@1.4.0`, `chessground@9.2.1`.
- The engine build is `lite` only (7 MB). The full build (113 MB) is never used.
- The project's license is GPL-3.0 (a Stockfish requirement). Do not add dependencies with incompatible licenses.
- `engine/` does not import React. `game/` imports neither `engine/` nor React. Breaking these boundaries is grounds to reject the task at review.
- The mate-in-one test position is used throughout this plan: FEN `6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1`, the correct move `a1a8`, the score `{ type: 'mate', value: 1 }`.
- Every task ends with a commit **and a push** (`git push`).
- We work on the `chess-analyzer-core` branch, cut from `main`. On finishing Task 14, open a pull request into `main`. We do not commit to `main` directly.
- The old bot and the labelled dataset are preserved on the `legacy-chessdotcom-bot` branch (pushed to origin). Nothing is reused from them.
- Commit messages follow Conventional Commits (`feat:`, `fix:`), as in the plan's steps. The `[module]` rule from the global `CLAUDE.md` applies only to Odoo addons and does not apply here.

## Environment premises

Verified at the time this plan was written:

| Requirement | Verified version | How to check |
| --- | --- | --- |
| Node.js ≥ 20 | 24.14.0 | `node -v` |
| npm ≥ 10 | 11.9.0 | `npm -v` |
| git | 2.39.2 | `git --version` |
| Network to registry.npmjs.org | — | `npm ping` |

The listed dependency set resolves with no peer conflicts: `vite@6.4.3`,
`vitest@4.1.10`, `@vitejs/plugin-react@4.7.0`, `react@19.2.7`. Separately
verified: the Vite dev server with the config from Task 1 really does serve the
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` headers.

## Steps that need a browser

Nine steps are marked "Check by hand" and need a live browser: Task 6/4,
7/10, 8/6, 9/6, 10/7, 11/7, 12/7, 13/7, 14/7. They are deliberately not covered
by automated tests — they check piece dragging, arrow rendering and animation,
which are cheaper to see than to describe.

**If you have no browser:** do everything else, mark these steps as skipped, and
list them explicitly in your task report. Do not mark a task done while staying
quiet about a skipped check. The automated part of every task
(`npx vitest run ...`) is entirely self-sufficient and needs no browser.

The one exception is Task 1, where the isolation check can and should be
automated through `curl` (see its Step 8).

---

### Task 1: Scaffold the project and remove the old code

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`
- Modify: `.gitignore`
- Create: `scripts/copy-stockfish.js`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm run dev` and `npm test`; engine files in `public/stockfish/`.

- [ ] **Step 1: Confirm the repository is clean**

The old Python bot is already removed from `main` (commit "Remove chess.com bot")
and preserved on the `legacy-chessdotcom-bot` branch. No separate removal step is
needed — only a check of the starting state.

Run: `git ls-files`
Expected: exactly these entries — `.gitignore`, `LICENSE`, `README.md` and two
files under `docs/`. If you see `main.py` or `extensions/`, you are not on `main`.

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "chess-analyzer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "license": "GPL-3.0",
  "scripts": {
    "dev": "npm run copy-stockfish && vite",
    "build": "npm run copy-stockfish && tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "copy-stockfish": "node scripts/copy-stockfish.js"
  },
  "dependencies": {
    "chess.js": "1.4.0",
    "chessground": "9.2.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "stockfish": "18.0.8",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^4.0.0"
  }
}
```

`stockfish` sits in devDependencies: at runtime the browser loads files from `public/`, not from `node_modules`. The package needs it only for copying and for the Node tests.

- [ ] **Step 3: Create `scripts/copy-stockfish.js`**

The engine files (7 MB) are not committed — they are copied from `node_modules` on every `dev`/`build`.

```js
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const binDir = join(dirname(require.resolve('stockfish/package.json')), 'bin')
const outDir = join(process.cwd(), 'public', 'stockfish')

const FILES = [
  'stockfish-18-lite.js',
  'stockfish-18-lite.wasm',
  'stockfish-18-lite-single.js',
  'stockfish-18-lite-single.wasm',
]

mkdirSync(outDir, { recursive: true })
for (const file of FILES) {
  const src = join(binDir, file)
  if (!existsSync(src)) throw new Error(`Missing engine file: ${src}`)
  copyFileSync(src, join(outDir, file))
}
console.log(`Copied ${FILES.length} engine files to ${outDir}`)
```

- [ ] **Step 4: Create `vite.config.ts` with the COOP/COEP headers**

Without these headers `SharedArrayBuffer` is unavailable and the multi-threaded build will not start.

`defineConfig` is imported from `vitest/config` rather than from `vite`: only that one types the `test` block.

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  test: {
    environment: 'node',
    testTimeout: 60_000,
  },
})
```

`testTimeout` is raised: loading 7 MB of WASM in Node takes a noticeable while.

- [ ] **Step 5: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "scripts", "vite.config.ts"]
}
```

- [ ] **Step 6: Create `index.html`, `src/main.tsx`, `src/App.tsx`**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chess Analyzer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx`:

```tsx
export function App() {
  return (
    <main>
      <h1>Chess Analyzer</h1>
      <p>crossOriginIsolated: {String(window.crossOriginIsolated)}</p>
    </main>
  )
}
```

- [ ] **Step 7: Replace `.gitignore`**

The existing file describes a Python project. Replace its contents entirely:

```gitignore
node_modules/
dist/
public/stockfish/
.DS_Store
```

`public/stockfish/` is not committed: 14 MB of binaries that `npm run dev` copies
out of `node_modules` on its own.

- [ ] **Step 8: Install the dependencies and check isolation**

```bash
npm install
```

The check needs no browser: `crossOriginIsolated` in the browser follows directly from the two headers, and `curl` can see those.

```bash
npm run dev > /tmp/vite.log 2>&1 &
until curl -sf -o /dev/null http://localhost:5173/; do sleep 0.25; done
curl -sI http://localhost:5173/ | grep -i cross-origin
kill %1
```

Expected — exactly two lines:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

If the lines are absent, do not go on: the multi-threaded engine will not start and the reason will be far from obvious.

Additionally, if a browser is available: open `http://localhost:5173` and confirm the page shows `crossOriginIsolated: true`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TS"
git push
```

---

### Task 2: The UCI parser

The most brittle part of the system, and the only one that can be tested in full without the engine.

**Files:**
- Create: `src/engine/uci.ts`
- Test: `src/engine/uci.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Score = { type: 'cp' | 'mate'; value: number }`
  - `type EvalUpdate = { depth: number; multipv: number; score: Score; pv: string[] }`
  - `type UciMessage = { kind: 'info'; update: EvalUpdate } | { kind: 'bestmove'; move: string } | { kind: 'uciok' } | { kind: 'readyok' } | { kind: 'other' }`
  - `function parseUciLine(line: string): UciMessage`

- [ ] **Step 1: Write a failing test**

The lines are taken from real `stockfish@18.0.8` output; they are not invented.

`src/engine/uci.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseUciLine } from './uci'

describe('parseUciLine', () => {
  it('parses an info line with a centipawn score', () => {
    const line =
      'info depth 12 seldepth 17 multipv 3 score cp 616 nodes 29259 nps 328752 hashfull 7 time 89 pv a1e1 h7h6 g1f1'
    expect(parseUciLine(line)).toEqual({
      kind: 'info',
      update: {
        depth: 12,
        multipv: 3,
        score: { type: 'cp', value: 616 },
        pv: ['a1e1', 'h7h6', 'g1f1'],
      },
    })
  })

  it('parses an info line with a mate score', () => {
    const line = 'info depth 1 seldepth 2 multipv 1 score mate 1 nodes 82 nps 8200 time 10 pv a1a8'
    expect(parseUciLine(line)).toEqual({
      kind: 'info',
      update: {
        depth: 1,
        multipv: 1,
        score: { type: 'mate', value: 1 },
        pv: ['a1a8'],
      },
    })
  })

  it('defaults multipv to 1 when the engine omits it', () => {
    const line = 'info depth 5 score cp 20 nodes 100 pv e2e4'
    const result = parseUciLine(line)
    expect(result.kind === 'info' && result.update.multipv).toBe(1)
  })

  it('does not confuse seldepth with depth', () => {
    const line = 'info seldepth 30 depth 4 score cp 10 pv e2e4'
    const result = parseUciLine(line)
    expect(result.kind === 'info' && result.update.depth).toBe(4)
  })

  it('parses a negative mate score (the side to move is getting mated)', () => {
    const line = 'info depth 8 multipv 1 score mate -3 pv e1e2'
    const result = parseUciLine(line)
    expect(result.kind === 'info' && result.update.score).toEqual({ type: 'mate', value: -3 })
  })

  it('tolerates lowerbound between the score and the next token', () => {
    const line = 'info depth 9 multipv 1 score cp 33 lowerbound nodes 500 pv d2d4'
    const result = parseUciLine(line)
    expect(result.kind === 'info' && result.update.score).toEqual({ type: 'cp', value: 33 })
  })

  it('parses bestmove', () => {
    expect(parseUciLine('bestmove a1a8')).toEqual({ kind: 'bestmove', move: 'a1a8' })
  })

  it('parses bestmove with a ponder move', () => {
    expect(parseUciLine('bestmove e2e4 ponder e7e5')).toEqual({ kind: 'bestmove', move: 'e2e4' })
  })

  it('parses handshake replies', () => {
    expect(parseUciLine('uciok')).toEqual({ kind: 'uciok' })
    expect(parseUciLine('readyok')).toEqual({ kind: 'readyok' })
  })

  it('returns other for info lines without a score or pv', () => {
    expect(parseUciLine('info depth 1 currmove e2e4 currmovenumber 1').kind).toBe('other')
    expect(parseUciLine('info string NNUE evaluation using nn-x.nnue').kind).toBe('other')
    expect(parseUciLine('info depth 20 score cp 15 nodes 100').kind).toBe('other')
  })

  it('returns other for engine banner and option lines', () => {
    expect(parseUciLine('Stockfish 18 Lite WASM by the Stockfish developers').kind).toBe('other')
    expect(parseUciLine('option name MultiPV type spin default 1 min 1 max 500').kind).toBe('other')
  })

  it('returns other for bestmove without a move', () => {
    expect(parseUciLine('bestmove').kind).toBe('other')
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/engine/uci.test.ts`
Expected: FAIL — `Failed to resolve import "./uci"`.

- [ ] **Step 3: Write the minimal implementation**

`src/engine/uci.ts`:

```ts
export type Score = { type: 'cp' | 'mate'; value: number }

export type EvalUpdate = {
  depth: number
  multipv: number
  score: Score
  pv: string[]
}

export type UciMessage =
  | { kind: 'info'; update: EvalUpdate }
  | { kind: 'bestmove'; move: string }
  | { kind: 'uciok' }
  | { kind: 'readyok' }
  | { kind: 'other' }

const OTHER: UciMessage = { kind: 'other' }

export function parseUciLine(line: string): UciMessage {
  const trimmed = line.trim()

  if (trimmed === 'uciok') return { kind: 'uciok' }
  if (trimmed === 'readyok') return { kind: 'readyok' }

  if (trimmed === 'bestmove' || trimmed.startsWith('bestmove ')) {
    const move = trimmed.split(/\s+/)[1]
    return move ? { kind: 'bestmove', move } : OTHER
  }

  if (!trimmed.startsWith('info ')) return OTHER

  const tokens = trimmed.split(/\s+/)
  const scoreIndex = tokens.indexOf('score')
  const pvIndex = tokens.indexOf('pv')
  const depth = readInt(tokens, 'depth')

  if (depth === null || scoreIndex === -1 || pvIndex === -1) return OTHER

  const scoreType = tokens[scoreIndex + 1]
  const scoreValue = Number(tokens[scoreIndex + 2])
  if (scoreType !== 'cp' && scoreType !== 'mate') return OTHER
  if (!Number.isFinite(scoreValue)) return OTHER

  const pv = tokens.slice(pvIndex + 1)
  if (pv.length === 0) return OTHER

  return {
    kind: 'info',
    update: {
      depth,
      multipv: readInt(tokens, 'multipv') ?? 1,
      score: { type: scoreType, value: scoreValue },
      pv,
    },
  }
}

function readInt(tokens: string[], key: string): number | null {
  const index = tokens.indexOf(key)
  if (index === -1) return null
  const value = Number(tokens[index + 1])
  return Number.isInteger(value) ? value : null
}
```

`tokens.indexOf('depth')` compares whole tokens, so `seldepth` will not match. For the same reason `multipv` will not be mistaken for `pv`.

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/engine/uci.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/uci.ts src/engine/uci.test.ts
git commit -m "feat(engine): add UCI line parser"
git push
```

---

### Task 3: The engine transport

The seam between `engine.ts` and the concrete way Stockfish is launched. It is what makes the engine testable in Node, without a browser.

**Files:**
- Create: `src/engine/transport.ts`
- Create: `src/engine/transport.node.ts`
- Create: `src/engine/stockfish.d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface EngineTransport { send(command: string): void; onLine(handler: (line: string) => void): void; terminate(): void }`
  - `function createWorkerTransport(scriptUrl: string): EngineTransport`
  - `function selectEngineUrl(): string` — returns the path to the multi-threaded build when `crossOriginIsolated`, otherwise the single-threaded one
  - `async function createNodeTransport(flavor?: string): Promise<EngineTransport>`

- [ ] **Step 1: Create `src/engine/stockfish.d.ts`**

The `stockfish` package ships no types.

```ts
declare module 'stockfish' {
  interface StockfishEngine {
    sendCommand(command: string): void
    listener: (line: string) => void
  }
  function initEngine(flavor?: string): Promise<StockfishEngine>
  export = initEngine
}
```

- [ ] **Step 2: Create `src/engine/transport.ts`**

```ts
export interface EngineTransport {
  send(command: string): void
  onLine(handler: (line: string) => void): void
  terminate(): void
}

const MULTI_THREADED = '/stockfish/stockfish-18-lite.js'
const SINGLE_THREADED = '/stockfish/stockfish-18-lite-single.js'

/**
 * The multi-threaded build needs SharedArrayBuffer, which is only available in a
 * cross-origin isolated context (the COOP/COEP headers).
 */
export function selectEngineUrl(): string {
  return globalThis.crossOriginIsolated ? MULTI_THREADED : SINGLE_THREADED
}

export function isMultiThreaded(): boolean {
  return selectEngineUrl() === MULTI_THREADED
}

export function createWorkerTransport(scriptUrl: string = selectEngineUrl()): EngineTransport {
  const worker = new Worker(scriptUrl)
  let handler: (line: string) => void = () => {}

  worker.onmessage = (event: MessageEvent) => {
    if (typeof event.data === 'string') handler(event.data)
  }

  return {
    send: (command) => worker.postMessage(command),
    onLine: (next) => {
      handler = next
    },
    terminate: () => worker.terminate(),
  }
}
```

`stockfish-18-lite.js` calls `postMessage(line)` for every output line itself — that is its normal mode of operation as a worker script. No wrapper needs writing.

- [ ] **Step 3: Create `src/engine/transport.node.ts`**

```ts
import { createRequire } from 'node:module'
import type { EngineTransport } from './transport'

const require = createRequire(import.meta.url)

/** Tests only. This file never reaches the browser. */
export async function createNodeTransport(flavor = 'lite-single'): Promise<EngineTransport> {
  const initEngine = require('stockfish') as (flavor?: string) => Promise<{
    sendCommand(command: string): void
    listener: (line: string) => void
  }>

  const engine = await initEngine(flavor)
  let handler: (line: string) => void = () => {}
  engine.listener = (line) => handler(line)

  return {
    send: (command) => engine.sendCommand(command),
    onLine: (next) => {
      handler = next
    },
    terminate: () => {},
  }
}
```

- [ ] **Step 4: Write a smoke test for the Node transport**

It proves the transport really talks to the engine, before `engine.ts` even exists.

`src/engine/transport.node.test.ts`:

```ts
import { expect, it } from 'vitest'
import { createNodeTransport } from './transport.node'

const MATE_IN_ONE = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'

it('sends commands to the engine and receives its output', async () => {
  const transport = await createNodeTransport()

  const bestmove = new Promise<string>((resolve) => {
    transport.onLine((line) => {
      if (line.startsWith('bestmove')) resolve(line)
    })
  })

  transport.send('uci')
  transport.send(`position fen ${MATE_IN_ONE}`)
  transport.send('go depth 8')

  expect(await bestmove).toBe('bestmove a1a8')
})
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npx vitest run src/engine/transport.node.test.ts`
Expected: PASS, 1 test. It takes a few seconds — 7 MB of WASM is loading.

- [ ] **Step 6: Commit**

```bash
git add src/engine/transport.ts src/engine/transport.node.ts src/engine/transport.node.test.ts src/engine/stockfish.d.ts
git commit -m "feat(engine): add worker and node transports"
git push
```

---

### Task 4: The engine's public interface

All the difficulty of interrupting a search lives here. A mistake shows up as "the score from the previous position" — rarely, and hard to catch.

**Files:**
- Create: `src/engine/engine.ts`
- Test: `src/engine/engine.test.ts`

**Interfaces:**
- Consumes: `parseUciLine`, `EvalUpdate`, `UciMessage` from `./uci`; `EngineTransport` from `./transport`; `createNodeTransport` from `./transport.node` (in the test only).
- Produces:
  - `type AnalyzeOptions = { depth: number; multiPV: number; chess960: boolean }`
  - `interface Engine { analyze(fen: string, options: AnalyzeOptions): AsyncIterable<EvalUpdate>; stop(): void; terminate(): void }`
  - `function createEngine(transport: EngineTransport): Engine`

- [ ] **Step 1: Write a failing test**

`src/engine/engine.test.ts`:

```ts
import { afterEach, expect, it } from 'vitest'
import { createEngine, type Engine } from './engine'
import { createNodeTransport } from './transport.node'
import type { EvalUpdate } from './uci'

const MATE_IN_ONE = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

let engine: Engine | null = null

afterEach(() => {
  engine?.terminate()
  engine = null
})

async function collect(iterable: AsyncIterable<EvalUpdate>): Promise<EvalUpdate[]> {
  const updates: EvalUpdate[] = []
  for await (const update of iterable) updates.push(update)
  return updates
}

it('finds mate in one and ends the iteration on bestmove', async () => {
  engine = createEngine(await createNodeTransport())
  const updates = await collect(engine.analyze(MATE_IN_ONE, { depth: 10, multiPV: 1, chess960: false }))

  expect(updates.length).toBeGreaterThan(0)
  const last = updates.at(-1)!
  expect(last.score).toEqual({ type: 'mate', value: 1 })
  expect(last.pv[0]).toBe('a1a8')
})

it('reports the requested number of variations', async () => {
  engine = createEngine(await createNodeTransport())
  const updates = await collect(engine.analyze(START, { depth: 8, multiPV: 3, chess960: false }))

  const seen = new Set(updates.map((update) => update.multipv))
  expect(seen).toEqual(new Set([1, 2, 3]))
})

it('never leaks updates from an abandoned search into the next one', async () => {
  engine = createEngine(await createNodeTransport())

  // Abandon a deep search of the starting position after the very first update.
  for await (const _ of engine.analyze(START, { depth: 30, multiPV: 1, chess960: false })) break

  // The next analysis must speak only about the new position.
  const updates = await collect(engine.analyze(MATE_IN_ONE, { depth: 10, multiPV: 1, chess960: false }))
  expect(updates.at(-1)!.score).toEqual({ type: 'mate', value: 1 })
  expect(updates.every((update) => update.pv[0] === 'a1a8')).toBe(true)
})

it('stop() ends the current search early', async () => {
  engine = createEngine(await createNodeTransport())
  const updates: EvalUpdate[] = []

  const iterable = engine.analyze(START, { depth: 40, multiPV: 1, chess960: false })
  setTimeout(() => engine!.stop(), 300)
  for await (const update of iterable) updates.push(update)

  // A depth-40 search would take minutes; it finished, so stop worked.
  expect(updates.length).toBeGreaterThan(0)
  expect(updates.at(-1)!.depth).toBeLessThan(40)
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/engine/engine.test.ts`
Expected: FAIL — `Failed to resolve import "./engine"`.

- [ ] **Step 3: Write the implementation**

`src/engine/engine.ts`:

```ts
import { parseUciLine, type EvalUpdate, type UciMessage } from './uci'
import type { EngineTransport } from './transport'

export type AnalyzeOptions = {
  depth: number
  multiPV: number
  chess960: boolean
}

export interface Engine {
  analyze(fen: string, options: AnalyzeOptions): AsyncIterable<EvalUpdate>
  stop(): void
  terminate(): void
}

type Subscriber = (message: UciMessage) => void

export function createEngine(transport: EngineTransport): Engine {
  const subscribers = new Set<Subscriber>()

  transport.onLine((line) => {
    const message = parseUciLine(line)
    for (const subscriber of [...subscribers]) subscriber(message)
  })

  transport.send('uci')

  // Searches run strictly one at a time. Each next one waits until the previous
  // has seen its bestmove — otherwise the engine answers about the old position.
  let previousSearch: Promise<void> = Promise.resolve()
  let searchActive = false

  function stop(): void {
    if (searchActive) transport.send('stop')
  }

  async function* analyze(fen: string, options: AnalyzeOptions): AsyncIterable<EvalUpdate> {
    const waitForPrevious = previousSearch
    let releaseThisSearch!: () => void
    previousSearch = new Promise<void>((resolve) => {
      releaseThisSearch = resolve
    })
    await waitForPrevious

    const queue: EvalUpdate[] = []
    let bestmoveSeen = false
    let wake: (() => void) | null = null

    let resolveBestmove!: () => void
    const bestmove = new Promise<void>((resolve) => {
      resolveBestmove = resolve
    })

    const subscriber: Subscriber = (message) => {
      if (message.kind === 'info') {
        queue.push(message.update)
        wake?.()
      } else if (message.kind === 'bestmove') {
        bestmoveSeen = true
        resolveBestmove()
        wake?.()
      }
    }

    subscribers.add(subscriber)
    searchActive = true

    transport.send(`setoption name UCI_Chess960 value ${options.chess960}`)
    transport.send(`setoption name MultiPV value ${options.multiPV}`)
    transport.send(`position fen ${fen}`)
    transport.send(`go depth ${options.depth}`)

    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!
          continue
        }
        if (bestmoveSeen) return
        await new Promise<void>((resolve) => {
          wake = () => {
            wake = null
            resolve()
          }
        })
      }
    } finally {
      // Reached both on normal completion and when the consumer broke out of the
      // loop. In the second case the engine is still thinking.
      if (!bestmoveSeen) transport.send('stop')
      await bestmove
      subscribers.delete(subscriber)
      searchActive = false
      releaseThisSearch()
    }
  }

  return {
    analyze,
    stop,
    terminate: () => {
      subscribers.clear()
      transport.terminate()
    },
  }
}
```

About that `finally`: a generator abandoned through `break` receives a `return()` call, which runs the `finally` and waits for it to complete. So `await bestmove` inside `finally` guarantees we do not hand control to the next `analyze` until the engine confirms it has stopped.

- [ ] **Step 4: Run the tests, confirm they pass**

Run: `npx vitest run src/engine/engine.test.ts`
Expected: PASS, 4 tests.

If the "never leaks updates" test fails with a score other than `mate 1`, then `finally` is not waiting for `bestmove` and the engine is answering about the previous position. That is exactly the bug the test was written for.

- [ ] **Step 5: Commit**

```bash
git add src/engine/engine.ts src/engine/engine.test.ts
git commit -m "feat(engine): add analyze/stop with correct search interruption"
git push
```

---

### Task 5: The game module

**Files:**
- Create: `src/game/game.ts`
- Create: `src/game/pgn.ts`
- Test: `src/game/game.test.ts`

**Interfaces:**
- Consumes: `chess.js`.
- Produces:
  - `type Square = string` (e.g. `'e2'`)
  - `type GameState = { fen: string; history: string[]; turn: 'w' | 'b'; isGameOver: boolean }`
  - `function createGame(fen?: string): Chess`
  - `function tryMove(game: Chess, from: Square, to: Square, promotion?: string): boolean`
  - `function getState(game: Chess): GameState` — deliberately not `describe`, or the name would collide with vitest's `describe`
  - `function isValidFen(fen: string): boolean`
  - `function legalDests(game: Chess): Map<Square, Square[]>` — the shape chessground expects
  - `function loadPgn(pgn: string): { ok: true; game: Chess } | { ok: false; error: string }` (from `pgn.ts`)
  - `function toPgn(game: Chess): string` (from `pgn.ts`)

- [ ] **Step 1: Write a failing test**

`src/game/game.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createGame, getState, isValidFen, legalDests, tryMove } from './game'
import { loadPgn, toPgn } from './pgn'

const MATE_IN_ONE = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'

describe('game', () => {
  it('starts from the standard position', () => {
    const state = getState(createGame())
    expect(state.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(state.turn).toBe('w')
    expect(state.isGameOver).toBe(false)
  })

  it('accepts a legal move and rejects an illegal one', () => {
    const game = createGame()
    expect(tryMove(game, 'e2', 'e4')).toBe(true)
    expect(getState(game).turn).toBe('b')
    expect(tryMove(game, 'e4', 'e8')).toBe(false)
    expect(getState(game).history).toEqual(['e4'])
  })

  it('detects checkmate', () => {
    const game = createGame(MATE_IN_ONE)
    expect(tryMove(game, 'a1', 'a8')).toBe(true)
    expect(getState(game).isGameOver).toBe(true)
  })

  it('lists legal destinations per square for chessground', () => {
    const dests = legalDests(createGame())
    expect(dests.get('e2')).toEqual(['e3', 'e4'])
    expect(dests.get('g1')).toEqual(['f3', 'h3'])
    expect(dests.has('e1')).toBe(false)
  })

  it('validates FEN without throwing', () => {
    expect(isValidFen(MATE_IN_ONE)).toBe(true)
    expect(isValidFen('garbage')).toBe(false)
    expect(isValidFen('')).toBe(false)
  })
})

describe('pgn', () => {
  it('round-trips a short game', () => {
    const game = createGame()
    tryMove(game, 'e2', 'e4')
    tryMove(game, 'e7', 'e5')

    const loaded = loadPgn(toPgn(game))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(getState(loaded.game).history).toEqual(['e4', 'e5'])
  })

  it('reports an error for unparsable pgn instead of throwing', () => {
    const loaded = loadPgn('1. e4 e5 2. Qxq9 ##')
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) expect(loaded.error).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/game/game.test.ts`
Expected: FAIL — `Failed to resolve import "./game"`.

- [ ] **Step 3: Write `src/game/game.ts`**

`validateFen` is a named export of `chess.js@1.4.0` and returns `{ ok: true }` or `{ ok: false, error: string }`. The shape was verified against the package; the version is pinned exactly, so there will be no minor-version drift.

```ts
import { Chess, validateFen } from 'chess.js'

export type Square = string

export type GameState = {
  fen: string
  history: string[]
  turn: 'w' | 'b'
  isGameOver: boolean
}

export function createGame(fen?: string): Chess {
  return fen ? new Chess(fen) : new Chess()
}

export function isValidFen(fen: string): boolean {
  return validateFen(fen).ok
}

export function tryMove(game: Chess, from: Square, to: Square, promotion = 'q'): boolean {
  try {
    game.move({ from, to, promotion })
    return true
  } catch {
    // chess.js throws on an illegal move. For us that is not an exceptional
    // situation: the user simply dragged a piece somewhere it cannot go.
    return false
  }
}

export function getState(game: Chess): GameState {
  return {
    fen: game.fen(),
    history: game.history(),
    turn: game.turn(),
    isGameOver: game.isGameOver(),
  }
}

/** chessground expects Map<from, to[]>. */
export function legalDests(game: Chess): Map<Square, Square[]> {
  const dests = new Map<Square, Square[]>()
  for (const move of game.moves({ verbose: true })) {
    const existing = dests.get(move.from)
    if (existing) existing.push(move.to)
    else dests.set(move.from, [move.to])
  }
  return dests
}
```

- [ ] **Step 4: Write `src/game/pgn.ts`**

```ts
import { Chess } from 'chess.js'

export type PgnResult = { ok: true; game: Chess } | { ok: false; error: string }

export function loadPgn(pgn: string): PgnResult {
  const game = new Chess()
  try {
    game.loadPgn(pgn)
    return { ok: true, game }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function toPgn(game: Chess): string {
  return game.pgn()
}
```

- [ ] **Step 5: Run the tests, confirm they pass**

Run: `npx vitest run src/game/game.test.ts`
Expected: PASS, 7 tests.

The ordering in `legalDests` was verified against `chess.js@1.4.0`: `e2 → ['e3','e4']`, `g1 → ['f3','h3']`. Order does not matter to chessground, but the test pins exactly this one.

- [ ] **Step 6: Commit**

```bash
git add src/game/
git commit -m "feat(game): add chess.js wrapper with FEN/PGN handling"
git push
```

---

### Task 6: The board component

Chessground is an imperative library. It owns its own DOM; React must not re-render it.

**Files:**
- Create: `src/ui/Board.tsx`
- Create: `src/ui/board.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `chessground`, `legalDests` and `Square` from `src/game/game`.
- Produces:
  - `type Arrow = { orig: Square; dest: Square; brush: 'green' | 'paleGreen' | 'paleGrey' }`
  - `type BoardProps = { fen: string; dests: Map<Square, Square[]>; orientation: 'white' | 'black'; turn: 'white' | 'black'; arrows?: Arrow[]; onMove: (from: Square, to: Square) => void }`
  - `function Board(props: BoardProps): JSX.Element`

- [ ] **Step 1: Wire up chessground's styles**

`src/ui/board.css`:

```css
@import 'chessground/assets/chessground.base.css';
@import 'chessground/assets/chessground.brown.css';
@import 'chessground/assets/chessground.cburnett.css';

.board-wrap {
  width: min(80vh, 640px);
  aspect-ratio: 1;
}
```

Without all three files the board renders as an empty rectangle: `base` sets the geometry, `brown` the square colours, `cburnett` the pieces.

- [ ] **Step 2: Write `src/ui/Board.tsx`**

```tsx
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import { useEffect, useRef } from 'react'
import type { Square } from '../game/game'
import './board.css'

export type Arrow = {
  orig: Square
  dest: Square
  brush: 'green' | 'paleGreen' | 'paleGrey'
}

export type BoardProps = {
  fen: string
  dests: Map<Square, Square[]>
  orientation: 'white' | 'black'
  turn: 'white' | 'black'
  arrows?: Arrow[]
  onMove: (from: Square, to: Square) => void
}

export function Board({ fen, dests, orientation, turn, arrows = [], onMove }: BoardProps) {
  const element = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)

  // onMove is recreated on every render; keep it in a ref so we do not
  // reinitialize the board.
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    if (!element.current) return
    api.current = Chessground(element.current, {
      fen,
      orientation,
      turnColor: turn,
      movable: {
        free: false,
        color: turn,
        dests,
        events: {
          after: (from, to) => onMoveRef.current(from, to),
        },
      },
    })
    return () => {
      api.current?.destroy()
      api.current = null
    }
    // Initialize exactly once. Updates flow through api.set below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    api.current?.set({
      fen,
      orientation,
      turnColor: turn,
      movable: { free: false, color: turn, dests },
    })
  }, [fen, orientation, turn, dests])

  useEffect(() => {
    api.current?.setAutoShapes(arrows)
  }, [arrows])

  return <div className="board-wrap" ref={element} />
}
```

The two separate `useEffect`s are not an accident. The first creates and destroys the board; the second synchronizes state. Merge them and the board is recreated on every move, losing its animation and focus.

- [ ] **Step 3: Wire the board into `src/App.tsx`**

```tsx
import { useCallback, useMemo, useState } from 'react'
import { createGame, getState, legalDests, tryMove } from './game/game'
import { Board } from './ui/Board'

export function App() {
  const [game] = useState(() => createGame())
  const [state, setState] = useState(() => getState(game))

  const dests = useMemo(() => legalDests(game), [state.fen])

  const onMove = useCallback(
    (from: string, to: string) => {
      if (tryMove(game, from, to)) setState(getState(game))
    },
    [game],
  )

  return (
    <main>
      <h1>Chess Analyzer</h1>
      <Board
        fen={state.fen}
        dests={dests}
        orientation="white"
        turn={state.turn === 'w' ? 'white' : 'black'}
        onMove={onMove}
      />
    </main>
  )
}
```

- [ ] **Step 4: Check by hand**

Run: `npm run dev`
Expected: the board renders with pieces. The `e2` pawn can be dragged to `e3` or `e4`, but not to `e5`. After White's move it is Black's turn.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ src/App.tsx
git commit -m "feat(ui): add chessground board with legal move validation"
git push
```

---

### Task 7: The engine → React bridge and live evaluation

The first moment when all the parts meet.

**Files:**
- Create: `src/hooks/useAnalysis.ts`
- Create: `src/ui/EvalBar.tsx`
- Create: `src/ui/LineList.tsx`
- Test: `src/ui/EvalBar.test.tsx`
- Modify: `src/App.tsx`
- Modify: `package.json` (add `jsdom`, `@testing-library/react`)

**Interfaces:**
- Consumes: `createEngine`, `AnalyzeOptions` from `src/engine/engine`; `createWorkerTransport`, `isMultiThreaded` from `src/engine/transport`; `EvalUpdate` from `src/engine/uci`.
- Produces:
  - `type AnalysisState = { lines: EvalUpdate[]; depth: number; stale: boolean; multiThreaded: boolean }`
  - `function useAnalysis(fen: string, options: AnalyzeOptions): AnalysisState`
  - `function EvalBar(props: { score: Score | null; orientation: 'white' | 'black' }): JSX.Element`
  - `function formatScore(score: Score): string` (exported from `EvalBar.tsx`)
  - `function whiteWinProbability(score: Score): number` (exported from `EvalBar.tsx`)
  - `function LineList(props: { lines: EvalUpdate[] }): JSX.Element`

- [ ] **Step 1: Install the dependencies for component tests**

```bash
npm i -D jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Write a failing test for `EvalBar`**

The score's sign is the most common bug in analyzers. UCI always gives the score **from the point of view of the side to move**. The bar shows the score **from White's point of view**. The conversion must account for whose turn it is, so `formatScore` works on an already-normalized score, and `useAnalysis` does the normalizing.

`src/ui/EvalBar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { EvalBar, formatScore, whiteWinProbability } from './EvalBar'

it('formats a centipawn score in pawns with a sign', () => {
  expect(formatScore({ type: 'cp', value: 616 })).toBe('+6.16')
  expect(formatScore({ type: 'cp', value: -34 })).toBe('-0.34')
  expect(formatScore({ type: 'cp', value: 0 })).toBe('0.00')
})

it('formats a mate score', () => {
  expect(formatScore({ type: 'mate', value: 1 })).toBe('M1')
  expect(formatScore({ type: 'mate', value: -3 })).toBe('-M3')
})

it('maps scores to a white win probability between 0 and 1', () => {
  expect(whiteWinProbability({ type: 'cp', value: 0 })).toBeCloseTo(0.5, 5)
  expect(whiteWinProbability({ type: 'mate', value: 2 })).toBe(1)
  expect(whiteWinProbability({ type: 'mate', value: -2 })).toBe(0)
  expect(whiteWinProbability({ type: 'cp', value: 300 })).toBeGreaterThan(0.7)
  expect(whiteWinProbability({ type: 'cp', value: -300 })).toBeLessThan(0.3)
})

it('renders a placeholder when there is no score yet', () => {
  render(<EvalBar score={null} orientation="white" />)
  expect(screen.getByTestId('eval-bar')).toHaveTextContent('…')
})

it('renders the score text', () => {
  render(<EvalBar score={{ type: 'cp', value: 50 }} orientation="white" />)
  expect(screen.getByTestId('eval-bar')).toHaveTextContent('+0.50')
})
```

Add `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

and add `setupFiles: ['./src/test-setup.ts']` to the `test` block of `vite.config.ts`.

- [ ] **Step 3: Run the test, confirm it fails**

Run: `npx vitest run src/ui/EvalBar.test.tsx`
Expected: FAIL — `Failed to resolve import "./EvalBar"`.

- [ ] **Step 4: Write `src/ui/EvalBar.tsx`**

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

export function EvalBar({ score, orientation }: { score: Score | null; orientation: 'white' | 'black' }) {
  const whiteShare = score ? whiteWinProbability(score) : 0.5
  const whiteHeight = `${whiteShare * 100}%`

  return (
    <div
      data-testid="eval-bar"
      className="eval-bar"
      style={{
        display: 'flex',
        flexDirection: orientation === 'white' ? 'column-reverse' : 'column',
        width: '24px',
        height: 'min(80vh, 640px)',
        background: '#403d39',
        position: 'relative',
      }}
    >
      <div style={{ height: whiteHeight, background: '#f0f0f0', transition: 'height 200ms' }} />
      <span
        style={{
          position: 'absolute',
          inset: 'auto 0 4px 0',
          textAlign: 'center',
          fontSize: '10px',
          color: '#111',
        }}
      >
        {score ? formatScore(score) : '…'}
      </span>
    </div>
  )
}
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npx vitest run src/ui/EvalBar.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/ui/EvalBar.tsx src/ui/EvalBar.test.tsx src/test-setup.ts vite.config.ts package.json package-lock.json
git commit -m "feat(ui): add eval bar with score formatting"
git push
```

- [ ] **Step 7: Write `src/hooks/useAnalysis.ts`**

```ts
import { useEffect, useRef, useState } from 'react'
import { createEngine, type AnalyzeOptions, type Engine } from '../engine/engine'
import { createWorkerTransport, isMultiThreaded } from '../engine/transport'
import type { EvalUpdate, Score } from '../engine/uci'

export type AnalysisState = {
  lines: EvalUpdate[]
  depth: number
  stale: boolean
  multiThreaded: boolean
}

const THROTTLE_MS = 100

/** UCI reports the score from the side to move's point of view. The bar needs White's. */
function toWhitePerspective(score: Score, blackToMove: boolean): Score {
  return blackToMove ? { type: score.type, value: -score.value } : score
}

export function useAnalysis(fen: string, options: AnalyzeOptions): AnalysisState {
  const engineRef = useRef<Engine | null>(null)
  const [lines, setLines] = useState<EvalUpdate[]>([])
  const [depth, setDepth] = useState(0)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    engineRef.current = createEngine(createWorkerTransport())
    return () => {
      engineRef.current?.terminate()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return

    const blackToMove = fen.split(' ')[1] === 'b'
    let cancelled = false
    setStale(true)

    // The engine emits hundreds of updates per second; accumulate them and hand
    // them to React no more often than once every THROTTLE_MS.
    const pending = new Map<number, EvalUpdate>()
    let flushTimer: ReturnType<typeof setInterval> | null = null

    const flush = () => {
      if (pending.size === 0) return
      const snapshot = [...pending.values()].sort((a, b) => a.multipv - b.multipv)
      setLines(snapshot)
      setDepth(Math.max(...snapshot.map((line) => line.depth)))
      setStale(false)
    }

    const run = async () => {
      flushTimer = setInterval(flush, THROTTLE_MS)
      try {
        for await (const update of engine.analyze(fen, options)) {
          if (cancelled) break
          pending.set(update.multipv, {
            ...update,
            score: toWhitePerspective(update.score, blackToMove),
          })
        }
      } finally {
        if (flushTimer) clearInterval(flushTimer)
        if (!cancelled) flush()
      }
    }

    void run()

    return () => {
      cancelled = true
      engine.stop()
    }
  }, [fen, options.depth, options.multiPV, options.chess960])

  return { lines, depth, stale, multiThreaded: isMultiThreaded() }
}
```

`cancelled = true` makes the `for await` loop exit through `break`, which runs the `finally` inside `analyze` and stops the engine properly. The `engine.stop()` in the cleanup merely speeds that up by sending `stop` immediately.

- [ ] **Step 8: Write `src/ui/LineList.tsx`**

```tsx
import type { EvalUpdate } from '../engine/uci'
import { formatScore } from './EvalBar'

export function LineList({ lines }: { lines: EvalUpdate[] }) {
  if (lines.length === 0) return <p>Analyzing…</p>

  return (
    <ol className="line-list">
      {lines.map((line) => (
        <li key={line.multipv}>
          <strong>{formatScore(line.score)}</strong> <span>{line.pv.slice(0, 8).join(' ')}</span>
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 9: Wire it all together in `src/App.tsx`**

```tsx
import { useCallback, useMemo, useState } from 'react'
import { createGame, getState, legalDests, tryMove } from './game/game'
import { useAnalysis } from './hooks/useAnalysis'
import { Board } from './ui/Board'
import { EvalBar } from './ui/EvalBar'
import { LineList } from './ui/LineList'

const OPTIONS = { depth: 18, multiPV: 3, chess960: false }

export function App() {
  const [game] = useState(() => createGame())
  const [state, setState] = useState(() => getState(game))

  const dests = useMemo(() => legalDests(game), [state.fen])
  const analysis = useAnalysis(state.fen, OPTIONS)

  const onMove = useCallback(
    (from: string, to: string) => {
      if (tryMove(game, from, to)) setState(getState(game))
    },
    [game],
  )

  const best = analysis.lines[0] ?? null

  return (
    <main>
      <h1>Chess Analyzer</h1>
      {!analysis.multiThreaded && (
        <p role="alert">
          The multi-threaded engine is unavailable (no cross-origin isolation). The slower
          single-threaded build is running.
        </p>
      )}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <EvalBar score={best?.score ?? null} orientation="white" />
        <Board
          fen={state.fen}
          dests={dests}
          orientation="white"
          turn={state.turn === 'w' ? 'white' : 'black'}
          onMove={onMove}
        />
        <div style={{ opacity: analysis.stale ? 0.5 : 1 }}>
          <p>Depth: {analysis.depth}</p>
          <LineList lines={analysis.lines} />
        </div>
      </div>
    </main>
  )
}
```

Dimming through `opacity` rather than clearing the list: otherwise the panel blinks empty on every move.

- [ ] **Step 10: Check by hand**

Run: `npm run dev`
Expected:
- No single-threaded warning.
- On the starting position the score is around `+0.20`; the depth climbs to 18 and stops.
- Three lines in the list.
- After `1.e4` the score is recomputed and the list refreshes.
- Play `1.f3 e5 2.g4` — the score must read `-M1` (mate by `d8h4`), not `M1`. If the sign is flipped, `toWhitePerspective` is broken.

- [ ] **Step 11: Commit**

```bash
git add src/hooks/ src/ui/LineList.tsx src/App.tsx
git commit -m "feat: wire engine to UI with live evaluation"
git push
```

---

### Task 8: Best-move arrows

**Files:**
- Modify: `src/App.tsx`
- Create: `src/ui/arrows.ts`
- Test: `src/ui/arrows.test.ts`

**Interfaces:**
- Consumes: `EvalUpdate` from `src/engine/uci`; `Arrow` from `src/ui/Board`.
- Produces: `function linesToArrows(lines: EvalUpdate[]): Arrow[]`

- [ ] **Step 1: Write a failing test**

`src/ui/arrows.test.ts`:

```ts
import { expect, it } from 'vitest'
import type { EvalUpdate } from '../engine/uci'
import { linesToArrows } from './arrows'

const line = (multipv: number, pv: string[]): EvalUpdate => ({
  depth: 10,
  multipv,
  score: { type: 'cp', value: 0 },
  pv,
})

it('draws the best line in green and the rest paler', () => {
  const arrows = linesToArrows([line(1, ['e2e4']), line(2, ['d2d4']), line(3, ['g1f3'])])
  expect(arrows).toEqual([
    { orig: 'e2', dest: 'e4', brush: 'green' },
    { orig: 'd2', dest: 'd4', brush: 'paleGreen' },
    { orig: 'g1', dest: 'f3', brush: 'paleGrey' },
  ])
})

it('handles promotion moves, which carry a fifth character', () => {
  expect(linesToArrows([line(1, ['e7e8q'])])).toEqual([{ orig: 'e7', dest: 'e8', brush: 'green' }])
})

it('ignores lines with an empty pv', () => {
  expect(linesToArrows([line(1, [])])).toEqual([])
})

it('returns nothing for no lines', () => {
  expect(linesToArrows([])).toEqual([])
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/ui/arrows.test.ts`
Expected: FAIL — `Failed to resolve import "./arrows"`.

- [ ] **Step 3: Write `src/ui/arrows.ts`**

The `green`, `paleGreen` and `paleGrey` brushes are part of `chessground@9.2.1`'s default set (see `dist/state.js`, `defaults().drawable.brushes`: `green, red, blue, yellow, paleBlue, paleGreen, paleRed, paleGrey, purple, pink, white`). The config is merged on top of the defaults, so registering them through `drawable.brushes` is unnecessary.

```ts
import type { EvalUpdate } from '../engine/uci'
import type { Arrow } from './Board'

const BRUSHES = ['green', 'paleGreen', 'paleGrey'] as const

export function linesToArrows(lines: EvalUpdate[]): Arrow[] {
  return lines
    .slice(0, BRUSHES.length)
    .filter((line) => line.pv.length > 0)
    .map((line, index) => {
      const move = line.pv[0]
      return {
        orig: move.slice(0, 2),
        dest: move.slice(2, 4),
        brush: BRUSHES[index],
      }
    })
}
```

A UCI move is `e2e4`, or `e7e8q` on a promotion. Hence `slice(2, 4)`, not `slice(2)`.

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run src/ui/arrows.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Pass the arrows to the board**

In `src/App.tsx` add the import `import { linesToArrows } from './ui/arrows'`, compute

```tsx
const arrows = useMemo(() => linesToArrows(analysis.lines), [analysis.lines])
```

and pass it as `<Board ... arrows={arrows} />`.

- [ ] **Step 6: Check by hand**

Run: `npm run dev`
Expected: three arrows on the starting position — a bright green one on the first line and two pale ones on the rest. Making a move redraws the arrows.

- [ ] **Step 7: Commit**

```bash
git add src/ui/arrows.ts src/ui/arrows.test.ts src/App.tsx
git commit -m "feat(ui): draw best-move arrows on the board"
git push
```

---

### Task 9: FEN and PGN input

**Files:**
- Create: `src/ui/PositionInput.tsx`
- Test: `src/ui/PositionInput.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `isValidFen`, `createGame` from `src/game/game`; `loadPgn` from `src/game/pgn`.
- Produces:
  - `type PositionInputProps = { onLoad: (game: Chess) => void }`
  - `function PositionInput(props: PositionInputProps): JSX.Element`

- [ ] **Step 1: Write a failing test**

`src/ui/PositionInput.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { PositionInput } from './PositionInput'

const MATE_IN_ONE = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'

it('loads a valid FEN', async () => {
  const onLoad = vi.fn()
  render(<PositionInput onLoad={onLoad} />)

  await userEvent.type(screen.getByLabelText('FEN'), MATE_IN_ONE)
  await userEvent.click(screen.getByRole('button', { name: 'Load FEN' }))

  expect(onLoad).toHaveBeenCalledTimes(1)
  expect(onLoad.mock.calls[0][0].fen()).toBe(MATE_IN_ONE)
})

it('shows an error for an invalid FEN and does not load it', async () => {
  const onLoad = vi.fn()
  render(<PositionInput onLoad={onLoad} />)

  await userEvent.type(screen.getByLabelText('FEN'), 'garbage')
  await userEvent.click(screen.getByRole('button', { name: 'Load FEN' }))

  expect(screen.getByRole('alert')).toHaveTextContent('Invalid FEN')
  expect(onLoad).not.toHaveBeenCalled()
})

it('loads a valid PGN', async () => {
  const onLoad = vi.fn()
  render(<PositionInput onLoad={onLoad} />)

  await userEvent.type(screen.getByLabelText('PGN'), '1. e4 e5 2. Nf3')
  await userEvent.click(screen.getByRole('button', { name: 'Load PGN' }))

  expect(onLoad).toHaveBeenCalledTimes(1)
  expect(onLoad.mock.calls[0][0].history()).toEqual(['e4', 'e5', 'Nf3'])
})

it('shows an error for an unparsable PGN', async () => {
  const onLoad = vi.fn()
  render(<PositionInput onLoad={onLoad} />)

  await userEvent.type(screen.getByLabelText('PGN'), '1. Qxq9 ##')
  await userEvent.click(screen.getByRole('button', { name: 'Load PGN' }))

  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(onLoad).not.toHaveBeenCalled()
})
```

Install `@testing-library/user-event`:

```bash
npm i -D @testing-library/user-event
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/ui/PositionInput.test.tsx`
Expected: FAIL — `Failed to resolve import "./PositionInput"`.

- [ ] **Step 3: Write `src/ui/PositionInput.tsx`**

```tsx
import type { Chess } from 'chess.js'
import { useState } from 'react'
import { createGame, isValidFen } from '../game/game'
import { loadPgn } from '../game/pgn'

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
    <section className="position-input">
      <label htmlFor="fen-input">FEN</label>
      <input id="fen-input" value={fen} onChange={(event) => setFen(event.target.value)} />
      <button type="button" onClick={submitFen}>
        Load FEN
      </button>

      <label htmlFor="pgn-input">PGN</label>
      <textarea id="pgn-input" rows={4} value={pgn} onChange={(event) => setPgn(event.target.value)} />
      <button type="button" onClick={submitPgn}>
        Load PGN
      </button>

      {error && <p role="alert">{error}</p>}
    </section>
  )
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run src/ui/PositionInput.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Wire it into `src/App.tsx`**

Replace `const [game] = useState(...)` with mutable state, because loading a position swaps out the whole game object:

```tsx
const [game, setGame] = useState(() => createGame())
const [state, setState] = useState(() => getState(game))

const loadGame = useCallback((next: Chess) => {
  setGame(next)
  setState(getState(next))
}, [])
```

and render `<PositionInput onLoad={loadGame} />` below the board. Remember `import type { Chess } from 'chess.js'`.

- [ ] **Step 6: Check by hand**

Run: `npm run dev`
Expected: pasting the FEN `6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1` shows the position, a score of `M1` and a green `a1 → a8` arrow. Typing `garbage` shows an error and does not change the board.

- [ ] **Step 7: Commit**

```bash
git add src/ui/PositionInput.tsx src/ui/PositionInput.test.tsx src/App.tsx package.json package-lock.json
git commit -m "feat(ui): add FEN and PGN input with error handling"
git push
```

---

### Task 10: Analysis settings

**Files:**
- Create: `src/hooks/useSettings.ts`
- Test: `src/hooks/useSettings.test.ts`
- Create: `src/ui/SettingsPanel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AnalyzeOptions` from `src/engine/engine`.
- Produces:
  - `const DEFAULT_SETTINGS: AnalyzeOptions`
  - `function useSettings(): [AnalyzeOptions, (patch: Partial<AnalyzeOptions>) => void]`
  - `function SettingsPanel(props: { settings: AnalyzeOptions; onChange: (patch: Partial<AnalyzeOptions>) => void }): JSX.Element`

- [ ] **Step 1: Write a failing test**

`src/hooks/useSettings.test.ts`:

```ts
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, useSettings } from './useSettings'

beforeEach(() => localStorage.clear())

it('starts from the defaults when storage is empty', () => {
  const { result } = renderHook(() => useSettings())
  expect(result.current[0]).toEqual(DEFAULT_SETTINGS)
})

it('persists a patch to localStorage', () => {
  const { result } = renderHook(() => useSettings())
  act(() => result.current[1]({ depth: 22 }))
  expect(result.current[0].depth).toBe(22)
  expect(JSON.parse(localStorage.getItem('chess-analyzer:settings')!).depth).toBe(22)
})

it('restores persisted settings on mount', () => {
  localStorage.setItem('chess-analyzer:settings', JSON.stringify({ ...DEFAULT_SETTINGS, multiPV: 5 }))
  const { result } = renderHook(() => useSettings())
  expect(result.current[0].multiPV).toBe(5)
})

it('falls back to the defaults when storage holds garbage', () => {
  localStorage.setItem('chess-analyzer:settings', 'not json')
  const { result } = renderHook(() => useSettings())
  expect(result.current[0]).toEqual(DEFAULT_SETTINGS)
})

it('clamps out-of-range values from storage', () => {
  localStorage.setItem('chess-analyzer:settings', JSON.stringify({ depth: 999, multiPV: 0, chess960: false }))
  const { result } = renderHook(() => useSettings())
  expect(result.current[0].depth).toBe(30)
  expect(result.current[0].multiPV).toBe(1)
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/hooks/useSettings.test.ts`
Expected: FAIL — `Failed to resolve import "./useSettings"`.

- [ ] **Step 3: Write `src/hooks/useSettings.ts`**

```ts
import { useCallback, useState } from 'react'
import type { AnalyzeOptions } from '../engine/engine'

const STORAGE_KEY = 'chess-analyzer:settings'

export const DEFAULT_SETTINGS: AnalyzeOptions = {
  depth: 18,
  multiPV: 3,
  chess960: false,
}

const LIMITS = {
  depth: { min: 1, max: 30 },
  multiPV: { min: 1, max: 5 },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sanitize(raw: unknown): AnalyzeOptions {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS
  const candidate = raw as Partial<AnalyzeOptions>
  return {
    depth: Number.isInteger(candidate.depth)
      ? clamp(candidate.depth!, LIMITS.depth.min, LIMITS.depth.max)
      : DEFAULT_SETTINGS.depth,
    multiPV: Number.isInteger(candidate.multiPV)
      ? clamp(candidate.multiPV!, LIMITS.multiPV.min, LIMITS.multiPV.max)
      : DEFAULT_SETTINGS.multiPV,
    chess960: typeof candidate.chess960 === 'boolean' ? candidate.chess960 : DEFAULT_SETTINGS.chess960,
  }
}

function read(): AnalyzeOptions {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? sanitize(JSON.parse(stored)) : DEFAULT_SETTINGS
  } catch {
    // Corrupt JSON or unreachable storage — no reason to crash.
    return DEFAULT_SETTINGS
  }
}

export function useSettings(): [AnalyzeOptions, (patch: Partial<AnalyzeOptions>) => void] {
  const [settings, setSettings] = useState<AnalyzeOptions>(read)

  const update = useCallback((patch: Partial<AnalyzeOptions>) => {
    setSettings((current) => {
      const next = sanitize({ ...current, ...patch })
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // The browser's private mode. The settings simply will not survive a reload.
      }
      return next
    })
  }, [])

  return [settings, update]
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run src/hooks/useSettings.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write `src/ui/SettingsPanel.tsx`**

```tsx
import type { AnalyzeOptions } from '../engine/engine'

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: AnalyzeOptions
  onChange: (patch: Partial<AnalyzeOptions>) => void
}) {
  return (
    <section className="settings">
      <label htmlFor="depth">Depth: {settings.depth}</label>
      <input
        id="depth"
        type="range"
        min={1}
        max={30}
        value={settings.depth}
        onChange={(event) => onChange({ depth: Number(event.target.value) })}
      />

      <label htmlFor="multipv">Variations: {settings.multiPV}</label>
      <input
        id="multipv"
        type="range"
        min={1}
        max={5}
        value={settings.multiPV}
        onChange={(event) => onChange({ multiPV: Number(event.target.value) })}
      />
    </section>
  )
}
```

- [ ] **Step 6: Wire it into `src/App.tsx`**

Delete the `OPTIONS` constant entirely. Add the imports:

```tsx
import { useSettings } from './hooks/useSettings'
import { SettingsPanel } from './ui/SettingsPanel'
```

Replace the line `const analysis = useAnalysis(state.fen, OPTIONS)` with two:

```tsx
const [settings, updateSettings] = useSettings()
const analysis = useAnalysis(state.fen, settings)
```

And render the panel in the right column, above `<LineList>`:

```tsx
<SettingsPanel settings={settings} onChange={updateSettings} />
```

`useSettings` returns a new object only on a change, and `useAnalysis` depends on the fields of `settings` rather than on the object reference, so there will be no needless analysis restarts.

- [ ] **Step 7: Check by hand**

Run: `npm run dev`
Expected: changing the depth restarts the analysis; changing the number of variations changes the list's length and the number of arrows; the values survive a page reload.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useSettings.ts src/hooks/useSettings.test.ts src/ui/SettingsPanel.tsx src/App.tsx
git commit -m "feat: add persisted analysis settings"
git push
```

---

### Task 11: Recovering from a worker crash

The spec requires: when the worker crashes, restart it and retry the last request once; after that, show a message.

**Files:**
- Modify: `src/engine/transport.ts`
- Modify: `src/hooks/useAnalysis.ts`
- Test: `src/engine/transport.test.ts`

**Interfaces:**
- Consumes: `EngineTransport` from `./transport`.
- Produces:
  - `createWorkerTransport(scriptUrl?: string, onError?: (error: unknown) => void): EngineTransport` — an extended signature
  - `AnalysisState` gains a new field: `error: string | null`

- [ ] **Step 1: Write a failing test for error forwarding**

`src/engine/transport.test.ts`:

```ts
// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { createWorkerTransport } from './transport'

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
}

it('forwards worker errors to the callback', () => {
  const fake = new FakeWorker()
  vi.stubGlobal('Worker', vi.fn(() => fake))
  const onError = vi.fn()

  createWorkerTransport('/engine.js', onError)
  fake.onerror?.(new ErrorEvent('error', { message: 'boom' }))

  expect(onError).toHaveBeenCalledTimes(1)
  vi.unstubAllGlobals()
})

it('forwards only string messages to the line handler', () => {
  const fake = new FakeWorker()
  vi.stubGlobal('Worker', vi.fn(() => fake))
  const lines: string[] = []

  const transport = createWorkerTransport('/engine.js')
  transport.onLine((line) => lines.push(line))

  fake.onmessage?.({ data: 'readyok' } as MessageEvent)
  fake.onmessage?.({ data: { not: 'a string' } } as MessageEvent)

  expect(lines).toEqual(['readyok'])
  vi.unstubAllGlobals()
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/engine/transport.test.ts`
Expected: FAIL — `createWorkerTransport` takes one argument and `onError` is never called.

- [ ] **Step 3: Extend `createWorkerTransport`**

In `src/engine/transport.ts`, replace the function with:

```ts
export function createWorkerTransport(
  scriptUrl: string = selectEngineUrl(),
  onError?: (error: unknown) => void,
): EngineTransport {
  const worker = new Worker(scriptUrl)
  let handler: (line: string) => void = () => {}

  worker.onmessage = (event: MessageEvent) => {
    if (typeof event.data === 'string') handler(event.data)
  }
  worker.onerror = (event) => onError?.(event)

  return {
    send: (command) => worker.postMessage(command),
    onLine: (next) => {
      handler = next
    },
    terminate: () => worker.terminate(),
  }
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run src/engine/transport.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Handle the crash in `useAnalysis`**

In `src/hooks/useAnalysis.ts`: add an `error: string | null` field to `AnalysisState`, declare `const [error, setError] = useState<string | null>(null)`, and keep a restart counter in a ref.

Replace the engine-creating effect with:

```ts
const restarts = useRef(0)
const [engineGeneration, setEngineGeneration] = useState(0)

useEffect(() => {
  const handleError = () => {
    if (restarts.current >= 1) {
      setError('The engine crashed. Reload the page.')
      return
    }
    restarts.current += 1
    setEngineGeneration((generation) => generation + 1)
  }

  engineRef.current = createEngine(createWorkerTransport(undefined, handleError))
  return () => {
    engineRef.current?.terminate()
    engineRef.current = null
  }
}, [engineGeneration])
```

Changing `engineGeneration` recreates the engine, and the analysis effect restarts because `engineRef.current` changed — add `engineGeneration` to that effect's dependency array. That is what "retry the last request once" means.

Return `error` from the hook.

- [ ] **Step 6: Show the error in `src/App.tsx`**

Below the single-threaded warning, add:

```tsx
{analysis.error && <p role="alert">{analysis.error}</p>}
```

- [ ] **Step 7: Check by hand**

Run: `npm run dev`

Kill the worker from the browser console: temporarily point `MULTI_THREADED` at a nonexistent path, `/stockfish/nope.js`, and reload.
Expected: the engine restarts once, then the message "The engine crashed" appears. Put the path back.

- [ ] **Step 8: Commit**

```bash
git add src/engine/transport.ts src/engine/transport.test.ts src/hooks/useAnalysis.ts src/App.tsx
git commit -m "feat(engine): recover from worker crashes once, then report"
git push
```

---

### Task 12: Previewing a line by clicking its moves

Spec: "clicking a move in the chain scrolls the board to that position without destroying the main game."

**Files:**
- Create: `src/game/preview.ts`
- Test: `src/game/preview.test.ts`
- Modify: `src/ui/LineList.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `chess.js`.
- Produces:
  - `function previewFen(baseFen: string, uciMoves: string[]): string | null` — `null` if the moves are illegal in that position
  - `LineList` gains a new prop: `onSelect: (line: EvalUpdate, plyCount: number) => void`

- [ ] **Step 1: Write a failing test**

`src/game/preview.test.ts`:

```ts
import { expect, it } from 'vitest'
import { previewFen } from './preview'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

it('applies a single uci move', () => {
  expect(previewFen(START, ['e2e4'])).toBe(
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  )
})

it('applies a sequence of uci moves', () => {
  const fen = previewFen(START, ['e2e4', 'e7e5', 'g1f3'])
  expect(fen).toContain(' b ')
  expect(fen!.startsWith('rnbqkbnr/pppp1ppp')).toBe(true)
})

it('returns the base position for an empty move list', () => {
  expect(previewFen(START, [])).toBe(START)
})

it('handles promotion moves', () => {
  const fen = previewFen('8/P6k/8/8/8/8/8/7K w - - 0 1', ['a7a8q'])
  expect(fen).toContain('Q7/7k')
})

it('returns null for an illegal move instead of throwing', () => {
  expect(previewFen(START, ['e2e5'])).toBeNull()
})

it('returns null for an invalid base position', () => {
  expect(previewFen('garbage', ['e2e4'])).toBeNull()
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/game/preview.test.ts`
Expected: FAIL — `Failed to resolve import "./preview"`.

- [ ] **Step 3: Write `src/game/preview.ts`**

```ts
import { Chess } from 'chess.js'

/**
 * Replays UCI moves from a base position and returns the resulting FEN.
 * Mutates nothing: it works on its own Chess instance.
 */
export function previewFen(baseFen: string, uciMoves: string[]): string | null {
  try {
    const game = new Chess(baseFen)
    for (const move of uciMoves) {
      game.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: move.length > 4 ? move[4] : undefined,
      })
    }
    return game.fen()
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run src/game/preview.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Make the moves in `LineList` clickable**

Replace `src/ui/LineList.tsx` entirely:

```tsx
import type { EvalUpdate } from '../engine/uci'
import { formatScore } from './EvalBar'

export type LineListProps = {
  lines: EvalUpdate[]
  onSelect: (line: EvalUpdate, plyCount: number) => void
}

export function LineList({ lines, onSelect }: LineListProps) {
  if (lines.length === 0) return <p>Analyzing…</p>

  return (
    <ol className="line-list">
      {lines.map((line) => (
        <li key={line.multipv}>
          <strong>{formatScore(line.score)}</strong>{' '}
          {line.pv.slice(0, 8).map((move, index) => (
            <button
              key={`${move}-${index}`}
              type="button"
              className="pv-move"
              onClick={() => onSelect(line, index + 1)}
            >
              {move}
            </button>
          ))}
        </li>
      ))}
    </ol>
  )
}
```

`plyCount` is how many plies of the line to apply: clicking the first move gives `1`.

- [ ] **Step 6: Add preview state to `src/App.tsx`**

Add the import `import { previewFen } from './game/preview'` and the state:

```tsx
const [preview, setPreview] = useState<string | null>(null)

const selectLine = useCallback(
  (line: EvalUpdate, plyCount: number) => {
    setPreview(previewFen(state.fen, line.pv.slice(0, plyCount)))
  },
  [state.fen],
)

// A move on the board or a loaded position always leaves the preview.
const displayFen = preview ?? state.fen
const previewing = preview !== null
```

The analysis and the board now work from `displayFen`:

```tsx
const analysis = useAnalysis(displayFen, settings)
```

Pass `fen={displayFen}` and `dests={previewing ? new Map() : dests}` to `<Board>` — moving is not allowed during a preview. Add `setPreview(null)` as the first line of `onMove` and `loadGame`.

Show a return button below the board:

```tsx
{previewing && (
  <button type="button" onClick={() => setPreview(null)}>
    Back to game
  </button>
)}
```

Pass `onSelect={selectLine}` to `<LineList>`. Remember `import type { EvalUpdate } from './engine/uci'`.

- [ ] **Step 7: Check by hand**

Run: `npm run dev`
Expected: clicking the second move of the first line advances the board two plies, a `Back to game` button appears, and the score is recomputed for the shown position. Clicking the button returns the original position and moving works again.

- [ ] **Step 8: Commit**

```bash
git add src/game/preview.ts src/game/preview.test.ts src/ui/LineList.tsx src/App.tsx
git commit -m "feat(ui): preview engine lines by clicking their moves"
git push
```

---

### Task 13: The position editor

The fourth input method from the spec: arranging pieces by hand.

**Files:**
- Create: `src/game/editor.ts`
- Test: `src/game/editor.test.ts`
- Create: `src/ui/PositionEditor.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `isValidFen` from `src/game/game`; chessground's `getFen()` / `setPieces()` API.
- Produces:
  - `const EMPTY_PLACEMENT = '8/8/8/8/8/8/8/8'`
  - `function composeFen(placement: string, turn: 'w' | 'b'): string`
  - `function validatePlacement(placement: string, turn: 'w' | 'b'): { ok: true; fen: string } | { ok: false; error: string }`

- [ ] **Step 1: Write a failing test**

`src/game/editor.test.ts`:

```ts
import { expect, it } from 'vitest'
import { composeFen, EMPTY_PLACEMENT, validatePlacement } from './editor'

it('composes a full fen from a placement and a side to move', () => {
  expect(composeFen('6k1/5ppp/8/8/8/8/5PPP/R5K1', 'w')).toBe('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1')
  expect(composeFen('6k1/5ppp/8/8/8/8/5PPP/R5K1', 'b')).toBe('6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1')
})

it('accepts a legal placement', () => {
  const result = validatePlacement('6k1/5ppp/8/8/8/8/5PPP/R5K1', 'w')
  expect(result).toEqual({ ok: true, fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1' })
})

it('rejects an empty board', () => {
  const result = validatePlacement(EMPTY_PLACEMENT, 'w')
  expect(result.ok).toBe(false)
})

it('rejects a position missing a king', () => {
  const result = validatePlacement('6k1/5ppp/8/8/8/8/5PPP/R7', 'w')
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error).toBeTruthy()
})
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run src/game/editor.test.ts`
Expected: FAIL — `Failed to resolve import "./editor"`.

- [ ] **Step 3: Write `src/game/editor.ts`**

```ts
import { isValidFen } from './game'

export const EMPTY_PLACEMENT = '8/8/8/8/8/8/8/8'

/**
 * chessground only hands back the piece placement. Castling rights and the
 * en-passant square cannot be recovered from it, so the editor zeroes them out.
 */
export function composeFen(placement: string, turn: 'w' | 'b'): string {
  return `${placement} ${turn} - - 0 1`
}

export function validatePlacement(
  placement: string,
  turn: 'w' | 'b',
): { ok: true; fen: string } | { ok: false; error: string } {
  const fen = composeFen(placement, turn)
  if (!isValidFen(fen)) {
    return { ok: false, error: 'Invalid position: both kings must be on the board.' }
  }
  return { ok: true, fen }
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run src/game/editor.test.ts`
Expected: PASS, 4 tests.

Verified against `chess.js@1.4.0`: `validateFen` rejects a kingless position on its own, with the message `Invalid FEN: missing white king`. A separate manual check for the kings is unnecessary.

- [ ] **Step 5: Write `src/ui/PositionEditor.tsx`**

A separate board in free mode. Click a piece in the palette, then click a square — the piece is placed. Click an occupied square with an empty palette and it is removed.

```tsx
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import { useEffect, useRef, useState } from 'react'
import { EMPTY_PLACEMENT, composeFen, validatePlacement } from '../game/editor'
import '../ui/board.css'

const PIECES = [
  { key: 'wK', role: 'king', color: 'white', label: '♔' },
  { key: 'wQ', role: 'queen', color: 'white', label: '♕' },
  { key: 'wR', role: 'rook', color: 'white', label: '♖' },
  { key: 'wB', role: 'bishop', color: 'white', label: '♗' },
  { key: 'wN', role: 'knight', color: 'white', label: '♘' },
  { key: 'wP', role: 'pawn', color: 'white', label: '♙' },
  { key: 'bK', role: 'king', color: 'black', label: '♚' },
  { key: 'bQ', role: 'queen', color: 'black', label: '♛' },
  { key: 'bR', role: 'rook', color: 'black', label: '♜' },
  { key: 'bB', role: 'bishop', color: 'black', label: '♝' },
  { key: 'bN', role: 'knight', color: 'black', label: '♞' },
  { key: 'bP', role: 'pawn', color: 'black', label: '♟' },
] as const

export type PositionEditorProps = {
  initialFen: string
  onApply: (fen: string) => void
  onCancel: () => void
}

export function PositionEditor({ initialFen, onApply, onCancel }: PositionEditorProps) {
  const element = useRef<HTMLDivElement>(null)
  const api = useRef<Api | null>(null)
  const [selected, setSelected] = useState<(typeof PIECES)[number] | null>(null)
  const [turn, setTurn] = useState<'w' | 'b'>('w')
  const [error, setError] = useState<string | null>(null)

  const selectedRef = useRef(selected)
  selectedRef.current = selected

  useEffect(() => {
    if (!element.current) return
    api.current = Chessground(element.current, {
      fen: initialFen,
      movable: { free: true, color: 'both' },
      draggable: { deleteOnDropOff: true },
      events: {
        select: (square) => {
          const piece = selectedRef.current
          const board = api.current
          if (!board) return
          if (piece) {
            board.setPieces(new Map([[square, { role: piece.role, color: piece.color }]]))
          } else {
            board.setPieces(new Map([[square, undefined]]))
          }
        },
      },
    })
    return () => {
      api.current?.destroy()
      api.current = null
    }
  }, [initialFen])

  const apply = () => {
    const placement = api.current?.getFen() ?? EMPTY_PLACEMENT
    const result = validatePlacement(placement, turn)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    onApply(result.fen)
  }

  return (
    <section className="position-editor">
      <div className="board-wrap" ref={element} />

      <div className="palette">
        <button type="button" onClick={() => setSelected(null)} aria-pressed={selected === null}>
          Eraser
        </button>
        {PIECES.map((piece) => (
          <button
            key={piece.key}
            type="button"
            aria-pressed={selected?.key === piece.key}
            onClick={() => setSelected(piece)}
          >
            {piece.label}
          </button>
        ))}
      </div>

      <div className="editor-controls">
        <button type="button" onClick={() => api.current?.set({ fen: EMPTY_PLACEMENT })}>
          Clear board
        </button>
        <label>
          <input type="radio" checked={turn === 'w'} onChange={() => setTurn('w')} /> White to move
        </label>
        <label>
          <input type="radio" checked={turn === 'b'} onChange={() => setTurn('b')} /> Black to move
        </label>
        <button type="button" onClick={apply}>
          Apply
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {error && <p role="alert">{error}</p>}
    </section>
  )
}
```

The editor zeroes out castling rights — they cannot be recovered from a placement. This is a deliberate simplification: anyone who needs castling pastes a FEN.

- [ ] **Step 6: Wire it into `src/App.tsx`**

```tsx
const [editing, setEditing] = useState(false)

const applyEditedFen = useCallback(
  (fen: string) => {
    setEditing(false)
    setPreview(null)
    loadGame(createGame(fen))
  },
  [loadGame],
)
```

Render an "Edit position" button (`onClick={() => setEditing(true)}`), and when `editing === true`, show `<PositionEditor initialFen={state.fen} onApply={applyEditedFen} onCancel={() => setEditing(false)} />` in place of the main board.

- [ ] **Step 7: Check by hand**

Run: `npm run dev`
Expected: the button opens the editor. Picking the queen from the palette and clicking `d4` places a white queen. "Eraser" plus a click removes a piece. "Clear board" plus "Apply" shows the error about the kings. Setting up mate in one and pressing "Apply" returns to the analyzer with a score of `M1`.

- [ ] **Step 8: Commit**

```bash
git add src/game/editor.ts src/game/editor.test.ts src/ui/PositionEditor.tsx src/App.tsx
git commit -m "feat(ui): add manual position editor"
git push
```

---

### Task 14: The router and page stubs

**Files:**
- Create: `src/pages/Analyzer.tsx`
- Create: `src/pages/PlayVsComputer.tsx`
- Create: `src/pages/Freestyle.tsx`
- Create: `src/pages/ImportGame.tsx`
- Create: `src/pages/BestMove.tsx`
- Create: `src/ui/Nav.tsx`
- Modify: `src/App.tsx`
- Modify: `package.json` (add `react-router`)

**Interfaces:**
- Consumes: everything from the previous tasks.
- Produces: the `/`, `/play`, `/freestyle`, `/import`, `/best-move` routes.

- [ ] **Step 1: Install the router**

```bash
npm i react-router@^7
```

- [ ] **Step 2: Move the contents of `App.tsx` into `src/pages/Analyzer.tsx`**

The current body of `App` moves over wholesale, together with its imports, and is exported as `export function Analyzer()`.

- [ ] **Step 3: Create the four stubs**

One file each. `src/pages/PlayVsComputer.tsx`:

```tsx
export function PlayVsComputer() {
  return <p>Play against the computer will arrive in sub-project 2.</p>
}
```

`src/pages/Freestyle.tsx`:

```tsx
export function Freestyle() {
  return <p>Chess960 will arrive in sub-project 2.</p>
}
```

`src/pages/ImportGame.tsx`:

```tsx
export function ImportGame() {
  return <p>Game import will arrive in sub-project 3.</p>
}
```

`src/pages/BestMove.tsx`:

```tsx
export function BestMove() {
  return <p>Best-move search will arrive alongside the simplified analyzer interface.</p>
}
```

- [ ] **Step 4: Create `src/ui/Nav.tsx`**

```tsx
import { NavLink } from 'react-router'

const LINKS = [
  { to: '/', label: 'Analyzer' },
  { to: '/best-move', label: 'Best move' },
  { to: '/play', label: 'Play vs computer' },
  { to: '/freestyle', label: 'Chess960' },
  { to: '/import', label: 'Import game' },
]

export function Nav() {
  return (
    <nav>
      {LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} end>
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: Rewrite `src/App.tsx`**

```tsx
import { BrowserRouter, Route, Routes } from 'react-router'
import { Analyzer } from './pages/Analyzer'
import { BestMove } from './pages/BestMove'
import { Freestyle } from './pages/Freestyle'
import { ImportGame } from './pages/ImportGame'
import { PlayVsComputer } from './pages/PlayVsComputer'
import { Nav } from './ui/Nav'

export function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Analyzer />} />
        <Route path="/best-move" element={<BestMove />} />
        <Route path="/play" element={<PlayVsComputer />} />
        <Route path="/freestyle" element={<Freestyle />} />
        <Route path="/import" element={<ImportGame />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, every file. Not one test from the earlier tasks is broken.

- [ ] **Step 7: Check by hand**

Run: `npm run dev`
Expected: the navigation switches pages; on `/` the analyzer works as before; leaving `/` for another page stops the engine (no continuing stream of `info` in the console).

- [ ] **Step 8: Update `README.md`**

```markdown
# Chess Analyzer

A local chess analyzer: Stockfish 18 in the browser, no backend.

## Run

    npm install
    npm run dev

Open http://localhost:5173

## Tests

    npm test

## License

GPL-3.0 (a Stockfish requirement).
```

- [ ] **Step 9: Commit**

```bash
git add src/pages/ src/ui/Nav.tsx src/App.tsx README.md package.json package-lock.json
git commit -m "feat: add router and stub pages for remaining tools"
git push
```

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| COOP/COEP headers, choosing the engine build | 1 |
| The UCI parser | 2 |
| The `EngineTransport` seam, Worker and Node | 3 |
| `analyze` / `stop`, correct search interruption | 4 |
| The game module, FEN, PGN, legality | 5 |
| A chessground board with dragging | 6 |
| The `useAnalysis` bridge, eval bar, line list, throttling, single-threaded warning | 7 |
| Best-move arrows | 8 |
| FEN and PGN input, input error handling | 9 |
| Settings in `localStorage` | 10 |
| Recovering from a worker crash | 11 |
| Scrolling through a line by clicking its moves | 12 |
| The position editor (the fourth input method) | 13 |
| The router and the remaining pages | 14 |

## What is out of scope for this plan

Sub-projects 2, 3 and 4 from the spec: play against the computer and Chess960, game import and review, the AI chat. Each will get its own spec and its own plan.

Noted separately inside Task 13: the position editor zeroes out castling rights and the en-passant square, because they cannot be recovered from a piece placement. A user who needs castling enters a FEN directly.
