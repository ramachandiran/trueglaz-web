import { Link, NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { api, isAdmin, isOps, isStaff, useApi, useSession } from '@trueglaz/core'
import { AccountMenu } from './AccountMenu'
import { HeaderSearch } from './HeaderSearch'
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

/**
 * The nav shows only what the signed-in user can actually reach. This is a
 * courtesy rather than a control — the API refuses the same calls regardless —
 * but a menu full of links that 403 is its own kind of broken.
 */
function Header() {
  const { session, ready } = useSession()

  return (
    <header className="shell__header">
      <div className="shell__bar">
        <NavLink to="/" className="shell__brand">
          <span className="shell__logo" aria-hidden="true" />
          TrueGlaz
        </NavLink>

        <HeaderSearch />

        {session && (
          <NavLink to="/sell" className="shell__sell-button">
            Sell your gear
          </NavLink>
        )}

        <div className="shell__tools">
          {session && (
            <NavLink to="/orders" className="shell__tool">
              <span className="shell__tool-top">Returns &amp;</span>
              <span className="shell__tool-main">Orders</span>
            </NavLink>
          )}

          {ready && (session ? (
            <AccountMenu />
          ) : (
            <NavLink to="/sign-in" className="tg-button shell__signin">
              Sign in
            </NavLink>
          ))}

        </div>
      </div>

      <CategoryStrip />
    </header>
  )
}

/**
 * The second band: the shelves, not the app's sections.
 *
 * Brands come from the catalogue rather than a hard-coded list, so a brand that
 * has never been consigned does not sit here leading to nothing.
 */
function CategoryStrip() {
  const { session } = useSession()
  const [params] = useSearchParams()
  const categories = useApi(() => api.categories(), [])
  const brands = useApi(() => api.brands(), [])

  // These all point at the same path and differ only by query, which NavLink's
  // own isActive does not look at — left to it, every shelf reads as the open
  // one.
  const cat = params.get('cat')
  const brand = params.get('brand')
  const browsingAll = !cat && !brand && !params.get('q')
  const cls = (active: boolean) => `strip__link${active ? ' strip__link--active' : ''}`

  return (
    <nav className="strip" aria-label="Browse by">
      <Link to="/" className={cls(browsingAll)}>All gear</Link>
      {(categories.data ?? []).map((c) => (
        <Link key={c.id} to={`/?cat=${c.slug}`} className={cls(cat === c.slug)}>{c.name}</Link>
      ))}
      {(brands.data ?? []).slice(0, 6).map((b) => (
        <Link
          key={b.id}
          to={`/?brand=${encodeURIComponent(b.name)}`}
          className={cls((brand ?? '').toLowerCase() === b.name.toLowerCase())}
        >
          {b.name}
        </Link>
      ))}
      <span className="strip__spacer" />
      {isOps(session) && <NavLink to="/ops" className={stripClass}>Ops</NavLink>}
      {isStaff(session) && <NavLink to="/ops/fulfilment" className={stripClass}>Fulfilment</NavLink>}
      {isAdmin(session) && <NavLink to="/admin" className={stripClass}>Money</NavLink>}
    </nav>
  )
}

const stripClass = ({ isActive }: { isActive: boolean }) =>
  `strip__link${isActive ? ' strip__link--active' : ''}`
