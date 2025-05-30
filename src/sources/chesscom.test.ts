import { describe, expect, it, vi } from 'vitest'
import archive from './fixtures/archive-2025-04.json'
import { fetchChessComPgn, parseReviewParams } from './chesscom'

describe('parseReviewParams', () => {
  it('is none without params', () => {
    expect(parseReviewParams('')).toEqual({ kind: 'none' })
  })

  it('prefers an inline PGN', () => {
    expect(parseReviewParams('?pgn=1.%20e4&source=chesscom&game=1&user=bob')).toEqual({
      kind: 'pgn',
      pgn: '1. e4',
      user: 'bob',
    })
  })

  it('reads a chess.com request', () => {
    expect(parseReviewParams('?source=chesscom&game=123&user=Bob&month=2025-04')).toEqual({
      kind: 'chesscom',
      game: '123',
      user: 'Bob',
      month: '2025-04',
    })
  })

  it('treats month as optional', () => {
    expect(parseReviewParams('?source=chesscom&game=123&user=Bob')).toMatchObject({ month: null })
  })

  it.each([
    ['?source=chesscom&game=123'],
    ['?source=chesscom&game=abc&user=bob'],
    ['?source=chesscom&game=123&user=bob&month=2025-13'],
    ['?source=lichess&game=123&user=bob'],
  ])('rejects %s', (search) => {
    expect(parseReviewParams(search).kind).toBe('invalid')
  })
})

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

describe('fetchChessComPgn', () => {
  it('finds the game in the given month', async () => {
    const fetchImpl = vi.fn((_url: string) => json(archive))
    const result = await fetchChessComPgn({ game: '123456789', user: 'Bob', month: '2025-04' }, fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith('https://api.chess.com/pub/player/bob/games/2025/04')
    expect(result).toEqual({ ok: true, pgn: archive.games[0].pgn })
  })

  it('reports a game missing from the archive', async () => {
    const result = await fetchChessComPgn({ game: '42', user: 'bob', month: '2025-04' }, () => json(archive))
    expect(result).toEqual({ ok: false, reason: 'not-found' })
  })

  it('treats an HTTP 404 as not found', async () => {
    const result = await fetchChessComPgn({ game: '42', user: 'bob', month: '2025-04' }, () =>
      json({ message: 'nope' }, 404),
    )
    expect(result).toEqual({ ok: false, reason: 'not-found' })
  })

  it('treats an empty archive as not found', async () => {
    const result = await fetchChessComPgn({ game: '42', user: 'bob', month: '2025-04' }, () => json({ games: [] }))
    expect(result).toEqual({ ok: false, reason: 'not-found' })
  })

  it('reports network failures', async () => {
    const result = await fetchChessComPgn({ game: '42', user: 'bob', month: '2025-04' }, () =>
      Promise.reject(new TypeError('Failed to fetch')),
    )
    expect(result).toEqual({ ok: false, reason: 'network' })
  })

  it('tries the current and the previous month when the month is unknown', async () => {
    const fetchImpl = vi.fn((url: string) => (url.endsWith('/2025/04') ? json(archive) : json({ games: [] })))
    const result = await fetchChessComPgn(
      { game: '123456789', user: 'bob', month: null },
      fetchImpl,
      new Date(2025, 4, 2),
    )
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://api.chess.com/pub/player/bob/games/2025/05',
      'https://api.chess.com/pub/player/bob/games/2025/04',
    ])
    expect(result.ok).toBe(true)
  })

  it('wraps to December of the previous year', async () => {
    const fetchImpl = vi.fn((_url: string) => json({ games: [] }))
    await fetchChessComPgn({ game: '1', user: 'bob', month: null }, fetchImpl, new Date(2025, 0, 5))
    expect(fetchImpl.mock.calls.at(-1)?.[0]).toBe('https://api.chess.com/pub/player/bob/games/2024/12')
  })
})
