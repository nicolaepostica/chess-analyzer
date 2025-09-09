import { useCallback, useState } from 'react'
import { LEVELS, TIME_CONTROLS, type CustomTime } from '../game/levels'

const STORAGE_KEY = 'chess-analyzer:play'

export type PlaySettings = { level: number; color: 'w' | 'b' | 'random'; timeControl: string; custom: CustomTime }

export const DEFAULT_PLAY_SETTINGS: PlaySettings = {
  level: 5,
  color: 'random',
  timeControl: '5+0',
  custom: { minutes: 10, increment: 0 },
}

const isCustom = (raw: unknown): raw is CustomTime =>
  typeof raw === 'object' &&
  raw !== null &&
  Number.isFinite((raw as CustomTime).minutes) &&
  Number.isFinite((raw as CustomTime).increment)

function sanitize(raw: unknown): PlaySettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_PLAY_SETTINGS
  const candidate = raw as Partial<PlaySettings>
  return {
    level: LEVELS.some((l) => l.level === candidate.level) ? candidate.level! : DEFAULT_PLAY_SETTINGS.level,
    color: candidate.color === 'w' || candidate.color === 'b' || candidate.color === 'random' ? candidate.color : DEFAULT_PLAY_SETTINGS.color,
    timeControl:
      candidate.timeControl === 'custom' || TIME_CONTROLS.some((t) => t.id === candidate.timeControl)
        ? candidate.timeControl!
        : DEFAULT_PLAY_SETTINGS.timeControl,
    custom: isCustom(candidate.custom) ? candidate.custom : DEFAULT_PLAY_SETTINGS.custom,
  }
}

function read(): PlaySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? sanitize(JSON.parse(stored)) : DEFAULT_PLAY_SETTINGS
  } catch {
    return DEFAULT_PLAY_SETTINGS
  }
}

/** The last level, colour and time control, remembered between visits. */
export function usePlaySettings(): [PlaySettings, (patch: Partial<PlaySettings>) => void] {
  const [settings, setSettings] = useState<PlaySettings>(read)

  const update = useCallback((patch: Partial<PlaySettings>) => {
    setSettings((current) => {
      const next = sanitize({ ...current, ...patch })
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Private mode: the choice just won't survive a reload.
      }
      return next
    })
  }, [])

  return [settings, update]
}
