import type { ReactNode } from 'react'
import { useTheme } from '../hooks/useTheme'
import { Nav } from './Nav'
import { ThemePicker } from './ThemePicker'

const CONTAINER = 'mx-auto w-full max-w-[1600px] px-3 sm:px-6'

export function Shell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useTheme()
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-white/2 backdrop-blur">
        <div className={`${CONTAINER} flex h-15 items-center gap-7`}>
          <span className="font-display text-lg font-bold whitespace-nowrap">
            Chess<span className="text-accent">Analyzer</span>
          </span>
          <Nav />
          <div className="ml-auto">
            <ThemePicker theme={theme} onChange={setTheme} />
          </div>
        </div>
      </header>
      <main className={`${CONTAINER} py-3 sm:py-6`}>{children}</main>
    </div>
  )
}
