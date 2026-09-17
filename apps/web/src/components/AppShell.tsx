import { NavLink, Outlet } from 'react-router-dom'
import { api } from '@trueglaz/core'
import { useApi } from '@trueglaz/core'
import { useActor } from '@trueglaz/core'
import { useTheme, type ThemeMode } from '../state/useTheme'
import './AppShell.css'

export function AppShell() {
  return (
    <div className="shell">
      <Header />
      <main className="shell__main">
        <Outlet />
      </main>
      <footer className="shell__footer">
        <span className="tg-muted">
          TrueGlaz — every unit graded, every defect disclosed.
        </span>
      </footer>
    </div>
  )
}

function Header() {
  const { mode, setMode } = useTheme()

  return (
    <header className="shell__header">
      <div className="shell__header-inner">
        <NavLink to="/" className="shell__brand">
          <span className="shell__logo" aria-hidden="true" />
          TrueGlaz
        </NavLink>

        <nav className="shell__nav" aria-label="Main">
          <NavLink to="/" end className={navClass}>Browse</NavLink>
          <NavLink to="/items" className={navClass}>Track items</NavLink>
        </nav>

        <div className="shell__tools">
          <ActorSwitcher />
          <select
            className="tg-select shell__theme"
            value={mode}
            onChange={(e) => setMode(e.target.value as ThemeMode)}
            aria-label="Colour theme"
          >
            <option value="system">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="midnight">Midnight</option>
          </select>
        </div>
      </div>
    </header>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `shell__nav-link${isActive ? ' shell__nav-link--active' : ''}`

/**
 * Stands in for signing in. The API identifies callers by header, so the app
 * needs a way to say who it is; `GET /dev/actors` lists the seeded users.
 * This whole control disappears when real auth arrives.
 */
function ActorSwitcher() {
  const { actor, setActor } = useActor()
  const { data } = useApi((a) => api.actors(a), [])

  if (!data) return <div className="tg-skeleton shell__actor-skeleton" />

  return (
    <label className="shell__actor">
      <span className="tg-visually-hidden">Acting as</span>
      <select
        className="tg-select"
        value={actor?.userId ?? ''}
        onChange={(e) => {
          const hint = data.find((h) => h.userId === e.target.value)
          setActor(
            hint
              ? { userId: hint.userId, role: hint.suggestedRoleHeader, displayName: hint.displayName }
              : null,
          )
        }}
      >
        <option value="">Signed out</option>
        {data.map((h) => (
          <option key={h.userId} value={h.userId}>
            {h.displayName} · {h.suggestedRoleHeader}
          </option>
        ))}
      </select>
    </label>
  )
}
