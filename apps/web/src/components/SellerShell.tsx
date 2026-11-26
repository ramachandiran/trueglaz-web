import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { api, useApi, useSession } from '@trueglaz/core'
import { AccountMenu } from './AccountMenu'
import { LogoMark } from './Logo'
import { useUnread } from './useUnread'
import { ConsoleTitleContext, type ConsoleTitle } from './consoleTitle'
import { PageHeadView } from './PageHead'
import { Icon, ICONS } from './StaffShell'
import { useEscape } from './useEscape'
import './StaffShell.css'
import './console.css'
import './SellerShell.css'

const COLLAPSE_KEY = 'tg.seller.collapsed'

type Item = { to: string; label: string; icon: string; on: boolean; count?: number; hot?: boolean }

/**
 * The seller's workspace (TG-211): the console's layout - a floating sidebar,
 * a top bar, cards on a soft canvas - so selling reads as a dashboard of your
 * own gear and money rather than a page of the shop.
 *
 * Price approvals and payouts are tabs of one screen, addressed by ?tab=, so
 * the sidebar marks the tab you are on rather than the screen alone.
 */
export function SellerShell() {
  const { session } = useSession()
  const { pathname, search } = useLocation()
  const tab = new URLSearchParams(search).get('tab') ?? 'items'
  const home = useApi(() => (session ? api.sellerHome() : Promise.resolve(null)), [session?.userId])
  const reloadHome = home.reload
  useEffect(() => { reloadHome() }, [pathname, search]) // eslint-disable-line react-hooks/exhaustive-deps
  const { unread } = useUnread()

  const [named, setNamed] = useState<ConsoleTitle | null>(null)
  const setTitle = useCallback((t: ConsoleTitle | null) => setNamed(t), [])
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })
  useEffect(() => { setDrawer(false) }, [pathname, search])
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* private mode */ }
  }, [collapsed])
  useEscape(() => setDrawer(false), drawer)

  const d = home.data
  const n = (key: string) => d?.actions.find((a) => a.key === key)?.count ?? 0
  const manage = pathname === '/sell/manage'
  const groups: { label: string; items: Item[] }[] = [
    {
      label: 'Selling',
      items: [
        { to: '/sell', label: 'Dashboard', icon: ICONS.home, on: pathname === '/sell' },
        { to: '/sell/manage', label: 'My items', icon: ICONS.inventory, on: (manage && tab === 'items') || pathname.startsWith('/items/') },
        { to: '/sell/manage?tab=approvals', label: 'Price approvals', icon: ICONS.tag, on: manage && tab === 'approvals', count: n('approvals'), hot: true },
        { to: '/sell/manage?tab=payouts', label: 'Payouts', icon: ICONS.money, on: manage && tab === 'payouts' },
        { to: '/sell/new', label: 'Consign an item', icon: ICONS.camera, on: pathname === '/sell/new' || /^\/sell\/[^/]+$/.test(pathname) && pathname !== '/sell/manage' },
      ],
    },
    {
      label: 'Market',
      items: [
        { to: '/wanted', label: 'Buyers’ requests', icon: ICONS.search, on: false, count: d?.wantedMatches.filter((m) => m.kind === 'match').length },
      ],
    },
    {
      label: 'Account',
      items: [
        { to: '/profile#bank', label: 'Bank & payouts', icon: ICONS.building, on: false },
        { to: '/profile', label: 'Profile & identity', icon: ICONS.people, on: false },
      ],
    },
  ]
  const urgent = d?.actions.find((a) => a.tone === 'urgent' && a.count > 0)
  const title = titleFor(pathname, tab)

  return (
    <ConsoleTitleContext.Provider value={setTitle}>
      <div className={`staff-shell seller-shell${collapsed ? ' staff-shell--slim' : ''}${drawer ? ' staff-shell--drawer' : ''}`}>
        <a className="skip-link" href="#main">Skip to content</a>
        <aside className="staff-side" aria-label="Selling navigation">
          <div className="staff-side__brand">
            <Link to="/sell" className="staff-side__logo" aria-label="Your selling dashboard">
              <span className="staff-side__markbox"><LogoMark className="staff-side__mark" /></span>
              <span className="staff-side__word"><b>TrueGlaz</b><small>Seller</small></span>
            </Link>
            <button type="button" className="staff-side__burger" onClick={() => (drawer ? setDrawer(false) : setCollapsed((c) => !c))}
              aria-label={drawer ? 'Close menu' : collapsed ? 'Expand the menu' : 'Collapse the menu'}>
              <Icon d={drawer ? ICONS.close : ICONS.menu} />
            </button>
          </div>

          <nav className="staff-side__nav" aria-label="Selling">
            {groups.map((g) => (
              <div key={g.label} className="staff-side__group">
                <p className="staff-side__grouplabel staff-side__grouplabel--static"><span>{g.label}</span></p>
                <div className="staff-side__items">
                  {g.items.map((it) => (
                    <Link key={it.to} to={it.to} title={collapsed ? it.label : undefined} aria-current={it.on ? 'page' : undefined}
                      className={`staff-side__link${it.on ? ' staff-side__link--on' : ''}`}>
                      <span className="staff-side__ic"><Icon d={it.icon} /></span>
                      <span className="staff-side__label">{it.label}</span>
                      {!!it.count && <span className={`staff-side__count${it.hot ? ' staff-side__count--hot' : ''}`}>{it.count}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="staff-side__group staff-side__group--plain">
              <Link to="/catalog" className="staff-side__link" title={collapsed ? 'Back to buying' : undefined}>
                <span className="staff-side__ic"><Icon d={ICONS.bag} /></span>
                <span className="staff-side__label">Back to buying</span>
              </Link>
            </div>
          </nav>

          {urgent && (
            <div className="staff-alert" role="status">
              <b><Icon d={ICONS.alert} /><span>{urgent.title}</span><span className="staff-alert__n">{urgent.count}</span></b>
              <p>{urgent.hint}</p>
              <Link to={urgent.href} className="staff-alert__go">Answer now</Link>
            </div>
          )}
        </aside>
        <button type="button" className="staff-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setDrawer(false)} />

        <div className="staff-main">
          <header className="staff-top">
            <button type="button" className="staff-top__burger" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Icon d={ICONS.menu} />
            </button>
            <p className="staff-top__title">{title}</p>
            <div className="staff-top__tools">
              <Link to="/profile#notifications" className="staff-top__icon" aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}>
                <Icon d={ICONS.bell} />
                {unread > 0 && <b className="staff-top__dot">{unread > 99 ? '99+' : unread}</b>}
              </Link>
              <AccountMenu />
            </div>
          </header>
          <main id="main" tabIndex={-1} className="staff-content">
            {/* Only a screen that names itself gets a heading from the shell:
                the consign form and an item's page draw their own. */}
            {named && !named.own && <PageHeadView title={named.title} subtitle={named.subtitle} />}
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

function titleFor(pathname: string, tab: string): string {
  if (pathname === '/sell/manage') return tab === 'approvals' ? 'Price approvals' : tab === 'payouts' ? 'Payouts' : 'My items'
  if (pathname.startsWith('/items/')) return 'My items'
  if (pathname === '/sell') return 'Dashboard'
  return 'Consign an item'
}
