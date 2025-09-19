import { NavLink } from 'react-router'

const LINKS = [
  { to: '/', label: 'Analyzer' },
  { to: '/play', label: 'Play vs computer' },
  { to: '/import', label: 'Game review' },
]

const BASE = 'whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition-colors'

export function Nav() {
  return (
    <nav className="flex gap-1.5 overflow-x-auto">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end
          className={({ isActive }) =>
            isActive
              ? `${BASE} border-accent/35 bg-accent/10 text-fg`
              : `${BASE} border-transparent text-fg-muted hover:text-fg-secondary`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
