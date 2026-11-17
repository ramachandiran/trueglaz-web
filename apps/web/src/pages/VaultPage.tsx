import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  api, money, dateOnly, useApi,
  type VaultItem, type ProductModel, ApiError,
} from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import { AddPolicyModal, ClaimHelpModal, CoverStrip, Modal, QuoteModal } from '../components/VaultInsurance'
import { ModelPhoto } from '../components/ModelPhoto'
import './VaultPage.css'

/**
 * The Gear Vault: a signed-in user's private record of the gear they own.
 *
 * Nothing here touches selling. The value is an estimate from TrueGlaz's own
 * market (never a grade — we never inspected it), the warranty is derived from
 * the purchase date, and each item can get an insurance quote from a licensed
 * agent (TrueGlaz refers it; the policy is the owner's with the insurer).
 */
export function VaultPage() {
  const { itemId } = useParams()
  const { data, error, loading, reload } = useApi(() => api.vault(), [])
  const [adding, setAdding] = useState(false)
  const [insuring, setInsuring] = useState<{ item: VaultItem; what: 'quote' | 'policy' | 'claim' } | null>(null)
  const total = useMemo(() => (data ?? []).reduce((n, it) => n + estimate(it), 0), [data])
  const insured = (data ?? []).filter((i) => i.policy).length
  // Asked for a quote or sent a policy: say so, not "0 insured".
  const issuing = (data ?? []).filter((i) => !i.policy && i.insuranceRequest).length

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
            {items.length} item{items.length === 1 ? '' : 's'} · {coverNote(insured, issuing)} · indicative, final price is set at a free inspection
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
            <GearCard key={it.id} item={it} focused={it.id === itemId} onChanged={reload}
              onInsure={(what) => setInsuring({ item: it, what })} />
          ))}
        </ul>
      )}

      {adding && (
        <AddGearModal
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); reload() }}
        />
      )}
      {insuring?.what === 'quote' && (
        <QuoteModal item={insuring.item} onClose={() => setInsuring(null)} onDone={() => { setInsuring(null); reload() }} />
      )}
      {insuring?.what === 'policy' && (
        <AddPolicyModal item={insuring.item} onClose={() => setInsuring(null)} onDone={() => { setInsuring(null); reload() }} />
      )}
      {insuring?.what === 'claim' && <ClaimHelpModal onClose={() => setInsuring(null)} />}
    </div>
  )
}

/** The midpoint estimate, or the purchase cost when we have no valuation yet. */
function estimate(it: VaultItem): number {
  return it.valuation?.midMinor ?? it.costMinor ?? 0
}

const WARRANTY_LABEL: Record<VaultItem['warrantyStatus'], string> = {
  active: 'Under warranty', expiring: 'Warranty ending soon', expired: 'Warranty expired', unknown: 'Warranty unknown',
}

function GearCard({ item, focused, onInsure, onChanged }: {
  item: VaultItem; focused?: boolean; onInsure: (what: 'quote' | 'policy' | 'claim') => void; onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  // Opened from a notification about this item: bring it into view.
  const ref = useFocusScroll(focused)
  const v = item.valuation
  const cost = item.costMinor
  const serial = item.serial

  async function remove() {
    if (!window.confirm(`Remove ${item.modelLabel} from your vault?`)) return
    setBusy(true)
    try { await api.removeGear(item.id); onChanged() } finally { setBusy(false) }
  }

  return (
    <li ref={ref} className={`gear${focused ? ' gear--focused' : ''}`}>
      <div className="gear__row">
      {/* The admin-set model picture; the drawn placeholder for free-text gear. */}
      <span className="gear__thumb" aria-hidden="true">
        <ModelPhoto modelId={item.productModelId} kind="camera" size="thumb" alt="" badge={false} />
      </span>
      <div className="gear__main">
        <div className="gear__name">{item.modelLabel}</div>
        <div className="gear__meta">
          {cost != null && <>Bought {money(cost)}{item.purchaseDate ? ` · ${dateOnly(item.purchaseDate)}` : ''}</>}
          {serial && <span className="gear__serial">{cost != null ? ' · ' : ''}ser ••{serial.slice(-4)}</span>}
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
          <button className="tg-button tg-button--small tg-button--ghost" disabled={busy} onClick={remove}>Remove</button>
        </div>
      </div>
      </div>
      <CoverStrip item={item} onChanged={onChanged}
        onQuote={() => onInsure('quote')} onAddPolicy={() => onInsure('policy')} onClaimHelp={() => onInsure('claim')} />
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

  const costMinor = cost ? Math.round(parseFloat(cost) * 100) : null

  async function submit() {
    setBusy(true); setErr(null)
    try {
      await api.addGear({
        productModelId: model?.id ?? null,
        modelFreeText: model ? null : q.trim() || null,
        purchaseDate: date || null,
        serial: serial.trim() || null,
        costMinor,
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

// -- bits ----------------------------------------------------------------------

/** Scroll an element into view once, when it becomes the focused one. */
function useFocusScroll(focused?: boolean) {
  const [el, setEl] = useState<HTMLLIElement | null>(null)
  useEffect(() => { if (focused && el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [focused, el])
  return setEl
}


/** "2 insured", "1 insured · 1 in progress", or "1 insurance request in progress". */
function coverNote(insured: number, open: number): string {
  if (open === 0) return `${insured} insured`
  if (insured > 0) return `${insured} insured · ${open} in progress`
  return `${open} insurance ${open === 1 ? 'request' : 'requests'} in progress`
}
