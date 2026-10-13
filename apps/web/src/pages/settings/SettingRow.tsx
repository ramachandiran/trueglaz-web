import { useState } from 'react'
import { api, ApiError, dateTime, type PlatformSetting } from '@trueglaz/core'

/**
 * One setting, in words and in its own unit. Money is shown and typed in
 * rupees and stored in paise; everything else is the number with its unit
 * beside it. The server checks the bounds again; they are shown here so
 * nobody has to guess them.
 */
export function SettingRow({ s, onSaved }: { s: PlatformSetting; onSaved: () => void }) {
  const rupees = s.unit === 'rupees'
  const isBool = s.valueType === 'boolean'
  // Free text: a sender name, a reply-to email, a WhatsApp number. No rupees, no
  // decimal keypad, no unit or range beside it.
  const isText = s.valueType === 'string'
  const shown = rupees ? fromPaise(s.value) : s.value
  const [draft, setDraft] = useState(shown)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const dirty = draft.trim() !== shown.trim()

  async function commit(raw: string) {
    setBusy(true); setError(null); setSaved(false)
    try {
      const value = rupees ? toPaise(raw) : raw.trim()
      if (value == null) throw new Error('Enter an amount in rupees, like 400 or 399.50')
      await api.setSetting(s.key, value)
      setSaved(true)
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'That did not work')
    } finally {
      setBusy(false)
    }
  }

  const bound = (v?: string | null) => (v == null ? null : rupees ? `₹${fromPaise(v)}` : `${v}`)
  const range = s.minValue != null && s.maxValue != null ? `${bound(s.minValue)} to ${bound(s.maxValue)}${rupees ? '' : ` ${unitWord(s.unit)}`}` : null

  return (
    <div className="st__row">
      <div className="st__row-text">
        <label className="st__row-label" htmlFor={`set-${s.key}`}>{s.label ?? s.key}</label>
        <p className="st__row-desc">{s.description}</p>
        <p className="st__row-meta">
          {range && <>Allowed: {range}</>}
          {s.updatedAt && <> · last changed {dateTime(s.updatedAt)}</>}
        </p>
      </div>
      <div className="st__row-edit">
        {isBool ? (
          // A switch saves on the spot: there is nothing to type, so a Save
          // button beside it would only be a second click for the same choice.
          <select id={`set-${s.key}`} className="tg-input st__input" value={shown} disabled={busy}
            onChange={(e) => void commit(e.target.value)}>
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
        ) : (
          <span className="st__field">
            {rupees && <span className="st__prefix">₹</span>}
            <input id={`set-${s.key}`} className="tg-input st__input" inputMode={isText ? 'text' : 'decimal'} value={draft}
              onChange={(e) => { setDraft(e.target.value); setSaved(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && dirty) void commit(draft) }} />
            {!rupees && !isText && <span className="st__suffix">{unitWord(s.unit)}</span>}
          </span>
        )}
        {!isBool && <button className="tg-button tg-button--primary" disabled={!dirty || busy} onClick={() => void commit(draft)}>{busy ? 'Saving…' : 'Save'}</button>}
        {!isBool && dirty && <button className="st__undo" onClick={() => { setDraft(shown); setError(null) }}>Undo</button>}
        {saved && !dirty && <span className="st__ok" role="status">Saved</span>}
      </div>
      {error && <p className="st__error" role="alert">{error}</p>}
    </div>
  )
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
