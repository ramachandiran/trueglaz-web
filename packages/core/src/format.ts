/** Money arrives in minor units and must never be rounded on the way in. */
export function money(minor: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100)
}

export function moneyExact(minor: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(minor / 100)
}

export function dateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function dateOnly(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** "3 days ago" — for history rows where the exact second is noise. */
export function relative(iso?: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.round((then - Date.now()) / 1000)
  const units: [RelUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['day', 86400],
    ['hour', 3600], ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(secs) >= size) return relFormat(Math.round(secs / size), unit)
  }
  return relFormat(secs, 'second')
}

type RelUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'

/**
 * "3 minutes ago", "yesterday", "in 2 days".
 *
 * Uses Intl.RelativeTimeFormat where the engine has it (browsers), and plain
 * English where it does not: Hermes, the engine in the Android and iOS apps,
 * ships without it, and calling it there threw and closed the app on the
 * notifications screen (TG-99).
 */
function relFormat(n: number, unit: RelUnit): string {
  const Rtf = (Intl as unknown as { RelativeTimeFormat?: typeof Intl.RelativeTimeFormat }).RelativeTimeFormat
  if (typeof Rtf === 'function') {
    try { return new Rtf(undefined, { numeric: 'auto' }).format(n, unit) } catch { /* fall through */ }
  }
  if (unit === 'day' && n === -1) return 'yesterday'
  if (unit === 'day' && n === 1) return 'tomorrow'
  if (unit === 'second' && Math.abs(n) < 10) return 'just now'
  const abs = Math.abs(n)
  const word = `${abs} ${unit}${abs === 1 ? '' : 's'}`
  return n < 0 ? `${word} ago` : `in ${word}`
}

/**
 * The singular of a category name.
 *
 * A naive trailing-s strip turns "Lenses" into "Lense". The list is short and
 * known, so it is spelled out rather than guessed at.
 */
export function singularCategory(name: string): string {
  const known: Record<string, string> = {
    Lenses: 'Lens',
    Cameras: 'Camera',
    Accessories: 'Accessory',
  }
  return known[name] ?? name.replace(/s$/, '')
}
