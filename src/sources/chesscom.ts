// Turns the review page's URL params into a game, using chess.com's public API.
// The API has no "game by id" endpoint, so the game is looked up in its
// player's monthly archive.

export type ReviewRequest =
  | { kind: 'none' }
  | { kind: 'pgn'; pgn: string; user: string | null }
  | { kind: 'chesscom'; game: string; user: string; month: string | null }
  | { kind: 'invalid'; message: string }

export type FetchResult = { ok: true; pgn: string } | { ok: false; reason: 'not-found' | 'network' }

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

export function parseReviewParams(search: string): ReviewRequest {
  const params = new URLSearchParams(search)
  const pgn = params.get('pgn')
  const user = params.get('user')
  if (pgn) return { kind: 'pgn', pgn, user }

  const source = params.get('source')
  if (source === null && !params.has('game')) return { kind: 'none' }
  if (source !== 'chesscom') return { kind: 'invalid', message: `Unknown source: ${source ?? 'none'}` }

  const game = params.get('game') ?? ''
  if (!/^\d+$/.test(game)) return { kind: 'invalid', message: 'Missing or malformed game id' }
  if (!user) return { kind: 'invalid', message: 'Missing user' }

  const month = params.get('month')
  if (month !== null && !MONTH.test(month)) return { kind: 'invalid', message: `Malformed month: ${month}` }

  return { kind: 'chesscom', game, user, month }
}

type Archive = { games?: { url: string; pgn?: string }[] }

const pad = (month: number) => String(month).padStart(2, '0')

function monthsToTry(month: string | null, now: Date): string[] {
  if (month) return [month.replace('-', '/')]
  const year = now.getFullYear()
  const current = now.getMonth() + 1
  const previous = current === 1 ? `${year - 1}/12` : `${year}/${pad(current - 1)}`
  return [`${year}/${pad(current)}`, previous]
}

export async function fetchChessComPgn(
  req: { game: string; user: string; month: string | null },
  fetchImpl: (url: string) => Promise<Response> = (url) => fetch(url),
  now: Date = new Date(),
): Promise<FetchResult> {
  const user = encodeURIComponent(req.user.toLowerCase())
  for (const month of monthsToTry(req.month, now)) {
    let archive: Archive
    try {
      const response = await fetchImpl(`https://api.chess.com/pub/player/${user}/games/${month}`)
      if (!response.ok) continue
      archive = (await response.json()) as Archive
    } catch {
      return { ok: false, reason: 'network' }
    }
    const game = archive.games?.find((candidate) => candidate.url.endsWith(`/${req.game}`))
    if (game?.pgn) return { ok: true, pgn: game.pgn }
  }
  return { ok: false, reason: 'not-found' }
}
