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

/**
 * An Indian mobile as typed, with or without +91, 0 or spaces, to E.164
 * (+919876543210); null when it is not ten digits starting 6–9 (TG-109).
 */
export function indianMobile(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null
}

/** The ten digits after +91, for a field that shows +91 itself. */
export function localMobile(input: string): string {
  const d = input.replace(/\D/g, '')
  return (d.length > 10 && d.startsWith('91') ? d.slice(2) : d).slice(0, 10)
}

/**
 * What is wrong with a GSTIN as typed, or null when it is right (TG-119): shape,
 * state code and the GSTN mod-36 check character, the same checks as the server.
 */
export function gstinProblem(raw: string): string | null {
  const g = raw.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (g.length !== 15) return 'A GSTIN has 15 characters'
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return 'That does not look like a GSTIN'
  const state = Number(g.slice(0, 2))
  if (!((state >= 1 && state <= 38) || state === 97 || state === 99)) return 'The first two digits are not a state code'
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const v = chars.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(v / 36) + (v % 36)
  }
  return chars[(36 - (sum % 36)) % 36] === g[14] ? null : 'That GSTIN has a typo: check it against the GST certificate'
}
