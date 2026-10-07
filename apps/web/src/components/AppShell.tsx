import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { isAdmin, isOps, isSeller, isStaff, useSession } from '@trueglaz/core'
import { useMarketView, type MarketView } from '../state/useMarketView'
import { useTheme, type ThemeMode } from '../state/useTheme'
import { AccountMenu } from './AccountMenu'
import { DemoNotice } from './DemoNotice'
import { HeaderSearch } from './HeaderSearch'
import { Logo, LogoMark } from './Logo'
import './AppShell.css'

export function AppShell() {
  return (
    <div className="shell">
      <DemoNotice />
      <Header />
      <main className="shell__main">
        <Outlet />
      </main>
      <footer className="shell__footer">
        <LogoMark className="shell__footer-mark" />
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
  const isAuthPage = pathname === '/sign-in'

  // Someone with no selling side has nothing to switch to, so there is no
  // switch — an invitation instead. That is what keeps this honest: the choice
  // exists only once it is real, so it can never be answered wrongly.
  const seller = isSeller(session)
  const isOpsUser = isOps(session)
  const staff = isStaff(session)
  const admin = isAdmin(session)
  const routeSide = sideOf(pathname)
  const side: MarketView = seller ? routeSide ?? view : 'buying'

  return (
    <header className={`shell__header${isAuthPage ? ' shell__header--auth' : ''}`}>
      <div className="shell__bar">
        <NavLink to="/" className="shell__brand" aria-label="TrueGlaz — home">
          <Logo className="shell__logo" />
        </NavLink>

        {!isAuthPage && <HeaderSearch />}

        {/* Staff navigation. Ops users previously had none — they landed on
            /inventory and every other page of their own job was reachable only
            by typing its URL. */}
        {!isAuthPage && isOpsUser && (
          <nav className="shell__ops" aria-label="Staff">
            <NavLink to="/inventory" className="shell__ops-link">Inventory</NavLink>
            <NavLink to="/ops" className="shell__ops-link">Operations</NavLink>
            {staff && <NavLink to="/people" className="shell__ops-link">People</NavLink>}
            {staff && <NavLink to="/fulfilment" className="shell__ops-link">Fulfilment</NavLink>}
            {admin && <NavLink to="/admin" className="shell__ops-link">Money</NavLink>}
          </nav>
        )}

        {!isAuthPage && !isOpsUser && session && (seller ? (
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

        <div className={`shell__tools${isAuthPage ? ' shell__tools--auth' : ''}`}>
          {!isAuthPage && session && !isOpsUser && (
            <NavLink to="/orders" className="shell__tool">
              <span className="shell__tool-top">Returns &amp;</span>
              <span className="shell__tool-main">Orders</span>
            </NavLink>
          )}

          {!isAuthPage && ready && (session ? (
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
          </select>
        </div>
      </div>
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
      className={`switch__tab${view === value ? ' switch__tab--on' : ''}${value === 'selling' ? ' switch__tab--selling' : ''}`}
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
