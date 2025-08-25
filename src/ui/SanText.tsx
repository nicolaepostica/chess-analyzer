import { figurine } from './figurine'

/** A SAN move with its piece letters drawn as figurines, sized for monospace move lists. */
export function SanText({ san, color }: { san: string; color: 'w' | 'b' }) {
  return (
    <span>
      {[...figurine(san, color)].map((char, i) =>
        // Monospace fonts draw chess glyphs tiny; give them a text font and room.
        /[♔-♟]/.test(char) ? (
          <span key={i} className="mx-1 inline-block origin-bottom scale-[1.6] font-sans text-[15px] leading-none">
            {char}
          </span>
        ) : (
          char
        ),
      )}
    </span>
  )
}
