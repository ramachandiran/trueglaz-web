import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  api, money, dateOnly, useApi,
  type VaultItem, type ProductModel, ApiError,
} from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import { AddPolicyModal, ClaimHelpModal, CoverStrip, Modal, QuoteModal } from '../components/VaultInsurance'
import { ModelPhoto } from '../components/ModelPhoto'
import {
  isE2eeOn, isUnlocked, lockVault, ensureLoaded, decField, encField,
} from '../state/vaultKey'
import { VaultPrivacyModal, type PrivacyMode } from '../components/VaultPrivacyModal'
import './VaultPage.css'

/** The sensitive fields as the owner should see them, decrypting if unlocked. */
function shownSerial(it: VaultItem): string | null {
  if (!it.e2ee) return it.serial
  if (it.serialCipher && isUnlocked()) { try { return decField(it.serialCipher) } catch { return null } }
  return null
}
function shownCost(it: VaultItem): number | null {
  if (!it.e2ee) return it.costMinor
  if (it.costCipher && isUnlocked()) {
    try { const n = parseInt(decField(it.costCipher), 10); return Number.isFinite(n) ? n : null } catch { return null }
  }
  return null
}
/** True when the item has private fields we can't show because the vault is locked. */
function hasLockedFields(it: VaultItem): boolean {
  return it.e2ee && !isUnlocked() && (it.serialCipher != null || it.costCipher != null || it.notesCipher != null)
}

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
  const [privacy, setPrivacy] = useState<PrivacyMode | null>(null)
  // Privacy lives in a module (so it survives navigation); bump to re-read it.
  const [, setPTick] = useState(0)
  const rePrivacy = () => setPTick((n) => n + 1)

  useEffect(() => { ensureLoaded().then(rePrivacy) }, [])

  const e2ee = isE2eeOn()
  const unlocked = isUnlocked()
  const total = useMemo(() => (data ?? []).reduce((n, it) => n + estimate(it), 0), [data])
  const insured = (data ?? []).filter((i) => i.policy).length
  // Asked for a quote or sent a policy: say so, not "0 insured".
  const issuing = (data ?? []).filter((i) => !i.policy && i.insuranceRequest).length

  if (loading) return <Loading label="Opening your vault" />
  if (error) return <ErrorNote error={error} onRetry={reload} />
  const items = data ?? []

  function closePrivacy() { setPrivacy(null) }
  function afterPrivacy() { setPrivacy(null); rePrivacy(); reload() }

  return (
    <div className="vault">
      <header className="vault__head">
        <div>
          <h1 className="vault__title">Gear Vault</h1>
          <p className="vault__sub">What you own — valued from our market, kept private to you.</p>
        </div>
        <button className="tg-button tg-button--primary" onClick={() => setAdding(true)}>+ Add gear</button>
      </header>

      <PrivacyBar
        e2ee={e2ee}
        unlocked={unlocked}
        onSetup={() => setPrivacy('setup')}
        onUnlock={() => setPrivacy('unlock')}
        onRecover={() => setPrivacy('recover')}
        onChange={() => setPrivacy('change')}
        onDisable={() => setPrivacy('disable')}
        onLock={() => { lockVault(); rePrivacy() }}
      />

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
          e2ee={e2ee}
          unlocked={unlocked}
          onNeedUnlock={() => { setAdding(false); setPrivacy('unlock') }}
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
      {privacy && (
        <VaultPrivacyModal mode={privacy} items={items} onDone={afterPrivacy} onClose={closePrivacy} />
      )}
    </div>
  )
}

/** The vault's privacy state and its controls — turn the PIN on, unlock, change, reset. */
function PrivacyBar({ e2ee, unlocked, onSetup, onUnlock, onRecover, onChange, onDisable, onLock }: {
  e2ee: boolean; unlocked: boolean
  onSetup: () => void; onUnlock: () => void; onRecover: () => void
  onChange: () => void; onDisable: () => void; onLock: () => void
}) {
  if (!e2ee) {
    return (
      <div className="vault__privacy">
        <span className="vault__privacy-state">
          <LockIcon open /> Standard privacy — only you see your details
        </span>
        <button className="tg-button tg-button--small tg-button--ghost" onClick={onSetup}>Add a PIN</button>
      </div>
    )
  }
  if (!unlocked) {
    return (
      <div className="vault__privacy vault__privacy--locked">
        <span className="vault__privacy-state">
          <LockIcon /> Vault locked — your serial, price &amp; notes are hidden
        </span>
        <span className="vault__privacy-acts">
          <button className="tg-button tg-button--small" onClick={onUnlock}>Unlock</button>
          <button className="tg-button tg-button--small tg-button--ghost" onClick={onRecover}>Forgot PIN?</button>
        </span>
      </div>
    )
  }
  return (
    <div className="vault__privacy vault__privacy--on">
      <span className="vault__privacy-state">
        <LockIcon open /> Unlocked · PIN protected
      </span>
      <span className="vault__privacy-acts">
        <button className="tg-button tg-button--small tg-button--ghost" onClick={onLock}>Lock</button>
        <button className="tg-button tg-button--small tg-button--ghost" onClick={onChange}>Change PIN</button>
        <button className="tg-button tg-button--small tg-button--ghost" onClick={onDisable}>Turn off</button>
      </span>
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
  const cost = shownCost(item)
  const serial = shownSerial(item)
  const locked = hasLockedFields(item)

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
          {locked ? (
            <span className="gear__locked"><LockIcon /> Locked — unlock to see price &amp; serial</span>
          ) : (
            <>
              {cost != null && <>Bought {money(cost)}{item.purchaseDate ? ` · ${dateOnly(item.purchaseDate)}` : ''}</>}
              {serial && <span className="gear__serial">{cost != null ? ' · ' : ''}ser ••{serial.slice(-4)}</span>}
            </>
          )}
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

function AddGearModal({ e2ee, unlocked, onNeedUnlock, onClose, onAdded }: {
  e2ee: boolean; unlocked: boolean; onNeedUnlock: () => void; onClose: () => void; onAdded: () => void
}) {
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
  const hasPrivate = !!serial.trim() || costMinor != null || !!notes.trim()

  async function submit() {
    // In PIN mode, private fields must be encrypted on this device — that needs the key.
    if (e2ee && hasPrivate && !unlocked) { onNeedUnlock(); return }
    setBusy(true); setErr(null)
    try {
      const base = {
        productModelId: model?.id ?? null,
        modelFreeText: model ? null : q.trim() || null,
        purchaseDate: date || null,
      }
      if (e2ee) {
        await api.addGear({
          ...base,
          serialCipher: serial.trim() ? encField(serial.trim()) : null,
          costCipher: costMinor != null ? encField(String(costMinor)) : null,
          notesCipher: notes.trim() ? encField(notes.trim()) : null,
        })
      } else {
        await api.addGear({
          ...base,
          serial: serial.trim() || null,
          costMinor,
          notes: notes.trim() || null,
        })
      }
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
          <input className="tg-input" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder={e2ee ? 'Encrypted with your PIN' : 'Kept private & sealed'} /></label>
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
      {e2ee && hasPrivate && !unlocked && (
        <p className="vault__hint"><LockIcon /> Unlock your vault to save the serial, price and notes privately.</p>
      )}
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

function LockIcon({ open = false }: { open?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-2px' }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      {open
        ? <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        : <path d="M7 11V7a5 5 0 0 1 10 0v4" />}
    </svg>
  )
}


/** "2 insured", "1 insured · 1 in progress", or "1 insurance request in progress". */
function coverNote(insured: number, open: number): string {
  if (open === 0) return `${insured} insured`
  if (insured > 0) return `${insured} insured · ${open} in progress`
  return `${open} insurance ${open === 1 ? 'request' : 'requests'} in progress`
}
