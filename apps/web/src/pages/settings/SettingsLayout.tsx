import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api, useApi } from '@trueglaz/core'
import { PageHead } from '../../components/PageHead'
import { Icon, ICONS } from '../../components/StaffShell'
import './Settings.css'

/** Every settings page, grouped the way an admin would set a shop up. */
export const SETTINGS_PAGES = [
  { to: '', label: 'Overview', end: true, group: '', icon: ICONS.settings, blurb: 'Everything at a glance' },
  { to: 'selling', label: 'Selling & checkout', end: false, group: 'Money', icon: ICONS.tag, blurb: 'Holds, return window, deadlines' },
  { to: 'fees', label: 'Fees & commission', end: false, group: 'Money', icon: ICONS.rupee, blurb: 'Commission bands, GST, delivery' },
  { to: 'payouts', label: 'Payouts', end: false, group: 'Money', icon: ICONS.money, blurb: 'What staff may send alone' },
  { to: 'company', label: 'Company & invoices', end: false, group: 'Business', icon: ICONS.building, blurb: 'Legal name, GSTIN, address' },
  { to: 'catalogue', label: 'Catalogue', end: false, group: 'Business', icon: ICONS.inventory, blurb: 'Brands and models' },
  { to: 'models', label: 'Model photos', end: false, group: 'Business', icon: ICONS.image, blurb: 'A picture for each model' },
  { to: 'security', label: 'Sign-in & security', end: false, group: 'System', icon: ICONS.lock, blurb: 'Sign-in codes and sessions' },
  { to: 'notifications', label: 'Notifications', end: false, group: 'System', icon: ICONS.bell, blurb: 'Email, WhatsApp and sender' },
] as const

export type SettingsPageKey = (typeof SETTINGS_PAGES)[number]['to']

/**
 * What needs an admin's attention, by page: payments not taking real money,
 * invoices still on the server's company details, models without a photo.
 * The menu marks those pages; the overview lists them.
 */
export function useSettingsAttention(): Partial<Record<SettingsPageKey, string>> {
  const meta = useApi(() => api.meta(), [])
  const company = useApi(() => api.adminCompany(), [])
  const models = useApi(() => api.adminModels({}), [])
  const out: Partial<Record<SettingsPageKey, string>> = {}
  if (meta.data && !meta.data.paymentsAreReal) out.payouts = 'Payments are in test mode: no real money moves'
  if (company.data?.source === 'server') out.company = 'Invoices still use the server’s company details'
  const c = models.data?.counts
  if (c && c.photo < c.total) out.models = `${c.total - c.photo} of ${c.total} models have no photo`
  return out
}

/**
 * Admin → Settings (TG-206): a menu card on the left grouped by topic, each
 * page opening with the same header card, cards and rails on the right.
 */
export function SettingsLayout() {
  const attention = useSettingsAttention()
  const body = useRef<HTMLDivElement>(null)
  // TG-206: on a desktop the settings fit the window: the menu stays put and
  // the page scrolls inside its own pane. Where the pane starts depends on the
  // banners above it, so it is measured rather than guessed.
  useLayoutEffect(() => {
    const el = body.current
    if (!el) return
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY
      // What sits under the pane (the console's footer) stays on screen too.
      const below = document.documentElement.scrollHeight - (top + el.offsetHeight)
      el.style.setProperty('--st-top', `${Math.round(top)}px`)
      el.style.setProperty('--st-below', `${Math.max(0, Math.round(below))}px`)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(document.body)
    window.addEventListener('resize', fit)
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [])
  const groups = [...new Set(SETTINGS_PAGES.map((p) => p.group))]
  return (
    <div className="c-stack st">
      <PageHead title="Settings" crumbs={[{ label: 'Control room', to: '/admin' }, { label: 'Settings' }]} />
      <div className="st__body" ref={body}>
        <aside className="st__side" aria-label="Settings pages">
          <nav className="st__nav">
            {groups.map((g) => (
              <div key={g || 'top'} className="st__nav-group">
                {g && <div className="st__nav-head">{g}</div>}
                {SETTINGS_PAGES.filter((p) => p.group === g).map((p) => (
                  <NavLink key={p.to} to={p.to === '' ? '/admin/settings' : `/admin/settings/${p.to}`} end={p.end}
                    className={({ isActive }) => `st__link${isActive ? ' st__link--on' : ''}`}>
                    <span className="st__link-ic"><Icon d={p.icon} /></span>
                    <span className="st__link-text"><b>{p.label}</b><small>{p.blurb}</small></span>
                    {attention[p.to] && <span className="st__dot" title={attention[p.to]}><span className="tg-visually-hidden">Needs attention: {attention[p.to]}</span></span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <div className="st__main">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

/** The header card every settings page opens with. */
export function SectionHead({ page, children, aside }: { page: SettingsPageKey; children?: ReactNode; aside?: ReactNode }) {
  const p = SETTINGS_PAGES.find((x) => x.to === page)!
  return (
    <header className="st__hero">
      <span className="st__hero-ic"><Icon d={p.icon} /></span>
      <div className="st__hero-text">
        {p.group && <div className="st__eyebrow">{p.group}</div>}
        <h2 className="st__h">{p.label}</h2>
        {children && <p className="st__lede">{children}</p>}
      </div>
      {aside && <div className="st__hero-aside">{aside}</div>}
    </header>
  )
}
