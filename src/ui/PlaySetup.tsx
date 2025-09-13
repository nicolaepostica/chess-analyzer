import { CUSTOM_LIMITS, LEVELS, TIME_CONTROLS, customTimeControl, isTimed } from '../game/levels'
import type { PlaySettings } from '../hooks/usePlaySettings'

export type PlaySetupProps = {
  settings: PlaySettings
  onChange: (patch: Partial<PlaySettings>) => void
  onStart: () => void
}

const CHIP = 'rounded-full border px-3 py-1.5 text-sm transition-colors'
const chip = (on: boolean) =>
  `${CHIP} ${on ? 'border-accent/60 bg-accent/12 text-fg' : 'border-border text-fg-secondary hover:text-fg'}`

const TILE = 'flex flex-col items-center justify-center gap-0.5 rounded-lg border py-3 transition-colors'
const tile = (on: boolean) =>
  `${TILE} ${on ? 'border-accent/70 bg-accent/12 text-fg' : 'border-transparent bg-well text-fg-secondary hover:text-fg'}`
const FIELD = 'w-full rounded-lg border border-border bg-well px-3 py-1.5 text-fg'

const COLORS = [
  { id: 'w', label: 'White' },
  { id: 'random', label: 'Random' },
  { id: 'b', label: 'Black' },
] as const

export function PlaySetup({ settings, onChange, onStart }: PlaySetupProps) {
  const level = LEVELS.find((l) => l.level === settings.level) ?? LEVELS[4]
  const label = level.label === 'Max' ? 'Max strength' : `${level.label} Elo`
  const customOn = settings.timeControl === 'custom'
  const custom = customTimeControl(settings.custom)

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
        <div className="grid grid-cols-3 gap-2">
          {TIME_CONTROLS.filter(isTimed).map((tc) => (
            <button
              key={tc.id}
              type="button"
              aria-label={tc.label}
              aria-pressed={settings.timeControl === tc.id}
              className={tile(settings.timeControl === tc.id)}
              onClick={() => onChange({ timeControl: tc.id })}
            >
              <span className="font-display text-xl text-fg">{tc.label}</span>
              <span className="text-xs">{tc.category}</span>
            </button>
          ))}
          <button
            type="button"
            aria-label="Custom"
            aria-pressed={customOn}
            className={tile(customOn)}
            onClick={() => onChange({ timeControl: 'custom' })}
          >
            <span className="font-display text-xl text-fg">Custom</span>
            {customOn && <span className="text-xs">{custom.label}</span>}
          </button>
        </div>
        {customOn && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-sm text-fg-secondary">
              Minutes
              <input
                id="custom-minutes"
                type="number"
                min={CUSTOM_LIMITS.minutes.min}
                max={CUSTOM_LIMITS.minutes.max}
                value={settings.custom.minutes}
                onChange={(event) => onChange({ custom: { ...settings.custom, minutes: Number(event.target.value) } })}
                className={`mt-1 ${FIELD}`}
              />
            </label>
            <label className="text-sm text-fg-secondary">
              Increment (s)
              <input
                id="custom-increment"
                type="number"
                min={CUSTOM_LIMITS.increment.min}
                max={CUSTOM_LIMITS.increment.max}
                value={settings.custom.increment}
                onChange={(event) => onChange({ custom: { ...settings.custom, increment: Number(event.target.value) } })}
                className={`mt-1 ${FIELD}`}
              />
            </label>
          </div>
        )}
        <button
          type="button"
          aria-pressed={settings.timeControl === 'untimed'}
          className={`mt-2 w-full ${chip(settings.timeControl === 'untimed')} rounded-lg`}
          onClick={() => onChange({ timeControl: 'untimed' })}
        >
          No clock
        </button>
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
