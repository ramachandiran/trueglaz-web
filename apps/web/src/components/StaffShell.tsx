import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { isAdmin, isStaff, useSession } from '@trueglaz/core'
import { useTheme, type ThemeMode } from '../state/useTheme'
import { AccountMenu } from './AccountMenu'
import { DemoNotice } from './DemoNotice'
import { HeaderSearch } from './HeaderSearch'
import { LogoMark } from './Logo'
import './StaffShell.css'

type IconProps = { d: string }
const Icon = ({ d }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5',
  inventory: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7',
  operations: 'M14 7l3 3L7 20l-4 1 1-4L14 7zM14 7l3-3 4 4-3 3',
  returns: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 5 5v1',
  fulfilment: 'M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 19a2 2 0 1 0 0 .01M18.5 19a2 2 0 1 0 0 .01',
  people: 'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zM2 20a7 7 0 0 1 14 0M16 5.5a3 3 0 0 1 0 5M22 20a6 6 0 0 0-5-5.9',
  money: 'M2 5h20v14H2zM2 10h20M6 15h4',
  balance: 'M12 3v18M4 7h16M6 7l-3 6a3 3 0 0 0 6 0zM18 7l-3 6a3 3 0 0 0 6 0z',
  audit: 'M9 12l2 2 4-4M7.5 3h9l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L13.8 3h-3.6l-.5 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5L5.6 11a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.5 2.5h3.6l.5-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5z',
} as const

/** The sections, in sidebar order, each gated by what the signed-in user can reach. */
function sections(staff: boolean, admin: boolean) {
  return [
    {
      label: 'Operations',
      items: [
        staff && { to: '/admin', end: true, label: 'Control room', icon: ICONS.home },
        staff && { to: '/admin/inventory', label: 'Inventory', icon: ICONS.inventory },
        { to: '/admin/operations', label: 'Operations', icon: ICONS.operations },
        { to: '/admin/returns', label: 'Returns', icon: ICONS.returns },
        staff && { to: '/admin/fulfilment', label: 'Fulfilment', icon: ICONS.fulfilment },
      ].filter(Boolean) as NavItem[],
    },
    {
      label: 'People & money',
      items: [
        staff && { to: '/admin/people', label: 'People', icon: ICONS.people },
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
type NavItem = { to: string; end?: boolean; label: string; icon: string }

/** The current section's name, for the top bar breadcrumb. */
function titleFor(pathname: string): string {
  const map: [string, string][] = [
    ['/admin/inventory', 'Inventory'], ['/admin/operations', 'Operations'], ['/admin/returns', 'Returns'],
    ['/admin/fulfilment', 'Fulfilment'], ['/admin/people', 'People'], ['/admin/money', 'Money'],
    ['/admin/balance-sheet', 'Balance sheet'], ['/admin/audit', 'Audit'], ['/admin/settings', 'Settings'],
  ]
  for (const [p, label] of map) if (pathname.startsWith(p)) return label
  return 'Control room'
}

export function StaffShell() {
  const { mode, setMode } = useTheme()
  const { session } = useSession()
  const { pathname } = useLocation()
  const staff = isStaff(session)
  const admin = isAdmin(session)

  return (
    <div className="staff-shell">
      <aside className="staff-side">
        <NavLink to="/admin" className="staff-side__brand">
          <LogoMark className="staff-side__mark" />
          <span className="staff-side__name">TrueGlaz</span>
          <span className="staff-side__env">Console</span>
        </NavLink>

        <nav className="staff-side__nav" aria-label="Console">
          {sections(staff, admin).map((g) => (
            <div key={g.label} className="staff-side__group">
              <div className="staff-side__grouplabel">{g.label}</div>
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end}
                  className={({ isActive }) => `staff-side__link${isActive ? ' staff-side__link--on' : ''}`}>
                  <span className="staff-side__ic"><Icon d={it.icon} /></span>
                  {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <NavLink to="/" className="staff-side__store">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          Storefront
        </NavLink>
      </aside>

      <div className="staff-main">
        <header className="staff-top">
          <div className="staff-top__crumb">Console <span>/</span> <b>{titleFor(pathname)}</b></div>
          <div className="staff-top__tools">
            <HeaderSearch />
            <select className="tg-select staff-top__theme" value={mode} onChange={(e) => setMode(e.target.value as ThemeMode)} aria-label="Colour theme">
              <option value="system">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="midnight">Midnight</option>
            </select>
            <AccountMenu />
          </div>
        </header>
        <DemoNotice />
        <main className="staff-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
