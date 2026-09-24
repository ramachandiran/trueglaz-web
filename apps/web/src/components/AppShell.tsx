import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api, isAdmin, isOps, isSeller, isStaff, useApi, useSession, type Session } from '@trueglaz/core'
import { useMarketView, type MarketView } from '../state/useMarketView'
import { useTheme, type ThemeMode } from '../state/useTheme'
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
  const { mode, setMode } = useTheme()
  const { session, ready } = useSession()
  const { view, setView } = useMarketView()
  const nav = useNavigate()
  const { pathname } = useLocation()

  // Someone with no selling side has nothing to switch to, so there is no
  // switch — an invitation instead. That is what keeps this honest: the choice
  // exists only once it is real, so it can never be answered wrongly.
  const seller = isSeller(session)
  const isOpsUser = isOps(session)
  const side: MarketView = seller ? view : 'buying'

  return (
    <header className="shell__header">
      <div className="shell__bar">
        <NavLink to="/" className="shell__brand">
          <span className="shell__logo" aria-hidden="true" />
          TrueGlaz
        </NavLink>

        <HeaderSearch />

        {!isOpsUser && session && (seller ? (
          <MarketSwitch
            view={side}
            onChange={(next) => {
              setView(next)
              // A mode switch that leaves you staring at the other side's
              // content reads as broken: the bar says Selling and the body is
              // still a shelf of other people's lenses. So leaving a page that
              // belongs to the side you just left lands you on the new side's
              // home. A page belonging to neither is fine where it is.
              const here = sideOf(pathname)
              if (here !== null && here !== next) nav(next === 'selling' ? '/sell' : '/')
            }}
          />
        ) : (
          <NavLink to="/sell" className="shell__sell-button">
            Sell your gear
          </NavLink>
        ))}

        <div className="shell__tools">
          {session && !isOpsUser && (
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
          </select>        </div>
      </div>

      {isOpsUser ? <OpsStrip session={session} /> : (side === 'selling' ? <SellingStrip session={session} /> : <CategoryStrip />)}
    </header>
  )
}

/**
 * Which side a path belongs to.
 *
 * Only the pages that are unambiguously one side's are claimed. Anything
 * shared — the Wanted board, a profile, the ops queues — belongs to neither and
 * counts as the side you are already on, so switching never drags you off a
 * page that was fine where it was.
 */
function sideOf(pathname: string): MarketView | null {
  if (pathname === '/sell' || pathname.startsWith('/sell/') || pathname.startsWith('/items/')) {
    return 'selling'
  }
  if (
    pathname === '/' || pathname === '/orders' ||
    pathname.startsWith('/listings/') || pathname.startsWith('/checkout/')
  ) {
    return 'buying'
  }
  return null
}

/**
 * Buying or selling.
 *
 * Verbs rather than nouns, deliberately: "Buying" is something you are doing
 * and can stop, where "Buyer" is something you would have had to be. Two real
 * buttons rather than a styled div, so it takes focus and announces its state.
 */
function MarketSwitch({ view, onChange }: {
  view: MarketView
  onChange: (next: MarketView) => void
}) {
  const tab = (value: MarketView, label: string) => (
    <button
      type="button"
      className={`switch__tab${view === value ? ' switch__tab--on' : ''}`}
      aria-pressed={view === value}
      onClick={() => onChange(value)}
    >
      {label}
    </button>
  )

  return (
    <div className="switch" role="group" aria-label="Switch between buying and selling">
      {tab('buying', 'Buying')}
      {tab('selling', 'Selling')}
    </div>
  )
}

/**
 * The second band while buying: the shelves, not the app's sections.
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
      <OpsLinks session={session} />
    </nav>
  )
}

/**
 * The second band while selling: the app's sections, not the shelves.
 *
 * Wanted sits here rather than beside the shelves. It is a list of people
 * waiting for gear nobody has sent in, which is a seller's question — what is
 * worth consigning — wearing a buyer's clothes. A buyer still reaches their own
 * asks from the page, and the board stays public at /wanted for anyone linked
 * to it.
 */
function SellingStrip({ session }: { session: Session | null }) {
  return (
    <nav className="strip" aria-label="Selling">
      <NavLink to="/sell" end className={stripClass}>Your items</NavLink>
      <NavLink to="/sell/new" className={stripClass}>Consign an item</NavLink>
      <NavLink to="/wanted" className={stripClass}>Wanted</NavLink>
      <span className="strip__spacer" />
      <OpsLinks session={session} />
    </nav>
  )
}

/** Staff links belong to the person, not to the side they are looking at. */
function OpsLinks({ session }: { session: Session | null }) {
  return (
    <>
      {isOps(session) && (
        <>
          <NavLink to="/inventory" className={stripClass}>Inventory</NavLink>
          <NavLink to="/ops" className={stripClass}>Queues</NavLink>
        </>
      )}
      {isStaff(session) && <NavLink to="/ops/fulfilment" className={stripClass}>Fulfilment</NavLink>}
      {isAdmin(session) && <NavLink to="/admin" className={stripClass}>Money</NavLink>}
    </>
  )
}

/**
 * Navigation bar for ops/staff users.
 */
function OpsStrip({ session }: { session: Session | null }) {
  return (
    <nav className="strip" aria-label="Operations">
      <OpsLinks session={session} />
    </nav>
  )
}

const stripClass = ({ isActive }: { isActive: boolean }) =>
  `strip__link${isActive ? ' strip__link--active' : ''}`
