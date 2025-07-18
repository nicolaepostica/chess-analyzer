// Filled glyphs for White and outlined ones for Black read best on the dark theme.
const WHITE: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' }
const BLACK: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' }

/** SAN with piece letters drawn as chess figurines: Nxd5 → ♞xd5, e8=Q → e8=♛. */
export function figurine(san: string, color: 'w' | 'b'): string {
  const glyphs = color === 'w' ? WHITE : BLACK
  return san.replace(/[KQRBN]/g, (letter) => glyphs[letter])
}
