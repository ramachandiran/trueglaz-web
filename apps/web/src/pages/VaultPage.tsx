import { useMemo, useState } from 'react'
import {
  api, money, dateOnly, useApi,
  type VaultItem, type InsurancePlan, type InsuranceQuote, type ProductModel, ApiError,
} from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import './VaultPage.css'

/**
 * The Gear Vault: a signed-in user's private record of the gear they own.
 *
 * Nothing here touches selling. The value is an estimate from TrueGlaz's own
 * market (never a grade — we never inspected it), the warranty is derived from
 * the purchase date, and each item can be insured through a partner.
 */
export function VaultPage() {
  const { data, error, loading, reload } = useApi(() => api.vault(), [])
  const [adding, setAdding] = useState(false)
  const [insuring, setInsuring] = useState<VaultItem | null>(null)

  const total = useMemo(() => (data ?? []).reduce((n, it) => n + estimate(it), 0), [data])
  const insured = (data ?? []).filter((i) => i.policy).length

  if (loading) return <Loading label="Opening your vault" />
  if (error) return <ErrorNote error={error} onRetry={reload} />
  const items = data ?? []

  return (
    <div className="vault">
      <header className="vault__head">
        <div>
          <h1 className="vault__title">Gear Vault</h1>
          <p className="vault__sub">What you own — valued from our market, kept private to you.</p>
        </div>
        <button className="tg-button tg-button--primary" onClick={() => setAdding(true)}>+ Add gear</button>
      </header>

      {items.length > 0 && (
        <section className="vault__hero">
          <span className="vault__hero-lab">Estimated market value</span>
          <span className="vault__hero-val">~{money(total)}</span>
          <span className="vault__hero-note">
            {items.length} item{items.length === 1 ? '' : 's'} · {insured} insured · indicative, final price is set at a free inspection
          </span>
        </section>
      )}

      {items.length === 0 ? (
        <div className="vault__empty">
          <strong>Your vault is empty.</strong>
          <span>Add the gear you own to track its value, warranty and insurance in one place.</span>
          <button className="tg-button tg-button--primary" onClick={() => setAdding(true)}>+ Add your first item</button>
        </div>
      ) : (
        <ul className="vault__list">
          {items.map((it) => (
            <GearCard key={it.id} item={it} onInsure={() => setInsuring(it)} onChanged={reload} />
          ))}
        </ul>
      )}

      {adding && <AddGearModal onClose={() => setAdding(false)} onAdded={() => { setAdding(false); reload() }} />}
      {insuring && (
        <InsureModal
          item={insuring}
          onClose={() => setInsuring(null)}
          onBought={() => { setInsuring(null); reload() }}
        />
      )}
    </div>
  )
}

/** The midpoint estimate, or the purchase cost when we have no valuation yet. */
function estimate(it: VaultItem): number {
  return it.valuation?.midMinor ?? it.purchaseCostMinor ?? 0
}

const WARRANTY_LABEL: Record<VaultItem['warrantyStatus'], string> = {
  active: 'Under warranty', expiring: 'Warranty ending soon', expired: 'Warranty expired', unknown: 'Warranty unknown',
}

function GearCard({ item, onInsure, onChanged }: { item: VaultItem; onInsure: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const v = item.valuation

  async function remove() {
    if (!window.confirm(`Remove ${item.modelLabel} from your vault?`)) return
    setBusy(true)
    try { await api.removeGear(item.id); onChanged() } finally { setBusy(false) }
  }

  return (
    <li className="gear">
      <span className="gear__thumb" aria-hidden="true"><CameraIcon /></span>
      <div className="gear__main">
        <div className="gear__name">{item.modelLabel}</div>
        <div className="gear__meta">
          {item.purchaseCostMinor != null && <>Bought {money(item.purchaseCostMinor)}{item.purchaseDate ? ` · ${dateOnly(item.purchaseDate)}` : ''}</>}
          {item.serialLast4 && <span className="gear__serial"> · ser ••{item.serialLast4}</span>}
        </div>
        <div className={`gear__warr gear__warr--${item.warrantyStatus}`}>
          <span className="gear__dot" aria-hidden="true" />
          {WARRANTY_LABEL[item.warrantyStatus]}
          {item.warrantyExpiry && item.warrantyStatus !== 'expired' && ` · until ${dateOnly(item.warrantyExpiry)}`}
        </div>
      </div>
      <div className="gear__right">
        {v ? (
          <>
            <div className="gear__val">~{money(v.midMinor)}</div>
            <div className="gear__range">
              {v.lowMinor !== v.highMinor ? `${money(v.lowMinor)}–${money(v.highMinor)}` : 'est.'}
              {v.basis === 'msrp' && <span className="gear__indic"> · indicative</span>}
            </div>
          </>
        ) : (
          <div className="gear__range">Estimating…</div>
        )}
        <div className="gear__actions">
          {item.policy ? (
            <span className="gear__insured" title={`Policy ${item.policy.policyNo}`}>
              ✓ Insured{!item.policy.live ? ' (demo)' : ''}
            </span>
          ) : (
            <button className="tg-button tg-button--small" onClick={onInsure}>Insure</button>
          )}
          <button className="tg-button tg-button--small tg-button--ghost" disabled={busy} onClick={remove}>Remove</button>
        </div>
      </div>
    </li>
  )
}

// -- add gear ------------------------------------------------------------------

function AddGearModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ProductModel[]>([])
  const [model, setModel] = useState<ProductModel | null>(null)
  const [serial, setSerial] = useState('')
  const [cost, setCost] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function search(text: string) {
    setQ(text); setModel(null)
    if (text.trim().length < 2) { setResults([]); return }
    try { setResults((await api.searchModels(text.trim(), 8)).content) } catch { setResults([]) }
  }

  async function submit() {
    setBusy(true); setErr(null)
    try {
      await api.addGear({
        productModelId: model?.id ?? null,
        modelFreeText: model ? null : q.trim() || null,
        serialNumber: serial.trim() || null,
        purchaseCostMinor: cost ? Math.round(parseFloat(cost) * 100) : null,
        purchaseDate: date || null,
        notes: notes.trim() || null,
      })
      onAdded()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not add that')
    } finally { setBusy(false) }
  }

  const canSave = (model != null || q.trim().length > 1) && !busy

  return (
    <Modal title="Add gear" onClose={onClose}>
      <label className="vault__field">
        <span>Model</span>
        <input className="tg-input" placeholder="Search the catalogue, or type what it is" value={model ? `${model.name}` : q}
          onChange={(e) => search(e.target.value)} autoFocus />
      </label>
      {!model && results.length > 0 && (
        <ul className="vault__results">
          {results.map((m) => (
            <li key={m.id}><button type="button" onClick={() => { setModel(m); setResults([]) }}>{m.name}</button></li>
          ))}
        </ul>
      )}
      <div className="vault__grid2">
        <label className="vault__field"><span>Serial number</span>
          <input className="tg-input" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Kept private & sealed" /></label>
        <label className="vault__field"><span>What you paid (₹)</span>
          <input className="tg-input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 130000" /></label>
      </div>
      <div className="vault__grid2">
        <label className="vault__field"><span>Purchase date</span>
          <input className="tg-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="vault__field"><span>Notes</span>
          <input className="tg-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label>
      </div>
      <p className="vault__hint">We’ll estimate its value from our market and work out the warranty from the purchase date.</p>
      {err && <p className="ops__error" role="alert">{err}</p>}
      <div className="vault__modal-actions">
        <button className="tg-button" onClick={onClose}>Cancel</button>
        <button className="tg-button tg-button--primary" disabled={!canSave} onClick={submit}>{busy ? 'Adding…' : 'Add to vault'}</button>
      </div>
    </Modal>
  )
}

// -- insure --------------------------------------------------------------------

function InsureModal({ item, onClose, onBought }: { item: VaultItem; onClose: () => void; onBought: () => void }) {
  const { data: quote, error, loading } = useApi<InsuranceQuote>(() => api.insuranceQuote(item.id), [item.id])
  const [plan, setPlan] = useState<string>('plus')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function buy() {
    setBusy(true); setErr(null)
    try { await api.buyInsurance(item.id, plan, quote?.sumInsuredMinor); onBought() }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not buy cover') }
    finally { setBusy(false) }
  }

  return (
    <Modal title={`Insure ${item.modelLabel}`} onClose={onClose}>
      {loading && <Loading label="Getting a quote" />}
      {error && <ErrorNote error={error} />}
      {quote && (
        <>
          <p className="vault__hint">
            Cover amount <strong>~{money(quote.sumInsuredMinor)}</strong> — from your vault estimate.
            {!quote.providerLive && <span className="gear__indic"> Demo cover: no real policy is issued.</span>}
          </p>
          <ul className="vault__plans">
            {quote.plans.map((p: InsurancePlan) => (
              <li key={p.code}>
                <label className={`vault__plan${plan === p.code ? ' vault__plan--sel' : ''}`}>
                  <input type="radio" name="plan" checked={plan === p.code} onChange={() => setPlan(p.code)} />
                  <span className="vault__plan-main">
                    <strong>{p.title}</strong>
                    <span className="vault__plan-blurb">{p.blurb}</span>
                  </span>
                  <span className="vault__plan-price">{money(p.totalMinor)}<small>/year</small></span>
                </label>
              </li>
            ))}
          </ul>
          <label className="vault__consent">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I’ve read the policy wording and am choosing this cover myself.
          </label>
          <p className="vault__fineprint">
            Underwritten by an IRDAI-licensed insurer · TrueGlaz Protect. Your proof of ownership is attached to the policy.
          </p>
          {err && <p className="ops__error" role="alert">{err}</p>}
          <div className="vault__modal-actions">
            <button className="tg-button" onClick={onClose}>Cancel</button>
            <button className="tg-button tg-button--primary" disabled={!agree || busy} onClick={buy}>
              {busy ? 'Buying…' : `Buy ${quote.plans.find((p) => p.code === plan)?.title ?? ''} cover`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

// -- bits ----------------------------------------------------------------------

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="vault__overlay" onClick={onClose}>
      <div className="vault__modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="vault__modal-head">
          <h2>{title}</h2>
          <button className="vault__x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
