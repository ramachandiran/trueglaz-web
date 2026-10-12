import { NavLink, Outlet } from 'react-router-dom'
import './Settings.css'

/** Every settings page, in the order an admin would set a shop up. */
export const SETTINGS_PAGES = [
  { to: '', label: 'Overview', end: true, blurb: '' },
  { to: 'selling', label: 'Selling & checkout', end: false, blurb: 'Holds, return window, deadlines' },
  { to: 'fees', label: 'Fees & commission', end: false, blurb: 'Commission bands, GST, delivery charge' },
  { to: 'payouts', label: 'Payouts', end: false, blurb: 'What staff may send without an admin' },
  { to: 'company', label: 'Company & invoices', end: false, blurb: 'Legal name, GSTIN, address on invoices' },
  { to: 'catalogue', label: 'Catalogue', end: false, blurb: 'Add brands and models to the gear list' },
  { to: 'security', label: 'Sign-in & security', end: false, blurb: 'Sign-in codes and sessions' },
  { to: 'models', label: 'Model photos', end: false, blurb: 'The picture of each catalogue model' },
] as const

/**
 * Admin → Settings: one place for everything the platform can be told, split
 * into pages by what it is about. The side menu stays put; each page saves
 * its own changes and shows who changed what.
 */
export function SettingsLayout() {
  return (
    <div className="st">
      <aside className="st__side" aria-label="Settings">
        <h1 className="st__title">Settings</h1>
        <nav className="st__nav">
          {SETTINGS_PAGES.map((p) => (
            <NavLink key={p.to} to={p.to === '' ? '/admin/settings' : `/admin/settings/${p.to}`} end={p.end}
              className={({ isActive }) => `st__link${isActive ? ' st__link--on' : ''}`}>
              {p.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="st__main">
        <Outlet />
      </main>
    </div>
  )
}
