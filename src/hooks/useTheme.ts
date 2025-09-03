import { useCallback, useEffect, useState } from 'react'

// index.html applies the stored theme before the app loads, so the first paint
// is already in the right colours; keep the key and ids in sync with it.
const STORAGE_KEY = 'chess-analyzer:theme'

export type ThemeId = 'charcoal' | 'lichess' | 'wood'

/** `swatch`: page background and accent, for the picker. */
export const THEMES: { id: ThemeId; name: string; swatch: [string, string] }[] = [
  { id: 'charcoal', name: 'Charcoal', swatch: ['#312E2B', '#81B64C'] },
  { id: 'lichess', name: 'Lichess-style', swatch: ['#161512', '#4A9FED'] },
  { id: 'wood', name: 'Wood', swatch: ['#1C1814', '#D9A441'] },
]

const DEFAULT: ThemeId = 'charcoal'

function read(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEMES.some((t) => t.id === stored) ? (stored as ThemeId) : DEFAULT
  } catch {
    return DEFAULT
  }
}

export function useTheme(): [ThemeId, (theme: ThemeId) => void] {
  const [theme, setTheme] = useState<ThemeId>(read)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const choose = useCallback((next: ThemeId) => {
    setTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode: the theme simply won't survive a reload.
    }
  }, [])

  return [theme, choose]
}
