import { dateTime, type PlatformSetting } from '@trueglaz/core'

/**
 * One setting, in words and in its own unit. Money is shown and typed in
 * rupees and stored in paise; everything else is the number with its unit
 * beside it. The server checks the bounds again; they are shown here so
 * nobody has to guess them.
 */
export function SettingRow({ s, value, onChange, error }: {
  s: PlatformSetting
  /** What the field shows now: the saved value, or the staged change. */
  value: string
  onChange: (v: string) => void
  error?: string | null
}) {
  const rupees = s.unit === 'rupees'
  const isBool = s.valueType === 'boolean'
  // Free text: a sender name, a reply-to email, a WhatsApp number. No rupees, no
  // decimal keypad, no unit or range beside it.
  const isText = s.valueType === 'string'
  const shown = shownValue(s)
  // TG-204: nothing saves from the row. A change is staged here and saved with
  // the others from the page's "Review and save" bar.
  const changed = value.trim() !== shown.trim()

  const bound = (v?: string | null) => (v == null ? null : rupees ? `₹${fromPaise(v)}` : `${v}`)
  const range = s.minValue != null && s.maxValue != null ? `${bound(s.minValue)} to ${bound(s.maxValue)}${rupees ? '' : ` ${unitWord(s.unit)}`}` : null

  return (
    <div className={`st__row${changed ? ' st__row--changed' : ''}${error ? ' st__row--bad' : ''}`}>
      <div className="st__row-text">
        <label className="st__row-label" htmlFor={`set-${s.key}`}>
          {s.label ?? s.key}
          {changed && <span className="c-chip2 c-chip2--warn st__changed">Not saved</span>}
        </label>
        <p className="st__row-desc">{s.description}</p>
        <p className="st__row-meta">
          {range && <>Allowed: {range}</>}
          {s.updatedAt && <> · last changed {dateTime(s.updatedAt)}</>}
        </p>
      </div>
      <div className="st__row-edit">
        {isBool ? (
          <select id={`set-${s.key}`} className="tg-input st__input" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
        ) : (
          <span className="st__field">
            {rupees && <span className="st__prefix">₹</span>}
            <input id={`set-${s.key}`} className="tg-input st__input" inputMode={isText ? 'text' : 'decimal'} value={value}
              aria-invalid={!!error || undefined} aria-describedby={error ? `set-${s.key}-err` : undefined}
              onChange={(e) => onChange(e.target.value)} />
            {!rupees && !isText && <span className="st__suffix">{unitWord(s.unit)}</span>}
          </span>
        )}
        {changed && <button className="st__undo" onClick={() => onChange(shown)}>Undo</button>}
      </div>
      {error && <p id={`set-${s.key}-err`} className="st__error" role="alert">{error}</p>}
    </div>
  )
}

/** The saved value as the field shows it: rupees for money, otherwise as stored. */
export function shownValue(s: PlatformSetting): string {
  return s.unit === 'rupees' ? fromPaise(s.value) : s.value
}

/** A field's text as the API stores it, or null when it is not a valid amount. */
export function storedValue(s: PlatformSetting, v: string): string | null {
  return s.unit === 'rupees' ? toPaise(v) : v.trim()
}

/** A value as a person reads it: "₹400", "48 hours", "On". */
export function readable(s: PlatformSetting, stored: string | null): string {
  if (stored == null) return '—'
  if (s.valueType === 'boolean') return stored === 'true' ? 'On' : 'Off'
  if (s.unit === 'rupees') return `₹${fromPaise(stored)}`
  return s.valueType === 'string' ? (stored || '(empty)') : `${stored} ${unitWord(s.unit)}`.trim()
}

export function unitWord(unit?: string | null): string {
  return unit === 'percent' ? '%' : unit ?? ''
}

export function fromPaise(v: string | number): string {
  const n = Number(v) / 100
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export function toPaise(rupees: string): string | null {
  const t = rupees.replace(/[,₹\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return String(Math.round(Number(t) * 100))
}
