// Adds an "Analyze free" button to finished games on chess.com. The button
// opens Chess Analyzer's Game Review with the game in the URL. It talks only to
// www.chess.com (same origin) and sends nothing anywhere else.
;(() => {
  // Switch to 'http://localhost:5173/' while developing the app.
  const REVIEW_BASE = 'https://nicolaepostica.github.io/chess-analyzer/'

  // Selectors observed on chess.com on 2025-06-27. If chess.com changes its
  // markup, these are the lines to update.
  const GAME_REVIEW_BUTTONS = '.game-review-buttons-component' // sidebar block of a finished game
  const ARCHIVE_ROW = '.game-history-games-row' // one game in /games/archive/<user>
  const ARCHIVE_CELL = '.game-history-games-accuracy-cell'
  const BOTTOM_PLAYER = '.player-bottom .cc-user-username-component'
  const GAME_LINK = 'a[href*="/game/live/"], a[href*="/game/daily/"]'

  const MARK = 'data-chess-analyzer'
  const GAME_PATH = /\/game\/(live|daily)\/(\d+)/

  const sameName = (a, b) => Boolean(a && b) && a.toLowerCase() === b.toLowerCase()

  /** The player whose side the review shows: a known candidate who played, else White. */
  function chooseUser(headers, candidates) {
    for (const name of candidates) {
      if (sameName(name, headers.White)) return headers.White
      if (sameName(name, headers.Black)) return headers.Black
    }
    return headers.White || candidates.find(Boolean) || ''
  }

  async function reviewUrl(kind, id, candidates) {
    const params = new URLSearchParams({ source: 'chesscom', game: id })
    try {
      const response = await fetch(`/callback/${kind}/game/${id}`, { credentials: 'include' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const { game } = await response.json()
      const headers = { ...game.pgnHeaders }
      if (game.typeName && game.typeName !== 'Standard Chess') headers.Variant = game.typeName
      params.set('user', chooseUser(headers, candidates))
      const date = /^(\d{4})\.(\d{2})/.exec(headers.Date || '')
      if (date) params.set('month', `${date[1]}-${date[2]}`)
      if (game.moveList) params.set('pgn', globalThis.chessAnalyzerTcn.buildPgn(headers, game.moveList))
    } catch (error) {
      // Without the callback the page falls back to the public API archive.
      console.warn('[Chess Analyzer] could not read the game, falling back to the archive lookup', error)
      params.set('user', candidates.find(Boolean) || '')
    }
    return `${REVIEW_BASE}import?${params}`
  }

  function makeButton(kind, id, candidates, compact) {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute(MARK, id)
    button.textContent = compact ? 'Analyze' : 'Analyze free'
    button.title = 'Open a free Stockfish review in Chess Analyzer'
    Object.assign(button.style, {
      marginTop: compact ? '0' : '8px',
      marginLeft: compact ? '6px' : '0',
      width: compact ? 'auto' : '100%',
      padding: compact ? '2px 8px' : '10px 12px',
      border: 'none',
      borderRadius: '6px',
      background: '#2DD4FF',
      color: '#04050A',
      font: `600 ${compact ? '12px' : '15px'}/1.2 system-ui, sans-serif`,
      cursor: 'pointer',
    })
    button.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      // Open the tab now, inside the click, or the popup blocker steps in.
      const tab = window.open('about:blank', '_blank')
      const url = await reviewUrl(kind, id, candidates())
      if (tab) {
        tab.opener = null
        tab.location.href = url
      } else window.open(url, '_blank', 'noopener')
    })
    return button
  }

  function decorateGamePage() {
    const match = GAME_PATH.exec(location.pathname)
    const anchor = document.querySelector(GAME_REVIEW_BUTTONS)
    if (!match || !anchor) return
    const [, kind, id] = match
    const existing = document.querySelector(`button[${MARK}]`)
    if (existing?.getAttribute(MARK) === id) return
    existing?.remove() // SPA navigation to another game
    const candidates = () => [
      new URLSearchParams(location.search).get('username'),
      // chess.com puts the signed-in player at the bottom when they played.
      document.querySelector(BOTTOM_PLAYER)?.textContent.trim(),
    ]
    anchor.after(makeButton(kind, id, candidates, false))
  }

  function decorateArchive() {
    const owner = /\/games\/archive\/([^/?#]+)/.exec(location.pathname)?.[1]
    for (const row of document.querySelectorAll(`${ARCHIVE_ROW}:not([${MARK}])`)) {
      const link = [...row.querySelectorAll(GAME_LINK)].find((a) => !a.pathname.startsWith('/analysis/'))
      const match = link && GAME_PATH.exec(link.pathname)
      if (!match) continue
      row.setAttribute(MARK, match[2])
      const candidates = () => [new URL(link.href).searchParams.get('username'), owner]
      const cell = row.querySelector(ARCHIVE_CELL) || row.lastElementChild || row
      cell.append(makeButton(match[1], match[2], candidates, true))
    }
  }

  let scheduled = false
  const decorate = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      decorateGamePage()
      decorateArchive()
    })
  }

  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true })
  decorate()
})()
