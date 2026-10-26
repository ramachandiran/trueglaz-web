import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, getStorage, isOps, money, useSession, type ProductModel, type VaultItem } from '@trueglaz/core'
import '../pages/VaultPage.css'

const SEEN_KEY = 'trueglaz.vault.introSeen'
/** Only offered where the person is just landing, never mid-task (checkout, etc.). */
const HOME_PATHS = ['/', '/catalog', '/sell']

/**
 * A one-time, value-led invitation to start a Gear Vault.
 *
 * It leads with the payoff (what your gear is worth), asks for one field, and
 * shows an instant estimate — rather than dropping a brand-new user into a form.
 * It never blocks: "Not now" dismisses it, the Vault stays in the nav, and it is
 * only offered to someone whose vault is still empty and who hasn't seen it.
 */
export function VaultIntro() {
  const { session } = useSession()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const [eligible, setEligible] = useState(false)
  const [step, setStep] = useState<'offer' | 'added'>('offer')
  const [added, setAdded] = useState<VaultItem | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      if (!session || isOps(session)) return
      try {
        if (await getStorage().get(SEEN_KEY)) return
        const items = await api.vault()
        if (!live) return
        if (items.length > 0) { await getStorage().set(SEEN_KEY, '1'); return }
        setEligible(true)
      } catch { /* vault unreachable — just don't offer */ }
    })()
    return () => { live = false }
  }, [session])

  async function dismiss() {
    setEligible(false)
    try { await getStorage().set(SEEN_KEY, '1') } catch { /* fine */ }
  }

  if (!eligible || !HOME_PATHS.includes(pathname)) return null

  return (
    <div className="vault__overlay" onClick={dismiss}>
      <div className="vault__modal vault-intro" role="dialog" aria-label="Start your Gear Vault" onClick={(e) => e.stopPropagation()}>
        {step === 'offer' ? (
          <OfferStep
            onAdded={(it) => { setAdded(it); setStep('added') }}
            onSkip={dismiss}
          />
        ) : (
          <AddedStep
            item={added!}
            onAddAnother={() => { setAdded(null); setStep('offer') }}
            onGoToVault={() => { dismiss(); nav('/vault') }}
            onDone={dismiss}
          />
        )}
      </div>
    </div>
  )
}

function OfferStep({ onAdded, onSkip }: { onAdded: (it: VaultItem) => void; onSkip: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ProductModel[]>([])
  const [model, setModel] = useState<ProductModel | null>(null)
  const [busy, setBusy] = useState(false)

  async function search(text: string) {
    setQ(text); setModel(null)
    if (text.trim().length < 2) { setResults([]); return }
    try { setResults((await api.searchModels(text.trim(), 6)).content) } catch { setResults([]) }
  }

  async function add() {
    setBusy(true)
    try {
      const it = await api.addGear({ productModelId: model?.id ?? null, modelFreeText: model ? null : q.trim() || null })
      onAdded(it)
    } finally { setBusy(false) }
  }

  return (
    <>
      <span className="vault-intro__eyebrow">Gear Vault</span>
      <h2 className="vault-intro__title">See what your gear is worth</h2>
      <p className="vault-intro__lead">
        Add a camera or lens you own and we’ll value it from real TrueGlaz sales — then track its
        warranty and insure it, all in one place. No selling required.
      </p>
      <label className="vault__field">
        <span>Start with one item</span>
        <input className="tg-input" placeholder="e.g. Sony A7 III" value={model ? model.name : q}
          onChange={(e) => search(e.target.value)} autoFocus />
      </label>
      {!model && results.length > 0 && (
        <ul className="vault__results">
          {results.map((m) => (
            <li key={m.id}><button type="button" onClick={() => { setModel(m); setResults([]) }}>{m.name}</button></li>
          ))}
        </ul>
      )}
      <div className="vault__modal-actions">
        <button className="tg-button tg-button--ghost" onClick={onSkip}>Not now</button>
        <button className="tg-button tg-button--primary" disabled={busy || (!model && q.trim().length < 2)} onClick={add}>
          {busy ? 'Valuing…' : 'See its value'}
        </button>
      </div>
    </>
  )
}

function AddedStep({ item, onAddAnother, onGoToVault, onDone }: {
  item: VaultItem; onAddAnother: () => void; onGoToVault: () => void; onDone: () => void
}) {
  const v = item.valuation
  return (
    <>
      <span className="vault-intro__eyebrow">In your vault</span>
      <h2 className="vault-intro__title">{item.modelLabel}</h2>
      {v ? (
        <div className="vault-intro__value">
          <span className="vault-intro__amt">~{money(v.midMinor)}</span>
          <span className="vault-intro__range">
            {v.lowMinor !== v.highMinor ? `${money(v.lowMinor)}–${money(v.highMinor)}` : 'estimated'}
            {v.basis === 'msrp' && ' · indicative'}
          </span>
          <span className="vault-intro__fine">An estimate from our market — the real price is set at a free inspection.</span>
        </div>
      ) : (
        <p className="vault-intro__lead">Added. We’ll estimate its value as similar gear sells on TrueGlaz.</p>
      )}
      <div className="vault__modal-actions">
        <button className="tg-button tg-button--ghost" onClick={onAddAnother}>Add another</button>
        <button className="tg-button" onClick={onDone}>Done</button>
        <button className="tg-button tg-button--primary" onClick={onGoToVault}>Open my Vault</button>
      </div>
    </>
  )
}
