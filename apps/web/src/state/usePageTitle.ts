import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'TrueGlaz'

/**
 * Every route's tab title, most specific first. One table rather than a call
 * in each page, so a new route cannot quietly ship as plain "TrueGlaz" again
 * (TG-48: 28 routes shared that one title, so tabs, history and screen-reader
 * page announcements could not tell them apart).
 */
const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Used camera gear, graded honestly'],
  [/^\/catalog/, 'Shop all gear'],
  [/^\/listings\//, 'Listing'],
  [/^\/checkout\//, 'Checkout'],
  [/^\/orders/, 'Your orders'],
  [/^\/vault/, 'Gear Vault'],
  [/^\/profile/, 'Your account'],
  [/^\/wanted/, 'Wanted board'],
  [/^\/sign-in/, 'Sign in'],
  [/^\/kyc\/digilocker/, 'Identity check'],
  [/^\/sell\/manage/, 'Your gear with us'],
  [/^\/sell\/new/, 'Consign an item'],
  [/^\/sell\/.+/, 'Your submission'],
  [/^\/sell$/, 'Selling'],
  [/^\/items\//, 'Your item'],
  [/^\/admin\/inventory/, 'Inventory · Console'],
  [/^\/admin\/operations\/inspect\//, 'Inspection · Console'],
  [/^\/admin\/operations\/items/, 'Items by stage · Console'],
  [/^\/admin\/operations/, 'Operations · Console'],
  [/^\/admin\/returns/, 'Returns · Console'],
  [/^\/admin\/fulfilment/, 'Fulfilment · Console'],
  [/^\/admin\/people\/.+/, 'Person · Console'],
  [/^\/admin\/people/, 'People · Console'],
  [/^\/admin\/money/, 'Money · Console'],
  [/^\/admin\/balance-sheet/, 'Balance sheet · Console'],
  [/^\/admin\/audit/, 'Audit · Console'],
  [/^\/admin\/settings\/selling/, 'Selling & checkout · Settings'],
  [/^\/admin\/settings\/fees/, 'Fees & commission · Settings'],
  [/^\/admin\/settings\/payouts/, 'Payouts · Settings'],
  [/^\/admin\/settings\/company/, 'Company & invoices · Settings'],
  [/^\/admin\/settings\/catalogue/, 'Catalogue · Settings'],
  [/^\/admin\/settings\/team/, 'Team · Settings'],
  [/^\/admin\/settings\/security/, 'Sign-in & security · Settings'],
  [/^\/admin\/settings\/notifications/, 'Notifications · Settings'],
  [/^\/admin\/settings\/models/, 'Model photos · Settings'],
  [/^\/admin\/settings/, 'Settings · Console'],
  [/^\/admin$/, 'Control room · Console'],
]

export function titleFor(pathname: string): string {
  const hit = TITLES.find(([re]) => re.test(pathname))
  return hit ? `${hit[1]} — ${SITE}` : `Page not found — ${SITE}`
}

/** Sets the tab title from the route. Mounted once, inside the router. */
export function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => { document.title = titleFor(pathname) }, [pathname])
  return null
}

/**
 * A page that knows better than its route (a listing knows its model) can name
 * itself once its data has loaded; this runs after RouteTitle on the same path.
 */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} — ${SITE}`
  }, [title])
}
