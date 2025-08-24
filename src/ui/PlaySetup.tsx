import { LEVELS, TIME_CONTROLS } from '../game/levels'
import type { PlaySettings } from '../hooks/usePlaySettings'

export type PlaySetupProps = {
  settings: PlaySettings
  onChange: (patch: Partial<PlaySettings>) => void
  onStart: () => void
}

const CHIP = 'rounded-full border px-3 py-1.5 text-sm transition-colors'
const chip = (on: boolean) =>
  `${CHIP} ${on ? 'border-accent/60 bg-accent/12 text-fg' : 'border-border text-fg-secondary hover:text-fg'}`

const COLORS = [
  { id: 'w', label: 'White' },
  { id: 'random', label: 'Random' },
  { id: 'b', label: 'Black' },
] as const

export function PlaySetup({ settings, onChange, onStart }: PlaySetupProps) {
  const level = LEVELS.find((l) => l.level === settings.level) ?? LEVELS[4]
  const label = level.label === 'Max' ? 'Max strength' : `${level.label} Elo`

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor="level" className="mb-2 block text-sm text-fg-secondary">
          Strength
        </label>
        <input
          id="level"
          type="range"
          min={1}
          max={LEVELS.length}
          value={settings.level}
          onChange={(event) => onChange({ level: Number(event.target.value) })}
          className="w-full accent-accent"
        />
        <p className="mt-1 text-center font-display text-lg text-fg">
          Level {level.level} · {label}
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm text-fg-secondary">Play as</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              aria-pressed={settings.color === color.id}
              className={chip(settings.color === color.id)}
              onClick={() => onChange({ color: color.id })}
            >
              {color.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-fg-secondary">Time control</p>
        <div className="flex flex-wrap gap-2">
          {TIME_CONTROLS.map((tc) => (
            <button
              key={tc.id}
              type="button"
              aria-pressed={settings.timeControl === tc.id}
              className={chip(settings.timeControl === tc.id)}
              onClick={() => onChange({ timeControl: tc.id })}
            >
              {tc.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="self-start rounded-lg bg-accent px-4 py-2 font-semibold text-bg hover:bg-accent/85"
        onClick={onStart}
      >
        Start game
      </button>
    </div>
  )
}
