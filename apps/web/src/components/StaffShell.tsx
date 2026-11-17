import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { isAdmin, isStaff, useSession } from '@trueglaz/core'
import { AccountMenu } from './AccountMenu'
import { DemoNotice } from './DemoNotice'
import { Logo, LogoMark } from './Logo'
import { useUnread } from './useUnread'
import { ConsoleTitleContext, useStaffHome, type ConsoleTitle } from './consoleTitle'
import './StaffShell.css'
import './console.css'

type IconProps = { d: string }
export const Icon = ({ d }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
export const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5',
  inventory: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7',
  operations: 'M14 7l3 3L7 20l-4 1 1-4L14 7zM14 7l3-3 4 4-3 3',
  returns: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 5 5v1',
  fulfilment: 'M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 19a2 2 0 1 0 0 .01M18.5 19a2 2 0 1 0 0 .01',
  insurance: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3zM9 12l2 2 4-4',
  people: 'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zM2 20a7 7 0 0 1 14 0M16 5.5a3 3 0 0 1 0 5M22 20a6 6 0 0 0-5-5.9',
  money: 'M2 5h20v14H2zM2 10h20M6 15h4',
  balance: 'M12 3v18M4 7h16M6 7l-3 6a3 3 0 0 0 6 0zM18 7l-3 6a3 3 0 0 0 6 0z',
  audit: 'M9 12l2 2 4-4M7.5 3h9l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L13.8 3h-3.6l-.5 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5L5.6 11a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.5 2.5h3.6l.5-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  rupee: 'M6 3h12M6 8h12M6 13h3a5 5 0 0 0 0-10M9 13l8 8',
  camera: 'M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M15 18l-6-6 6-6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  close: 'M6 6l12 12M18 6 6 18',
} as const

type NavItem = { to: string; end?: boolean; label: string; icon: string; count?: number; hot?: boolean }

/** The sections, in sidebar order, each gated by what the signed-in user can reach. */
function sections(staff: boolean, admin: boolean, n: (key: string) => number) {
  return [
    {
      label: 'Operations',
      items: [
        staff && { to: '/admin', end: true, label: 'Control room', icon: ICONS.home },
        staff && { to: '/admin/inventory', label: 'Inventory', icon: ICONS.inventory },
        // Each count is the one the page opens on, so the badge and the first
        // tab you see always say the same number.
        { to: '/admin/operations', label: 'Operations', icon: ICONS.operations, count: n('submissions') },
        { to: '/admin/returns', label: 'Returns', icon: ICONS.returns, count: n('returns_new'), hot: true },
        staff && { to: '/admin/fulfilment', label: 'Fulfilment', icon: ICONS.fulfilment, count: n('to_dispatch') },
        staff && { to: '/admin/insurance', label: 'Insurance desk', icon: ICONS.insurance },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: 'People & money',
      items: [
        staff && { to: '/admin/people', label: 'People', icon: ICONS.people, count: n('selling') },
        admin && { to: '/admin/money', label: 'Money', icon: ICONS.money },
        admin && { to: '/admin/balance-sheet', label: 'Balance sheet', icon: ICONS.balance },
        admin && { to: '/admin/audit', label: 'Audit', icon: ICONS.audit },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: 'Admin',
      items: [
        admin && { to: '/admin/settings', label: 'Settings', icon: ICONS.settings },
      ].filter(Boolean) as NavItem[],
    },
  ].filter((g) => g.items.length > 0)
}

/** The current section's name, for a screen that does not name itself. */
function titleFor(pathname: string): string {
  const map: [string, string][] = [
    ['/admin/inventory', 'Inventory'], ['/admin/operations', 'Operations'], ['/admin/returns', 'Returns'],
    ['/admin/fulfilment', 'Fulfilment'], ['/admin/insurance', 'Insurance desk'], ['/admin/people', 'People'], ['/admin/money', 'Money'],
    ['/admin/balance-sheet', 'Balance sheet'], ['/admin/audit', 'Audit'], ['/admin/settings', 'Settings'],
  ]
  for (const [p, label] of map) if (pathname.startsWith(p)) return label
  return 'Control room'
}

const COLLAPSE_KEY = 'tg.console.collapsed'

/**
 * The staff / admin console (TG-126): a white sidebar with grouped sections,
 * the screen's own title in the top bar, and every screen on the same set of
 * cards, tables and tags. TrueGlaz's navy and orange carry the brand; the
 * layout follows the admin template the product owner chose.
 */
export function StaffShell() {
  const { session } = useSession()
  const { pathname } = useLocation()
  const staff = isStaff(session)
  const admin = isAdmin(session)
  const home = useStaffHome(staff || admin)
  // The menu counts follow you round the console: re-read (from the shared,
  // half-minute answer) whenever the screen changes.
  const reloadHome = home.reload
  useEffect(() => { reloadHome() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  const { unread } = useUnread()
  const [named, setNamed] = useState<ConsoleTitle | null>(null)
  const setTitle = useCallback((t: ConsoleTitle | null) => setNamed(t), [])
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })

  // A link followed from the drawer closes it.
  useEffect(() => { setDrawer(false) }, [pathname])
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* private mode */ }
  }, [collapsed])

  const n = (key: string) => home.data?.actions.find((a) => a.key === key)?.count ?? 0
  const title = named?.title ?? titleFor(pathname)

  return (
    <ConsoleTitleContext.Provider value={setTitle}>
      <div className={`staff-shell${collapsed ? ' staff-shell--slim' : ''}${drawer ? ' staff-shell--drawer' : ''}`}>
        <a className="skip-link" href="#main">Skip to content</a>
        <aside className="staff-side" aria-label="Console navigation">
          <div className="staff-side__brand">
            <Link to="/admin" className="staff-side__logo" aria-label="TrueGlaz console home">
              <Logo className="staff-side__lockup" />
              <LogoMark className="staff-side__mark" />
            </Link>
            <button type="button" className="staff-side__burger" onClick={() => (drawer ? setDrawer(false) : setCollapsed((c) => !c))}
              aria-label={drawer ? 'Close menu' : collapsed ? 'Expand the menu' : 'Collapse the menu'}>
              <Icon d={drawer ? ICONS.close : ICONS.menu} />
            </button>
          </div>

          <nav className="staff-side__nav" aria-label="Console">
            {sections(staff, admin, n).map((g) => (
              <div key={g.label} className="staff-side__group">
                <div className="staff-side__grouplabel">{g.label}</div>
                {g.items.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.end} title={collapsed ? it.label : undefined}
                    className={({ isActive }) => `staff-side__link${isActive ? ' staff-side__link--on' : ''}`}>
                    <span className="staff-side__ic"><Icon d={it.icon} /></span>
                    <span className="staff-side__label">{it.label}</span>
                    {!!it.count && <span className={`staff-side__count${it.hot ? ' staff-side__count--hot' : ''}`}>{it.count}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* The catalogue, not "/": the home route sends staff straight back to the console. */}
          <NavLink to="/catalog" className="staff-side__store" title={collapsed ? 'Storefront' : undefined}>
            <Icon d={ICONS.back} />
            <span className="staff-side__label">Storefront</span>
          </NavLink>
        </aside>
        <button type="button" className="staff-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setDrawer(false)} />

        <div className="staff-main">
          <header className="staff-top">
            <button type="button" className="staff-top__burger" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Icon d={ICONS.menu} />
            </button>
            <div className="staff-top__title">
              <h1>{title}</h1>
              {named?.subtitle && <p>{named.subtitle}</p>}
            </div>
            <div className="staff-top__tools">
              <Link to="/profile#notifications" className="staff-top__bell" aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}>
                <Icon d={ICONS.bell} />
                {unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
              </Link>
              <AccountMenu />
            </div>
          </header>
          <DemoNotice />
          <main id="main" tabIndex={-1} className="staff-content">
            <Outlet />
          </main>
          <footer className="staff-foot">
            <span>{new Date().getFullYear()} © TrueGlaz</span>
            <span>Every unit graded, every defect disclosed.</span>
          </footer>
        </div>
      </div>
    </ConsoleTitleContext.Provider>
  )
}
