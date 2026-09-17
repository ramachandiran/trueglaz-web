import { useState } from 'react'
import { api, ApiError, dateOnly, dateTime, money, useApi } from '@trueglaz/core'
import { Empty, ErrorNote, Loading } from '../components/ui'
import './OpsPage.css'

const REJECT_REASONS = [
  { code: 'details_unclear', label: 'Document details unclear' },
  { code: 'name_mismatch', label: 'Name does not match the document' },
  { code: 'document_expired', label: 'Document has expired' },
  { code: 'suspected_forgery', label: 'Suspected forgery' },
]

/**
 * Money: the payout queue and the books.
 *
 * Reconciliation is the headline because it is the one number that says whether
 * the ledger still adds up — escrow should hold exactly what has been paid for
 * but not yet accepted, and nothing else.
 */
export function AdminPage() {
  const recon = useApi(() => api.reconciliation(), [])
  const pending = useApi(() => api.payoutQueue('pending'), [])
  const onHold = useApi(() => api.payoutQueue('on_hold'), [])
  const approved = useApi(() => api.payoutQueue('approved'), [])
  const accounts = useApi(() => api.ledgerAccounts(), [])

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setError(null)
    try {
      await fn()
      pending.reload(); onHold.reload(); approved.reload(); recon.reload(); accounts.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(null) }
  }

  return (
    <div className="ops">
      <h1 className="ops__title">Money</h1>
      {error && <p className="ops__error" role="alert">{error}</p>}

      <section className="tg-card ops__card">
        <h2 className="ops__subtitle">Escrow reconciliation</h2>
        <p className="tg-muted ops__fineprint">
          Balances are summed from the ledger at read time — there is no balance
          column anywhere, which is what makes this answerable at all.
        </p>
        {recon.loading && <Loading label="Loading" />}
        {recon.error && <ErrorNote error={recon.error} onRetry={recon.reload} />}
        {recon.data && (
          <div className="ops__recon">
            <Stat label="Held in escrow" value={money(recon.data.escrow_liability_held)} highlight />
            <Stat label="Owed to sellers" value={money(recon.data.seller_payable_total)} />
            <Stat label="Bank" value={money(recon.data.bank)} />
            <Stat label="Gateway clearing" value={money(recon.data.gateway_clearing)} />
            <Stat label="Commission" value={money(recon.data.commission_revenue)} />
            <Stat label="Shipping" value={money(recon.data.shipping_revenue)} />
            <Stat label="Processing cost" value={money(recon.data.payment_processing_expense)} />
          </div>
        )}
      </section>

      <PayoutSection
        title="On hold"
        blurb="Held because the seller has no verified payout account."
        state={onHold}
        busy={busy}
        render={(p) => (
          <button className="tg-button" disabled={busy === p.id} onClick={() => act(p.id, () => api.approvePayout(p.id))}>
            Approve anyway
          </button>
        )}
      />

      <PayoutSection
        title="Waiting on approval"
        blurb="Above the auto-release threshold, so a human signs them off."
        state={pending}
        busy={busy}
        render={(p) => (
          <button className="tg-button tg-button--primary" disabled={busy === p.id} onClick={() => act(p.id, () => api.approvePayout(p.id))}>
            Approve
          </button>
        )}
      />

      <PayoutSection
        title="Approved — ready to transfer"
        blurb="Paying marks the transfer and clears the seller's balance."
        state={approved}
        busy={busy}
        render={(p) => (
          <button
            className="tg-button tg-button--primary"
            disabled={busy === p.id}
            onClick={() => act(p.id, () => api.payPayout(p.id, `utr_${p.id.slice(0, 8)}`))}
          >
            Mark transferred
          </button>
        )}
      />

      <KycQueue />

      <LedgerFeed />
    </div>
  )
}

function PayoutSection({
  title, blurb, state, busy, render,
}: {
  title: string; blurb: string
  state: ReturnType<typeof useApi<any>>
  busy: string | null
  render: (p: any) => React.ReactNode
}) {
  if (state.loading) return null
  const rows = state.data ?? []
  if (rows.length === 0) return null
  return (
    <section className="tg-card ops__card">
      <h2 className="ops__subtitle">{title} ({rows.length})</h2>
      <p className="tg-muted ops__fineprint">{blurb}</p>
      {rows.map((p: any) => (
        <div key={p.id} className="ops__inbound">
          <div>
            <span className="tg-mono">{p.id.slice(0, 8)}</span>
            <span className="tg-muted"> gross {money(p.grossMinor)} · </span>
            <strong>net {money(p.netMinor)}</strong>
            {p.holdReasonCode && <span className="tg-badge tg-badge--warn">{p.holdReasonCode.replace(/_/g, ' ')}</span>}
          </div>
          <span aria-busy={busy === p.id}>{render(p)}</span>
        </div>
      ))}
    </section>
  )
}

function LedgerFeed() {
  const txns = useApi(() => api.ledgerTransactions(25), [])
  if (txns.loading) return null
  if (txns.error) return <ErrorNote error={txns.error} onRetry={txns.reload} />
  const rows = txns.data ?? []
  if (rows.length === 0) return <Empty title="No money has moved yet" />

  return (
    <section className="tg-card ops__card">
      <h2 className="ops__subtitle">Recent money events</h2>
      <p className="tg-muted ops__fineprint">
        Every event balances: debits equal credits, checked by the database at commit.
      </p>
      <div className="ops__txns">
        {rows.map((t) => {
          const debits = t.entries.filter((e) => e.direction === 'debit').reduce((s, e) => s + e.amountMinor, 0)
          const credits = t.entries.filter((e) => e.direction === 'credit').reduce((s, e) => s + e.amountMinor, 0)
          return (
            <details key={t.transaction.id} className="ops__txn">
              <summary>
                <span className="tg-badge tg-badge--accent">{t.transaction.kind}</span>
                <span className="ops__txn-desc">{t.transaction.description}</span>
                <span className={`tg-badge ${debits === credits ? 'tg-badge--good' : 'tg-badge--bad'}`}>
                  {debits === credits ? 'balanced' : 'UNBALANCED'}
                </span>
              </summary>
              <table className="sell__table">
                <thead><tr><th>Account</th><th>Direction</th><th>Amount</th></tr></thead>
                <tbody>
                  {t.entries.map((e, i) => (
                    <tr key={i}>
                      <td className="tg-mono">{e.accountCode}</td>
                      <td>{e.direction}</td>
                      <td>{money(e.amountMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {t.transaction.createdAt && <p className="tg-muted ops__fineprint">{dateTime(t.transaction.createdAt)}</p>}
            </details>
          )
        })}
      </div>
    </section>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`ops__stat${highlight ? ' ops__stat--highlight' : ''}`}>
      <span className="ops__stat-label">{label}</span>
      <span className="ops__stat-value">{value}</span>
    </div>
  )
}

/**
 * The identity checks waiting on a human.
 *
 * Nothing about a seller's gear moves until this clears — TrueGlaz takes custody
 * of a stranger's property and later wires them money — so the queue sits with
 * the money, where the person who signs off payouts already works.
 */
function KycQueue() {
  const queue = useApi(() => api.kycQueue(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function act(userId: string, fn: () => Promise<unknown>) {
    setBusy(userId); setError(null)
    try {
      await fn()
      setRejecting(null); setReason('')
      queue.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(null) }
  }

  if (queue.loading) return null
  if (queue.error) return <ErrorNote error={queue.error} onRetry={queue.reload} />
  const rows = queue.data ?? []

  return (
    <section className="tg-card ops__card">
      <h2 className="ops__subtitle">Identity checks ({rows.length})</h2>
      <p className="tg-muted ops__fineprint">
        A seller cannot consign anything until this passes. Only the last four digits of
        the document are kept — check the name and type, and reject anything that does
        not read cleanly rather than guessing.
      </p>

      {error && <p className="ops__error" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <p className="tg-muted">Nothing waiting. Every submitted check has been decided.</p>
      ) : rows.map((k) => (
        <div key={k.userId} className="ops__inbound">
          <div>
            <strong>{k.legalName ?? k.displayName}</strong>
            <span className="tg-muted">
              {' '}· {k.displayName}{k.email ? ` · ${k.email}` : ''}
            </span>
            <div className="tg-muted ops__fineprint">
              {k.idType?.toUpperCase() ?? '—'} ending {k.idLast4 ?? '????'}
              {k.gstin && ` · GSTIN ${k.gstin}`}
              {k.submittedAt && ` · submitted ${dateOnly(k.submittedAt)}`}
            </div>
          </div>

          {rejecting === k.userId ? (
            <span className="ops__inbound-actions">
              <select className="tg-select" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
                <option value="">Pick a reason…</option>
                {REJECT_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
              <button
                className="tg-button"
                disabled={!reason || busy === k.userId}
                onClick={() => act(k.userId, () => api.rejectKyc(k.userId, reason))}
              >
                Confirm rejection
              </button>
              <button className="tg-button" onClick={() => { setRejecting(null); setReason('') }}>Cancel</button>
            </span>
          ) : (
            <span className="ops__inbound-actions" aria-busy={busy === k.userId}>
              <button
                className="tg-button tg-button--primary"
                disabled={busy === k.userId}
                onClick={() => act(k.userId, () => api.verifyKyc(k.userId))}
              >
                Verify
              </button>
              <button className="tg-button" disabled={busy === k.userId} onClick={() => setRejecting(k.userId)}>
                Reject
              </button>
            </span>
          )}
        </div>
      ))}
    </section>
  )
}
