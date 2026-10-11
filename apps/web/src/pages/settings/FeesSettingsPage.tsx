import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, dateTime, money, useApi, type CommissionBand } from '@trueglaz/core'
import { ErrorNote, Loading } from '../../components/ui'
import { fromPaise, SettingRow, toPaise } from './SettingRow'

type Draft = { from: string; to: string; percent: string }

/**
 * Commission and the other fees.
 *
 * Bands are edited as one set and saved together, because a set only makes
 * sense whole: every price from ₹0 up has to fall in exactly one band. The
 * editor keeps them joined end to end (each band starts where the one before
 * ends) so a gap cannot be typed, and the calculator shows what a seller
 * would get at any price before anything is saved.
 */
export function FeesSettingsPage() {
  const fees = useApi(() => api.adminFees(), [])
  const [draft, setDraft] = useState<Draft[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [price, setPrice] = useState('50000')

  useEffect(() => {
    if (fees.data && !draft) setDraft(fees.data.commissionBands.map(toDraft))
  }, [fees.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const gst = Number(fees.data?.settings.find((s) => s.key === 'commission_gst_percent')?.value ?? 18)
  const shipping = Number(fees.data?.settings.find((s) => s.key === 'shipping_flat_minor')?.value ?? 40000)
  const bands = useMemo(() => (draft ? parse(draft) : null), [draft])
  const current = fees.data?.commissionBands ?? []
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(current.map(toDraft))

  if (fees.loading && !fees.data) return <Loading label="Loading fees" />
  if (fees.error) return <ErrorNote error={fees.error} onRetry={fees.reload} />
  if (!fees.data || !draft) return null

  function edit(i: number, patch: Partial<Draft>) {
    setSaved(false)
    setDraft((d) => {
      const next = d!.map((b, j) => (j === i ? { ...b, ...patch } : b))
      // Joined end to end: the next band starts where this one now ends.
      if (patch.to !== undefined && next[i + 1]) next[i + 1] = { ...next[i + 1], from: patch.to }
      return next
    })
  }

  function addBand() {
    setSaved(false)
    setDraft((d) => {
      const last = d![d!.length - 1]
      const start = Number(last.from || 0)
      const split = String(Math.max(start * 2, start + 10000))
      return [...d!.slice(0, -1), { ...last, to: split }, { from: split, to: '', percent: last.percent }]
    })
  }

  function removeBand(i: number) {
    setSaved(false)
    setDraft((d) => {
      const next = d!.filter((_, j) => j !== i)
      // The band before takes over the removed band's range.
      if (i > 0) next[i - 1] = { ...next[i - 1], to: i < d!.length - 1 ? d![i].to : '' }
      else if (next[0]) next[0] = { ...next[0], from: '0' }
      return next
    })
  }

  async function save() {
    if (!bands || 'error' in bands) return
    setBusy(true); setError(null)
    try {
      await api.setCommissionBands(bands.ok)
      setSaved(true)
      setDraft(null)
      fees.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally {
      setBusy(false)
    }
  }

  const salePaise = toPaise(price)
  const calc = salePaise && bands && !('error' in bands) ? quote(Number(salePaise), bands.ok, gst) : null

  return (
    <section>
      <h2 className="st__h">Fees & commission</h2>
      <p className="st__lede">
        What TrueGlaz keeps from each sale, and what a buyer pays for delivery. A change applies to prices proposed
        from now on; every item already priced keeps the fee its seller agreed to.
      </p>

      <div className="st__card">
        <h3 className="st__card-title">Commission bands</h3>
        <p className="st__muted">Chosen by the sale price. Each band runs from its start up to, but not including, its end.</p>
        <table className="st__bands">
          <thead><tr><th>From</th><th>Up to</th><th>Commission</th><th /></tr></thead>
          <tbody>
            {draft.map((b, i) => {
              const last = i === draft.length - 1
              return (
                <tr key={i}>
                  <td><span className="st__money">₹{fromPaise(b.from || '0')}</span></td>
                  <td>
                    {last ? <span className="st__muted">and above</span> : (
                      <span className="st__field">
                        <span className="st__prefix">₹</span>
                        <input className="tg-input st__input" inputMode="decimal" aria-label={`Band ${i + 1} ends at`}
                          value={b.to === '' ? '' : fromPaise(b.to)}
                          onChange={(e) => { const p = toPaise(e.target.value); edit(i, { to: p ?? e.target.value }) }} />
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="st__field">
                      <input className="tg-input st__input st__input--pct" inputMode="decimal" aria-label={`Band ${i + 1} commission`}
                        value={b.percent} onChange={(e) => edit(i, { percent: e.target.value })} />
                      <span className="st__suffix">%</span>
                    </span>
                  </td>
                  <td>{draft.length > 1 && <button className="st__undo" onClick={() => removeBand(i)} aria-label={`Remove band ${i + 1}`}>Remove</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="st__actions">
          <button className="tg-button" onClick={addBand} disabled={draft.length >= 10}>Add a band</button>
          <span className="st__spacer" />
          {dirty && <button className="st__undo" onClick={() => { setDraft(current.map(toDraft)); setError(null) }}>Undo changes</button>}
          <button className="tg-button tg-button--primary" disabled={!dirty || busy || !bands || 'error' in bands} onClick={save}>
            {busy ? 'Saving…' : 'Save bands'}
          </button>
          {saved && !dirty && <span className="st__ok" role="status">Saved — new prices use these bands</span>}
        </div>
        {bands && 'error' in bands && <p className="st__error" role="alert">{bands.error}</p>}
        {error && <p className="st__error" role="alert">{error}</p>}
      </div>

      <div className="st__card st__calc">
        <h3 className="st__card-title">What a sale works out to</h3>
        <label className="st__field st__calc-input">
          <span>If it sells for</span>
          <span className="st__prefix">₹</span>
          <input className="tg-input st__input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        {calc ? (
          <dl className="st__calc-lines">
            <div><dt>Commission ({calc.percent}%{dirty ? ', as edited' : ''})</dt><dd>{money(calc.commission)}</dd></div>
            <div><dt>GST on commission ({gst}%)</dt><dd>{money(calc.tax)}</dd></div>
            <div className="st__calc-net"><dt>The seller gets</dt><dd>{money(calc.net)}</dd></div>
            <div><dt>The buyer pays (with ₹{fromPaise(shipping)} delivery)</dt><dd>{money(Number(salePaise) + shipping)}</dd></div>
          </dl>
        ) : <p className="st__muted">Enter a price in rupees.</p>}
      </div>

      <div className="st__card">
        <h3 className="st__card-title">GST and delivery</h3>
        {fees.data.settings.map((s) => <SettingRow key={s.key + s.value} s={s} onSaved={fees.reload} />)}
      </div>

      <h3 className="st__kicker">Earlier commission bands</h3>
      <ul className="st__changes">
        {fees.data.history.map((h, i) => (
          <li key={i}>
            <strong>{h.bands.map((b) => `${b.percent}%${b.toMinor != null ? ` to ₹${Number(fromPaise(b.toMinor)).toLocaleString('en-IN')}` : ' above'}`).join(' · ')}</strong>
            <span className="st__muted"> · {h.validFrom && dateTime(h.validFrom)} – {h.validTo ? dateTime(h.validTo) : 'now'}{h.setBy ? ` · set by ${h.setBy}` : ''}</span>
          </li>
        ))}
      </ul>
      <p className="st__muted st__note">
        Inspection, handling, restocking and return-shipping fees exist in the fee table but are not charged in this
        version, so they are not shown here.
      </p>
    </section>
  )
}

function toDraft(b: CommissionBand): Draft {
  return { from: String(b.fromMinor), to: b.toMinor == null ? '' : String(b.toMinor), percent: String(b.percent) }
}

/** The draft as bands the API accepts, or the first thing wrong with it. */
function parse(d: Draft[]): { ok: CommissionBand[] } | { error: string } {
  const out: CommissionBand[] = []
  for (let i = 0; i < d.length; i++) {
    const n = i + 1
    const pct = Number(d[i].percent)
    if (d[i].percent.trim() === '' || Number.isNaN(pct)) return { error: `Band ${n}: enter a commission percentage` }
    if (pct < 0 || pct > 50) return { error: `Band ${n}: commission must be between 0% and 50%` }
    if (!/^\d+(\.\d{1,2})?$/.test(d[i].percent.trim())) return { error: `Band ${n}: at most two decimal places` }
    const from = Number(d[i].from || 0)
    const last = i === d.length - 1
    const to = last ? null : Number(d[i].to)
    if (!last && (d[i].to === '' || Number.isNaN(to))) return { error: `Band ${n}: enter where it ends, in rupees` }
    if (to != null && to <= from) return { error: `Band ${n} has to end above ₹${fromPaise(from)}` }
    out.push({ fromMinor: from, toMinor: to, percent: pct })
  }
  return { ok: out }
}

function quote(sale: number, bands: CommissionBand[], gst: number) {
  const band = bands.find((b) => sale >= b.fromMinor && (b.toMinor == null || sale < b.toMinor)) ?? bands[bands.length - 1]
  const commission = Math.round((sale * band.percent) / 100)
  const tax = Math.round((commission * gst) / 100)
  return { percent: band.percent, commission, tax, net: sale - commission - tax }
}
