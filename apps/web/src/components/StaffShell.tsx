import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { isAdmin, isStaff, useSession } from '@trueglaz/core'
import { AccountMenu } from './AccountMenu'
import { DemoNotice } from './DemoNotice'
import { LogoMark } from './Logo'
import { useUnread } from './useUnread'
import { ConsoleTitleContext, useStaffHome, type ConsoleTitle } from './consoleTitle'
import { PageHeadView } from './PageHead'
import { useEscape } from './useEscape'
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
  chevron: 'm9 6 6 6-6 6',
  down: 'm6 9 6 6 6-6',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  alert: 'm21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3zM12 9v4M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  up: 'M12 19V5M5 12l7-7 7 7',
  export: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  filter: 'M3 6h18M7 12h10M10 18h4',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  check: 'M20 6 9 17l-5-5',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  history: 'M3 12a9 9 0 1 0 9-9 9.8 9.8 0 0 0-6.7 2.7L3 8M3 3v5h5M12 7v5l4 2',
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

// Where each queue lives, for an API that still sends the pre-console paths.
const LEGACY: Record<string, string> = {
  '/ops': '/admin/operations', '/inventory': '/admin/inventory', '/fulfilment': '/admin/fulfilment',
  '/returns': '/admin/returns', '/people': '/admin/people', '/admin': '/admin/money',
}
export function staffHref(href: string): string {
  const [path, rest] = href.split(/(?=[?#])/)
  return (LEGACY[path] ?? path) + (rest ?? '')
}

const COLLAPSE_KEY = 'tg.console.collapsed'
const GROUPS_KEY = 'tg.console.groups'
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * The staff / admin console (TG-126, redesigned in TG-195): a floating
 * sidebar card with collapsible groups and the most urgent thing waiting at
 * its foot, a top bar card with search, and each screen's heading under it -
 * the approved template's layout in TrueGlaz's own colours.
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
  const [closedGroups, setClosedGroups] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '[]') } catch { return [] }
  })

  // A link followed from the drawer closes it.
  useEffect(() => { setDrawer(false) }, [pathname])
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* private mode */ }
  }, [collapsed])
  useEffect(() => {
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(closedGroups)) } catch { /* private mode */ }
  }, [closedGroups])
  useEscape(() => setDrawer(false), drawer)

  const n = (key: string) => home.data?.actions.find((a) => a.key === key)?.count ?? 0
  const section = titleFor(pathname)
  const urgent = home.data?.actions.find((a) => a.tone === 'urgent' && a.count > 0 && (admin || !a.href.includes('/money')))
  const toggleGroup = (label: string) =>
    setClosedGroups((g) => (g.includes(label) ? g.filter((x) => x !== label) : [...g, label]))

  return (
    <ConsoleTitleContext.Provider value={setTitle}>
      <div className={`staff-shell${collapsed ? ' staff-shell--slim' : ''}${drawer ? ' staff-shell--drawer' : ''}`}>
        <a className="skip-link" href="#main">Skip to content</a>
        <aside className="staff-side" aria-label="Console navigation">
          <div className="staff-side__brand">
            <Link to="/admin" className="staff-side__logo" aria-label="TrueGlaz console home">
              <span className="staff-side__markbox"><LogoMark className="staff-side__mark" /></span>
              <span className="staff-side__word"><b>TrueGlaz</b><small>Console</small></span>
            </Link>
            <button type="button" className="staff-side__burger" onClick={() => (drawer ? setDrawer(false) : setCollapsed((c) => !c))}
              aria-label={drawer ? 'Close menu' : collapsed ? 'Expand the menu' : 'Collapse the menu'}>
              <Icon d={drawer ? ICONS.close : ICONS.menu} />
            </button>
          </div>

          <nav className="staff-side__nav" aria-label="Console">
            {sections(staff, admin, n).map((g) => {
              const open = !closedGroups.includes(g.label) || collapsed
              const id = `grp-${g.label.replace(/\W+/g, '-').toLowerCase()}`
              return (
                <div key={g.label} className="staff-side__group">
                  <button type="button" className="staff-side__grouplabel" aria-expanded={open} aria-controls={id} onClick={() => toggleGroup(g.label)}>
                    <span>{g.label}</span><Icon d={ICONS.down} />
                  </button>
                  <div id={id} className="staff-side__items" hidden={!open}>
                    {g.items.map((it) => (
                      <NavLink key={it.to} to={it.to} end={it.end} title={collapsed ? it.label : undefined}
                        className={({ isActive }) => `staff-side__link${isActive ? ' staff-side__link--on' : ''}`}>
                        <span className="staff-side__ic"><Icon d={it.icon} /></span>
                        <span className="staff-side__label">{it.label}</span>
                        {!!it.count && <span className={`staff-side__count${it.hot ? ' staff-side__count--hot' : ''}`}>{it.count}</span>}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )
            })}
            {/* The catalogue, not "/": the home route sends staff straight back to the console. */}
            <div className="staff-side__group staff-side__group--plain">
              <NavLink to="/catalog" className="staff-side__link" title={collapsed ? 'Storefront' : undefined}>
                <span className="staff-side__ic"><Icon d={ICONS.tag} /></span>
                <span className="staff-side__label">Storefront</span>
              </NavLink>
            </div>
          </nav>

          {urgent && (
            <div className="staff-alert" role="status">
              <b><Icon d={ICONS.alert} /><span>{urgent.title}</span><span className="staff-alert__n">{urgent.count}</span></b>
              <p>{urgent.hint}</p>
              <Link to={staffHref(urgent.href)} className="staff-alert__go">Review now</Link>
            </div>
          )}
        </aside>
        <button type="button" className="staff-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setDrawer(false)} />

        <div className="staff-main">
          <header className="staff-top">
            <button type="button" className="staff-top__burger" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Icon d={ICONS.menu} />
            </button>
            <p className="staff-top__title">{section}</p>
            <ConsoleSearch />
            <div className="staff-top__tools">
              <HelpMenu />
              <Link to="/profile#notifications" className="staff-top__icon" aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}>
                <Icon d={ICONS.bell} />
                {unread > 0 && <b className="staff-top__dot">{unread > 99 ? '99+' : unread}</b>}
              </Link>
              <AccountMenu />
            </div>
          </header>
          <DemoNotice />
          <main id="main" tabIndex={-1} className="staff-content">
            {!named?.own && <PageHeadView title={named?.title ?? section} subtitle={named?.subtitle} />}
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

/**
 * Search from anywhere in the console: an item, a serial, an SKU, an order
 * number or a seller. It opens Inventory filtered by what was typed - the one
 * list that holds every unit. "/" or ⌘K (Ctrl K) puts the cursor in it.
 */
function ConsoleSearch() {
  const nav = useNavigate()
  const { pathname, search } = useLocation()
  const ref = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  // Coming back to Inventory shows what it is filtered by.
  useEffect(() => {
    if (pathname === '/admin/inventory') setQ(new URLSearchParams(search).get('q') ?? '')
  }, [pathname, search])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    nav(term ? `/admin/inventory?q=${encodeURIComponent(term)}` : '/admin/inventory')
    ref.current?.blur()
  }
  return (
    <form role="search" className="staff-search" onSubmit={submit}>
      <Icon d={ICONS.search} />
      <input ref={ref} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items, serials, SKUs…"
        aria-label="Search inventory" aria-keyshortcuts={isMac ? 'Meta+K /' : 'Control+K /'} />
      <span className="staff-search__keys" aria-hidden="true"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd></span>
    </form>
  )
}

/** What the colours and shortcuts mean, a click away from every screen. */
function HelpMenu() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEscape(() => setOpen(false), open)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])
  return (
    <div className="staff-help" ref={box}>
      <button type="button" className="staff-top__icon" aria-label="Help" aria-expanded={open} aria-controls="console-help" onClick={() => setOpen((o) => !o)}>
        <Icon d={ICONS.help} />
      </button>
      {open && (
        <div id="console-help" className="staff-help__pop" role="dialog" aria-label="Help">
          <h2>Shortcuts</h2>
          <dl>
            <div><dt><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd> <kbd>K</kbd> or <kbd>/</kbd></dt><dd>Search inventory</dd></div>
            <div><dt><kbd>Esc</kbd></dt><dd>Close a menu or dialog</dd></div>
          </dl>
          <h2>Colours</h2>
          <ul>
            <li><span className="c-pill c-pill--bad">Red</span> late or needs a person now</li>
            <li><span className="c-pill c-pill--warn">Amber</span> waiting, or a minor issue</li>
            <li><span className="c-pill c-pill--good">Green</span> done or on track</li>
            <li><span className="c-pill c-pill--navy">Navy</span> moving along</li>
          </ul>
          <p>Every number on the Control room opens the list it counts.</p>
        </div>
      )}
    </div>
  )
}
