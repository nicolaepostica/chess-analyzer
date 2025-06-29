// Decodes chess.com's TCN move encoding and rebuilds a PGN from it.
//
// chess.com's /callback/{live,daily}/game/<id> endpoint returns the moves as
// TCN: two characters per move, each an index into ALPHABET. 0–63 are squares
// (a1 = 0, b1 = 1, …, h8 = 63); a target above 63 is a promotion that encodes
// the piece and the direction (straight or diagonal) instead of the square.
//
// Loaded as a content script before content.js; also imported by the tests.
;(() => {
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++='
  const PROMOTIONS = 'qnrbkp'
  const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  const square = (index) => 'abcdefgh'[index % 8] + (Math.floor(index / 8) + 1)

  function decodeTcn(tcn) {
    const moves = []
    for (let i = 0; i + 1 < tcn.length; i += 2) {
      const from = ALPHABET.indexOf(tcn[i])
      let to = ALPHABET.indexOf(tcn[i + 1])
      let promotion
      if (to > 63) {
        promotion = PROMOTIONS[Math.floor((to - 64) / 3)]
        to = from + (from < 16 ? -8 : 8) + ((to - 1) % 3) - 1
      }
      const move = { from: square(from), to: square(to) }
      if (promotion) move.promotion = promotion
      moves.push(move)
    }
    return moves
  }

  /** King squares from a FEN placement, so castling can be told apart from other two-file moves. */
  function kingSquares(fen) {
    const kings = {}
    fen
      .split(' ')[0]
      .split('/')
      .forEach((row, r) => {
        let file = 0
        for (const char of row) {
          if (/\d/.test(char)) file += Number(char)
          else {
            if (char === 'K') kings.w = 'abcdefgh'[file] + (8 - r)
            if (char === 'k') kings.b = 'abcdefgh'[file] + (8 - r)
            file += 1
          }
        }
      })
    return kings
  }

  const escape = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  /**
   * A PGN chess.js can load: chess.com's headers plus the moves in coordinate
   * form (e2e4, b7b8q), with castling written as O-O / O-O-O.
   */
  function buildPgn(headers, tcn) {
    const fen = headers.FEN || STANDARD_FEN
    const kings = kingSquares(fen)
    let side = fen.split(' ')[1] === 'b' ? 'b' : 'w'
    let number = Number(fen.split(' ')[5]) || 1

    const tokens = []
    decodeTcn(tcn).forEach((move, i) => {
      let text = move.from + move.to + (move.promotion || '')
      if (move.from === kings[side]) {
        const step = move.to.charCodeAt(0) - move.from.charCodeAt(0)
        if (Math.abs(step) === 2) text = step > 0 ? 'O-O' : 'O-O-O'
        kings[side] = move.to
      }
      if (side === 'w') tokens.push(`${number}.`)
      else if (i === 0) tokens.push(`${number}...`)
      tokens.push(text)
      if (side === 'b') number += 1
      side = side === 'w' ? 'b' : 'w'
    })

    const tags = Object.entries(headers).map(([key, value]) => `[${key} "${escape(value)}"]`)
    return `${tags.join('\n')}\n\n${tokens.join(' ')} ${headers.Result || '*'}\n`
  }

  globalThis.chessAnalyzerTcn = { decodeTcn, buildPgn }
})()
