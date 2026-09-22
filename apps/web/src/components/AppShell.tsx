import { NavLink, Outlet } from 'react-router-dom'
import { isAdmin, isOps, isStaff, useSession } from '@trueglaz/core'
import { useTheme, type ThemeMode } from '../state/useTheme'
import { AccountMenu } from './AccountMenu'
import './AppShell.css'

export function AppShell() {
  return (
    <div className="shell">
      <Header />
      <main className="shell__main">
        <Outlet />
      </main>
      <footer className="shell__footer">
        <span className="tg-muted">TrueGlaz — every unit graded, every defect disclosed.</span>
      </footer>
    </div>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `shell__nav-link${isActive ? ' shell__nav-link--active' : ''}`

/**
 * The nav shows only what the signed-in user can actually reach. This is a
 * courtesy rather than a control — the API refuses the same calls regardless —
 * but a menu full of links that 403 is its own kind of broken.
 */
function Header() {
  const { mode, setMode } = useTheme()
  const { session, ready } = useSession()

  return (
    <header className="shell__header">
      <div className="shell__header-inner">
        <NavLink to="/" className="shell__brand">
          <span className="shell__logo" aria-hidden="true" />
          TrueGlaz
        </NavLink>

        <nav className="shell__nav" aria-label="Main">
          <NavLink to="/" end className={navClass}>Browse</NavLink>
          {session && <NavLink to="/orders" className={navClass}>My orders</NavLink>}
          {session && <NavLink to="/sell" className={navClass}>Sell</NavLink>}
          {isOps(session) && <NavLink to="/ops" className={navClass}>Ops</NavLink>}
          {isStaff(session) && <NavLink to="/ops/fulfilment" className={navClass}>Fulfilment</NavLink>}
          {isAdmin(session) && <NavLink to="/admin" className={navClass}>Money</NavLink>}
        </nav>

        <div className="shell__tools">
          {ready && (session ? (
            <AccountMenu />
          ) : (
            <NavLink to="/sign-in" className="tg-button tg-button--primary shell__signin">
              Sign in
            </NavLink>
          ))}

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
