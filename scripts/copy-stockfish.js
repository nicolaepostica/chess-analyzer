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

// GitHub Pages cannot send COOP/COEP headers. This MIT-licensed shim re-serves
// the page through a service worker that adds them, so the multi-threaded
// engine works there too. It is a no-op where the headers already exist.
const coi = join(dirname(require.resolve('coi-serviceworker/package.json')), 'coi-serviceworker.min.js')
copyFileSync(coi, join(process.cwd(), 'public', 'coi-serviceworker.min.js'))
console.log('Copied coi-serviceworker.min.js to public/')
