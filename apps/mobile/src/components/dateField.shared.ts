/** What DateField takes, on every platform (TG-175). Dates are the API's `YYYY-MM-DD`; '' is unset. */
export interface DateFieldProps {
  label?: string
  value: string
  onChange: (isoDay: string) => void
  minimumDate?: string
  maximumDate?: string
  placeholder?: string
  hint?: string
  /** Shows a clear button once a date is chosen. */
  optional?: boolean
}

/**
 * A calendar day, as a LOCAL date. `new Date('2024-06-15')` would be midnight
 * UTC, which is the 14th anywhere west of Greenwich: the day must not move.
 */
export function fromIsoDay(s?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? '').trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function toIsoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "15 Jun 2024": the same everywhere, whatever the phone's locale. */
export function prettyDay(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Today, as `YYYY-MM-DD`, for "not in the future" limits. */
export function todayIso(): string {
  return toIsoDay(new Date())
}
