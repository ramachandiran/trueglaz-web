import { api } from '@trueglaz/core'

/**
 * Where a notification's link opens in the app.
 *
 * The API writes one link per notification, as a web path (it is also the
 * link in the email). This turns that path into a screen here, so tapping a
 * notification takes you to the thing it is about rather than only marking it
 * read. Paths with no screen in the app return null and stay mark-as-read only.
 */
export type AppRoute =
  | { screen: string; params?: Record<string, unknown> }
  | { tab: 'Home' | 'Shop' | 'Sell' | 'Vault' | 'Profile'; params?: Record<string, unknown> }

export function routeForLink(link?: string | null): AppRoute | null {
  if (!link) return null
  const [path, hash] = link.split('#')
  const parts = path.split('?')[0].split('/').filter(Boolean)
  const [head, id] = parts
  switch (head) {
    case 'listings': return id ? { screen: 'Listing', params: { id } } : { tab: 'Shop' }
    case 'items': return id ? { screen: 'SellerItem', params: { id } } : { tab: 'Sell' }
    case 'orders': return id ? { screen: 'OrderDetail', params: { id } } : { screen: 'Orders' }
    case 'sell': return { tab: 'Sell' }
    case 'vault': return { tab: 'Vault', params: id ? { itemId: id } : undefined }
    case 'catalog': return { tab: 'Shop' }
    case 'profile': return hash === 'bank' ? { screen: 'PayoutAccount' } : hash === 'addresses' ? { screen: 'Addresses' } : { tab: 'Profile' }
    default: return null
  }
}

/** Navigate to a route from [routeForLink]; a tab goes through the tab navigator. */
export function openRoute(navigation: any, r: AppRoute) {
  if ('tab' in r) navigation.navigate('Tabs', { screen: r.tab, params: r.params })
  else navigation.navigate(r.screen, r.params)
}

/**
 * Open a notification's link. A submission link (/sell/:id — approved, ship-by
 * reminder, more time, lapsed) is about the gear in it, and the item screen is
 * where its label and status live, so it is looked up and opened there.
 */
export async function openLink(navigation: any, link?: string | null) {
  const m = link?.match(/^\/sell\/([0-9a-f-]{36})/)
  if (m) {
    try {
      const view = await api.submission(m[1])
      const first = view.items[0]
      if (first) return navigation.navigate('SellerItem', { id: first.id })
    } catch { /* fall through to the Sell tab */ }
  }
  const r = routeForLink(link)
  if (r) openRoute(navigation, r)
}
