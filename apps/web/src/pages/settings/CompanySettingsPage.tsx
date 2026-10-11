import { useEffect, useState } from 'react'
import { api, ApiError, dateTime, useApi, type CompanyProfile } from '@trueglaz/core'
import { ErrorNote, Loading } from '../../components/ui'

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

/**
 * The company named on tax invoices.
 *
 * Every invoice copies these details when it is issued, so a change here
 * applies to invoices from now on and never reprints one already sent. The
 * GSTIN is checked against the state in the address (its first two digits are
 * the state's GST code), the same check the server makes.
 */
export function CompanySettingsPage() {
  const company = useApi(() => api.adminCompany(), [])
  const states = useApi(() => api.companyStates(), [])
  const history = useApi(() => api.companyHistory(), [])
  const [form, setForm] = useState<CompanyProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (company.data && !form) setForm(company.data.profile) }, [company.data]) // eslint-disable-line react-hooks/exhaustive-deps

  if (company.loading && !company.data) return <Loading label="Loading company details" />
  if (company.error) return <ErrorNote error={company.error} onRetry={company.reload} />
  if (!company.data || !form) return null

  const set = (k: keyof CompanyProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setSaved(false); setForm({ ...form, [k]: e.target.value })
  }
  const gstin = (form.gstin ?? '').trim().toUpperCase()
  const code = states.data?.[form.state]
  const gstinNote = !gstin ? null
    : !GSTIN.test(gstin) ? 'A GSTIN is 15 characters, like 29ABCDE1234F1Z5'
      : code && gstin.slice(0, 2) !== code ? `This GSTIN is registered in state code ${gstin.slice(0, 2)}, but ${form.state} is ${code}`
        : null
  const dirty = JSON.stringify(form) !== JSON.stringify(company.data.profile)

  async function save() {
    setBusy(true); setError(null)
    try {
      const blank = (v: string | null) => (v && v.trim() ? v.trim() : null)
      const r = await api.setCompany({
        ...form!, gstin: blank(form!.gstin)?.toUpperCase() ?? null, pan: blank(form!.pan)?.toUpperCase() ?? null,
        tradeName: blank(form!.tradeName), addressLine2: blank(form!.addressLine2), email: blank(form!.email),
        phone: blank(form!.phone), website: blank(form!.website), invoiceFooter: blank(form!.invoiceFooter),
      })
      setForm(r.profile)
      setSaved(true)
      company.reload(); history.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally {
      setBusy(false)
    }
  }

  const field = (k: keyof CompanyProfile, label: string, opts: { wide?: boolean; required?: boolean; hint?: string; upper?: boolean } = {}) => (
    <label className={`st__f${opts.wide ? ' st__f--wide' : ''}`}>
      <span>{label}{opts.required && ' *'}</span>
      <input className="tg-input" value={form[k] ?? ''} onChange={set(k)} style={opts.upper ? { textTransform: 'uppercase' } : undefined} />
      {opts.hint && <small className="st__muted">{opts.hint}</small>}
    </label>
  )

  return (
    <section>
      <h2 className="st__h">Company & invoices</h2>
      <p className="st__lede">
        Printed at the top of every tax invoice. Invoices keep the details they were issued with, so changing them here
        applies to invoices from now on.
      </p>
      {company.data.source === 'server' && (
        <p className="st__banner">
          Not saved here yet: invoices are using the server's configuration{company.data.profile.legalName ? ` (“${company.data.profile.legalName}”)` : ' (which is empty, so they say “TrueGlaz”)'}.
          Fill this in and save to take it over.
        </p>
      )}

      <div className="st__company">
        <div className="st__card">
          <div className="st__form">
            {field('legalName', 'Legal name', { wide: true, required: true, hint: 'As registered, e.g. TrueGlaz Marketplace Private Limited' })}
            {field('tradeName', 'Trade name', { hint: 'The name people know, e.g. TrueGlaz' })}
            <label className="st__f">
              <span>GSTIN</span>
              <input className="tg-input" value={form.gstin ?? ''} onChange={set('gstin')} style={{ textTransform: 'uppercase' }} maxLength={15} />
              {gstinNote ? <small className="st__bad">{gstinNote}</small> : gstin ? <small className="st__good">Looks right · PAN {gstin.slice(2, 12)}</small> : <small className="st__muted">Leave empty if not registered yet</small>}
            </label>
            {field('addressLine1', 'Registered address', { wide: true, required: true })}
            {field('addressLine2', 'Address line 2', { wide: true })}
            {field('city', 'City', { required: true })}
            <label className="st__f">
              <span>State *</span>
              <select className="tg-select" value={form.state} onChange={set('state')}>
                <option value="">Select</option>
                {Object.keys(states.data ?? {}).map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            {field('pincode', 'PIN code', { required: true })}
            {field('email', 'Email on invoices')}
            {field('phone', 'Phone on invoices')}
            {field('website', 'Website', { hint: 'https://…' })}
            <label className="st__f st__f--wide">
              <span>Invoice footer</span>
              <textarea className="tg-input" rows={2} maxLength={500} value={form.invoiceFooter ?? ''} onChange={set('invoiceFooter')} />
              <small className="st__muted">A line at the bottom of every invoice, e.g. bank details or a thank-you.</small>
            </label>
          </div>
          <div className="st__actions">
            {company.data.updatedAt && <span className="st__muted">Last saved {dateTime(company.data.updatedAt)}{company.data.updatedBy ? ` by ${company.data.updatedBy}` : ''}</span>}
            <span className="st__spacer" />
            {dirty && <button className="st__undo" onClick={() => { setForm(company.data!.profile); setError(null) }}>Undo changes</button>}
            <button className="tg-button tg-button--primary" disabled={!dirty || busy || !!gstinNote} onClick={save}>{busy ? 'Saving…' : 'Save company details'}</button>
            {saved && !dirty && <span className="st__ok" role="status">Saved</span>}
          </div>
          {error && <p className="st__error" role="alert">{error}</p>}
        </div>

        <aside className="st__card st__invoice" aria-label="How it prints">
          <h3 className="st__kicker">How the invoice header will read</h3>
          <div className="st__inv">
            <div>
              <div className="st__inv-brand">{form.legalName || 'TrueGlaz'}</div>
              <div className="st__inv-sub">Every unit graded, every defect disclosed</div>
              <div className="st__inv-sub">{[form.addressLine1, form.addressLine2, [form.city, form.state, form.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>
              {gstin && <div className="st__inv-sub">GSTIN {gstin}</div>}
              {form.email && <div className="st__inv-sub">{form.email}</div>}
            </div>
            <div className="st__inv-meta"><strong>Tax invoice</strong><div className="st__inv-sub">TGI2026-000123</div></div>
          </div>
          {form.invoiceFooter && <p className="st__inv-foot">{form.invoiceFooter}</p>}
        </aside>
      </div>

      {(history.data?.length ?? 0) > 0 && (
        <>
          <h3 className="st__kicker">Earlier versions</h3>
          <ul className="st__changes">
            {history.data!.map((h, i) => (
              <li key={i}><strong>{h.profile.legalName}</strong>{h.profile.gstin && ` · ${h.profile.gstin}`} · {h.profile.city}
                <span className="st__muted"> · {h.changedAt && dateTime(h.changedAt)}{h.changedBy ? ` by ${h.changedBy}` : ''}</span></li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
