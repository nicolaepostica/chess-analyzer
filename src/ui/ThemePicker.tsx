import { useEffect, useRef, useState } from 'react'
import { THEMES, type ThemeId } from '../hooks/useTheme'

export type ThemePickerProps = { theme: ThemeId; onChange: (theme: ThemeId) => void }

const Swatch = ({ colors }: { colors: [string, string] }) => (
  <span
    aria-hidden="true"
    className="inline-block size-4 shrink-0 rounded-full border border-border"
    style={{ background: `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)` }}
  />
)

export function ThemePicker({ theme, onChange }: ThemePickerProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Theme"
        aria-expanded={open}
        title="Theme"
        className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-fg-secondary hover:text-fg"
        onClick={() => setOpen((value) => !value)}
      >
        <Swatch colors={current.swatch} />
        <span className="hidden sm:inline">{current.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 flex w-48 flex-col gap-1 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === theme}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                option.id === theme ? 'bg-accent/15 text-fg' : 'text-fg-secondary hover:bg-white/5 hover:text-fg'
              }`}
              onClick={() => {
                onChange(option.id)
                setOpen(false)
              }}
            >
              <Swatch colors={option.swatch} />
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
