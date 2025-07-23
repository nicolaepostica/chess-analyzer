// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { GameRecord } from '../game/record'
import type { GameReviewState } from '../hooks/useGameReview'
import type { FetchResult } from '../sources/chesscom'
import type { BoardProps } from '../ui/Board'

vi.mock('../ui/Board', () => ({
  Board: ({ fen, orientation }: BoardProps) => <div data-testid="board" data-fen={fen} data-orientation={orientation} />,
}))

let reviewState: Partial<GameReviewState> = {}
const reviewedRecords: (GameRecord | null)[] = []
vi.mock('../hooks/useGameReview', () => ({
  useGameReview: (record: GameRecord | null) => {
    reviewedRecords.push(record)
    return {
      result: { moves: [], whiteWins: [], accuracy: null },
      evaluated: 0,
      total: record?.positions.length ?? 0,
      done: false,
      multiThreaded: true,
      error: null,
      ...reviewState,
    }
  },
}))

const fetchChessComPgn = vi.fn<(...args: unknown[]) => Promise<FetchResult>>()
vi.mock('../sources/chesscom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sources/chesscom')>()),
  fetchChessComPgn: (...args: unknown[]) => fetchChessComPgn(...args),
}))

const { GameReview } = await import('./GameReview')

const SCHOLAR = '[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0'
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

const visit = (search: string) => window.history.pushState({}, '', `/import${search}`)
const lastRecord = () => reviewedRecords.at(-1) ?? null
const board = () => screen.getByTestId('board')

beforeEach(() => {
  reviewState = {}
  reviewedRecords.length = 0
  fetchChessComPgn.mockReset()
  visit('')
})

it('reviews a pasted PGN', async () => {
  render(<GameReview />)
  await userEvent.type(screen.getByRole('textbox'), SCHOLAR.replace(/\[/g, '[['))
  await userEvent.click(screen.getByRole('button', { name: 'Review PGN' }))
  expect(lastRecord()?.moves).toHaveLength(7)
})

it('loads a chess.com game from the URL', async () => {
  fetchChessComPgn.mockResolvedValue({ ok: true, pgn: SCHOLAR })
  visit('?source=chesscom&game=123&user=bob&month=2025-04')
  render(<GameReview />)
  expect(fetchChessComPgn).toHaveBeenCalledWith({ kind: 'chesscom', game: '123', user: 'bob', month: '2025-04' })
  await waitFor(() => expect(lastRecord()?.moves).toHaveLength(7))
})

it('offers a retry and the PGN box when the game is not in the archive yet', async () => {
  fetchChessComPgn.mockResolvedValue({ ok: false, reason: 'not-found' })
  visit('?source=chesscom&game=123&user=bob')
  render(<GameReview />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Game not found in the archive yet — chess.com may take a minute to publish it',
  )
  expect(document.querySelector('#pgn-input')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(fetchChessComPgn).toHaveBeenCalledTimes(2)
})

it('says when chess.com cannot be reached', async () => {
  fetchChessComPgn.mockResolvedValue({ ok: false, reason: 'network' })
  visit('?source=chesscom&game=123&user=bob')
  render(<GameReview />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach chess.com.')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})

it('refuses variants', () => {
  visit(`?pgn=${encodeURIComponent('[Variant "Chess960"]\n\n1. e4 *')}`)
  render(<GameReview />)
  expect(screen.getByRole('alert')).toHaveTextContent("This variant isn't supported yet")
  expect(lastRecord()).toBeNull()
})

it('refuses a game without moves', () => {
  visit(`?pgn=${encodeURIComponent('[White "a"]\n\n*')}`)
  render(<GameReview />)
  expect(screen.getByRole('alert')).toHaveTextContent('This game has no moves to review')
})

it("puts the user's colour at the bottom, ignoring case", () => {
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}&user=BOB`)
  render(<GameReview />)
  expect(board()).toHaveAttribute('data-orientation', 'black')
  expect(screen.getByText('You')).toBeInTheDocument()
  expect(screen.getByText('Opponent')).toBeInTheDocument()
})

it('falls back to PGN names when the user did not play', () => {
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}&user=carol`)
  render(<GameReview />)
  expect(board()).toHaveAttribute('data-orientation', 'white')
  expect(screen.getByText('Alice')).toBeInTheDocument()
  expect(screen.getByText('Bob')).toBeInTheDocument()
})

it('shows progress while reviewing', () => {
  reviewState = { evaluated: 3, total: 8, done: false }
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  const { rerender } = render(<GameReview />)
  expect(screen.getByTestId('review-progress')).toHaveTextContent('Analyzing… 3 / 8')

  reviewState = { evaluated: 8, total: 8, done: true }
  rerender(<GameReview />)
  expect(screen.queryByTestId('review-progress')).not.toBeInTheDocument()
})

it('steps through the game with the keyboard', async () => {
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  render(<GameReview />)
  expect(board()).toHaveAttribute('data-fen', START)

  await userEvent.keyboard('{ArrowRight}')
  expect(board()).toHaveAttribute('data-fen', AFTER_E4)
  await userEvent.keyboard('{ArrowLeft}')
  expect(board()).toHaveAttribute('data-fen', START)
  await userEvent.keyboard('{End}')
  expect(board()).toHaveAttribute('data-fen', lastRecord()!.positions[7])
  await userEvent.keyboard('{Home}')
  expect(board()).toHaveAttribute('data-fen', START)
})

it('opens the position in the analyzer in a new tab', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  const { reviewedMove } = await import('../ui/review.fixtures')
  reviewState = { result: { moves: [reviewedMove({ ply: 0, label: 'best' })], whiteWins: [50, 50], accuracy: null } }
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  render(<GameReview />)

  await userEvent.keyboard('{ArrowRight}')
  await userEvent.click(screen.getByRole('button', { name: 'Analyze position' }))
  expect(open).toHaveBeenCalledWith(`/?fen=${encodeURIComponent(START)}`, '_blank')
  open.mockRestore()
})

it('reports a slow engine and engine errors', () => {
  reviewState = { multiThreaded: false, error: 'The engine crashed. Please reload the page.' }
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  render(<GameReview />)
  const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent)
  expect(alerts.some((text) => text?.includes('Multi-threaded engine unavailable'))).toBe(true)
  expect(alerts).toContain('The engine crashed. Please reload the page.')
})

it('ignores arrow keys while typing in the PGN box', async () => {
  render(<GameReview />)
  await act(async () => {
    await userEvent.type(screen.getByRole('textbox'), '{ArrowRight}')
  })
  expect(lastRecord()).toBeNull()
})

it('shows the result on the eval bar after mate', async () => {
  const { reviewedMove } = await import('../ui/review.fixtures')
  const moves = Array.from({ length: 7 }, (_, ply) =>
    reviewedMove({ ply, label: 'best', playedScoreWhite: ply === 6 ? null : { type: 'cp', value: 30 } }),
  )
  reviewState = { result: { moves, whiteWins: [50, 50, 50, 50, 50, 50, 50, 100], accuracy: null } }
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  render(<GameReview />)

  await userEvent.keyboard('{End}')
  expect(screen.getByTestId('eval-bar')).toHaveTextContent('1-0')
})

it('leaves the eval bar empty on a ply the engine has not reached', async () => {
  const { reviewedMove } = await import('../ui/review.fixtures')
  reviewState = { result: { moves: [reviewedMove({ ply: 0, label: 'best' })], whiteWins: [50, 50], accuracy: null } }
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  render(<GameReview />)

  await userEvent.keyboard('{End}')
  expect(screen.getByTestId('eval-bar')).toHaveTextContent('…')
})

it('navigates with the control buttons', async () => {
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  render(<GameReview />)
  await userEvent.click(screen.getByRole('button', { name: 'Next move' }))
  expect(board()).toHaveAttribute('data-fen', AFTER_E4)
  await userEvent.click(screen.getByRole('button', { name: 'Last move' }))
  expect(board()).toHaveAttribute('data-fen', lastRecord()!.positions[7])
  await userEvent.click(screen.getByRole('button', { name: 'First move' }))
  expect(board()).toHaveAttribute('data-fen', START)
})

it('plays through the game one move per second and stops at the end', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  render(<GameReview />)
  await userEvent.click(screen.getByRole('button', { name: 'Play' }))
  await act(async () => vi.advanceTimersByTime(1000))
  expect(board()).toHaveAttribute('data-fen', AFTER_E4)
  // Each step schedules the next after React commits, so advance one tick at a time.
  for (let tick = 0; tick < 10; tick += 1) await act(async () => vi.advanceTimersByTime(1000))
  expect(board()).toHaveAttribute('data-fen', lastRecord()!.positions[7])
  expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
  vi.useRealTimers()
})

it('puts the evaluation graph under the board', () => {
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  render(<GameReview />)
  const column = board().closest('[data-testid="board-column"]')!
  const graph = screen.getByTestId('eval-graph')
  expect(column).toContainElement(graph)
  expect(board().compareDocumentPosition(graph) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('lays out board, moves and summary as three columns in that order', () => {
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  render(<GameReview />)
  const columns = ['board-column', 'moves-column', 'summary-column'].map((id) => screen.getByTestId(id))
  expect(columns[0].parentElement).toBe(columns[1].parentElement)
  expect(columns[1].parentElement).toBe(columns[2].parentElement)
  expect(columns[0].compareDocumentPosition(columns[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(columns[1].compareDocumentPosition(columns[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(columns[1]).toContainElement(screen.getByRole('button', { name: 'Next move' }))
  expect(columns[2]).toContainElement(screen.getByTestId('accuracy-white'))
})

it('shows the current move above the move list', () => {
  visit(`?pgn=${encodeURIComponent(SCHOLAR)}`)
  render(<GameReview />)
  const thisMove = screen.getByRole('heading', { name: 'This move' })
  const movesHeading = screen.getByRole('heading', { name: 'Moves' })
  expect(thisMove.compareDocumentPosition(movesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
