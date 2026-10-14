import { useState } from 'react'
import { api, ApiError, money, type SellerApprovalView } from '@trueglaz/core'
import './SellerPriceDecision.css'

/**
 * The seller's call on a proposed price: accept and list, counter once, or
 * decline and take it back.
 *
 * One component, used both on the Selling page's approvals tab and on the item
 * itself — because the price-proposed notification links to the item, and a
 * seller who lands there must be able to answer right where they are, not be
 * told there is nothing for them to do and sent looking for the right screen.
 */
export function SellerPriceDecision({ a, onDone }: { a: SellerApprovalView; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [counter, setCounter] = useState('')

  const id = a.approval.id
  const typed = Number(counter)
  const canCounter = a.approval.counterRound < 1

  async function decide(decision: string, amount?: number) {
    setBusy(true); setError(null)
    try {
      await api.decideApproval(id, decision, amount ?? null)
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record that')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="spd tg-card">
      <p className="spd__because">{a.requiredBecause}</p>

      <div className="spd__figures">
        <Figure label="We'd list it at" value={money(a.proposedAmountMinor)} strong />
        <Figure label="Our commission" value={money(a.commissionMinor)} />
        <Figure label="You'd receive" value={money(a.expectedNetMinor)} strong />
      </div>

      <p className="tg-muted spd__fineprint">
        You declared {a.declaredGradeCode}; we graded {a.assignedGradeCode ?? '—'}.
        These figures are locked in — changing our fee table later cannot alter them.
      </p>

      {error && <p className="spd__error" role="alert">{error}</p>}

      <div className="spd__decide">
        <button className="tg-button tg-button--primary" disabled={busy} onClick={() => decide('accepted')}>
          Accept and list
        </button>

        {canCounter && (
          <div className="spd__counter">
            <input
              className="tg-input spd__counter-input"
              type="number"
              min={1}
              placeholder="Your price (₹)"
              value={counter}
              onChange={(e) => setCounter(e.target.value)}
            />
            <button
              className="tg-button"
              disabled={busy || !typed || typed <= 0}
              onClick={() => decide('countered', Math.round(typed * 100))}
            >
              Counter once
            </button>
          </div>
        )}

        <button className="tg-button spd__decline" disabled={busy} onClick={() => decide('declined')}>
          Decline
        </button>
      </div>

      {canCounter && (
        <p className="tg-muted spd__fineprint">
          You get one counter. Declining sends the item back to you.
        </p>
      )}
    </article>
  )
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="spd__figure">
      <span className="spd__figure-label tg-muted">{label}</span>
      <span className={strong ? 'spd__figure-value spd__figure-value--strong' : 'spd__figure-value'}>{value}</span>
    </div>
  )
}
