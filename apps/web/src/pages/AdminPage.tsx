import { useMemo, useState } from 'react'
import { api, ApiError, dateOnly, dateTime, money, useApi, type InventoryRow, type PlatformSetting } from '@trueglaz/core'
import { InventoryTable } from '../components/InventoryTable'
import { Empty, ErrorNote, Loading } from '../components/ui'
import { KycDocuments } from '../components/KycDocuments'
import './AdminPage.css'
import './OpsPage.css'

const REJECT_REASONS = [
  { code: 'details_unclear', label: 'Document details unclear' },
  { code: 'name_mismatch', label: 'Name does not match the document' },
  { code: 'document_expired', label: 'Document has expired' },
  { code: 'suspected_forgery', label: 'Suspected forgery' },
]

/**
 * The admin dashboard.
 *
 * Every other queue in the app answers one question for one role — what to
 * inspect, what to price, what to pack. This answers the one nobody else is
 * asked: what does the platform have, all of it, and what is each unit doing.
 *
 * Two halves. The inventory is the whole shelf, filterable by any column and
 * openable to the entire record of a unit. The books are underneath it, because
 * reconciliation is the number that says whether any of the rest can be
 * believed — escrow should hold exactly what has been paid for and not yet
 * accepted, and nothing else.
 */
export function AdminPage() {
  const inventory = useApi(() => api.inventory(), [])
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
    <div className="ops admin">
      <h1 className="ops__title">Dashboard</h1>
      {error && <p className="ops__error" role="alert">{error}</p>}

      <Widgets inventory={inventory.data} recon={recon.data} />

      <section className="tg-card ops__card">
        <h2 className="ops__subtitle">Inventory</h2>
        <p className="tg-muted ops__fineprint">
          Every unit the platform has ever taken in. Filter on any column, or open a row
          for everything known about that one.
        </p>
        {inventory.loading && <Loading label="Loading inventory" />}
        {inventory.error && <ErrorNote error={inventory.error} onRetry={inventory.reload} />}
        {inventory.data && <InventoryTable rows={inventory.data} />}
      </section>

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

      <Settings />

      <LedgerFeed />
    </div>
  )
}

/**
 * The numbers worth knowing before scrolling.
 *
 * Counted from the inventory rather than asked for separately, so a tile and
 * the table beneath it can never disagree — a dashboard whose headline says
 * eleven above a list of nine is worse than no headline.
 */
function Widgets({ inventory, recon }: {
  inventory: InventoryRow[] | null
  recon: { escrow_liability_held: number; seller_payable_total: number } | null
}) {
  const w = useMemo(() => {
    const rows = inventory ?? []
    const inState = (...states: string[]) => rows.filter((r) => states.includes(r.currentState))

    const onSale = inState('LISTED', 'RESERVED')
    const inCustody = inState('RECEIVED', 'IN_INSPECTION', 'GRADED', 'PRICE_PROPOSED', 'AWAITING_SELLER_APPROVAL', 'LISTED', 'RESERVED', 'UNSOLD_REVIEW')
    const inbound = inState('SUBMITTED', 'PRE_APPROVED', 'IN_TRANSIT_INBOUND')
    const sold = inState('SOLD', 'DISPATCHED', 'DELIVERED', 'ACCEPTED', 'ARCHIVED')

    // What an admin has to act on personally, as opposed to merely watch.
    const attention = rows.filter((r) =>
      r.currentState === 'QUARANTINED' ||
      r.currentState === 'AWAITING_SELLER_APPROVAL' ||
      r.currentState === 'RETURN_REQUESTED' ||
      r.currentState === 'INSPECTION_FAILED' ||
      r.payoutState === 'pending' || r.payoutState === 'on_hold')

    const sum = (xs: InventoryRow[], f: (r: InventoryRow) => number | null) =>
      xs.reduce((t, r) => t + (f(r) ?? 0), 0)

    return {
      total: rows.length,
      onSale: onSale.length,
      onSaleValue: sum(onSale, (r) => r.listingPriceMinor ?? r.askingAmountMinor),
      inCustody: inCustody.length,
      inbound: inbound.length,
      sold: sold.length,
      soldValue: sum(sold, (r) => r.listingPriceMinor),
      attention: attention.length,
    }
  }, [inventory])

  return (
    <div className="admin__widgets">
      <Widget label="Units, all time" value={String(w.total)} note={`${w.inbound} on their way in`} />
      <Widget label="On sale now" value={String(w.onSale)} note={money(w.onSaleValue)} />
      <Widget label="In our custody" value={String(w.inCustody)} note="received, graded or listed" />
      <Widget label="Sold" value={String(w.sold)} note={money(w.soldValue)} />
      <Widget
        label="Needs a decision"
        value={String(w.attention)}
        note="quarantine, approvals, returns, payouts"
        tone={w.attention > 0 ? 'warn' : undefined}
      />
      <Widget label="Held in escrow" value={recon ? money(recon.escrow_liability_held) : '—'} note="paid for, not yet accepted" />
      <Widget label="Owed to sellers" value={recon ? money(recon.seller_payable_total) : '—'} note="after commission" />
    </div>
  )
}

function Widget({ label, value, note, tone }: {
  label: string; value: string; note?: string; tone?: 'warn'
}) {
  return (
    <div className={`admin__widget${tone ? ` admin__widget--${tone}` : ''}`}>
      <span className="admin__widget-label">{label}</span>
      <strong className="admin__widget-value">{value}</strong>
      {note && <span className="admin__widget-note tg-muted">{note}</span>}
    </div>
  )
}

/* -- platform settings ----------------------------------------------------- */

/** Which keys are worth putting at the top of the list. */
const SETTING_ORDER = ['referral_bonus_points', 'commission_gst_percent', 'reservation_timeout_minutes']

/**
 * The numbers the platform runs on, editable here.
 *
 * Not a free-form key/value editor: the server validates each value against
 * that row's own type and bounds and refuses a key that does not already
 * exist, because nothing reads a setting it was not written to read. Every
 * change is recorded with who made it.
 */
function Settings() {
  const rows = useApi(() => api.adminSettings(), [])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save(row: PlatformSetting) {
    const next = (drafts[row.key] ?? row.value).trim()
    if (next === row.value) return
    setBusy(row.key); setError(null); setSaved(null)
    try {
      await api.setSetting(row.key, next)
      setDrafts((d) => { const { [row.key]: _drop, ...rest } = d; return rest })
      setSaved(row.key)
      rows.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(null) }
  }

  const all = rows.data ?? []
  const sorted = [...all].sort((a, b) => {
    const ia = SETTING_ORDER.indexOf(a.key)
    const ib = SETTING_ORDER.indexOf(b.key)
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    return a.key.localeCompare(b.key)
  })

  return (
    <section className="tg-card ops__card">
      <h2 className="ops__subtitle">Platform settings</h2>
      <p className="tg-muted ops__fineprint">
        These take effect on the next read — no deploy. Each one is checked against
        its own bounds before it is stored, and every change is recorded.
      </p>

      {rows.loading && !rows.data && <Loading label="Loading settings" />}
      {error && <p className="ops__error" role="alert">{error}</p>}

      {sorted.length > 0 && (
        <table className="admin__settings">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Value</th>
              <th>Allowed</th>
              <th>Last changed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const draft = drafts[row.key] ?? row.value
              const dirty = draft.trim() !== row.value
              return (
                <tr key={row.key}>
                  <td>
                    <strong>{row.key}</strong>
                    <p className="tg-muted ops__fineprint admin__setting-desc">{row.description}</p>
                  </td>
                  <td>
                    <input
                      className="tg-input admin__setting-input"
                      value={draft}
                      aria-label={row.key}
                      onChange={(e) => setDrafts({ ...drafts, [row.key]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(row) } }}
                    />
                  </td>
                  <td className="tg-muted">
                    {row.valueType}
                    {(row.minValue != null || row.maxValue != null) &&
                      ` · ${row.minValue ?? '−∞'} to ${row.maxValue ?? '∞'}`}
                  </td>
                  <td className="tg-muted">{row.updatedAt ? dateTime(row.updatedAt) : '—'}</td>
                  <td>
                    <button
                      className="tg-button tg-button--primary"
                      disabled={!dirty || busy === row.key}
                      onClick={() => save(row)}
                    >
                      {busy === row.key ? 'Saving…' : 'Save'}
                    </button>
                    {saved === row.key && !dirty && <span className="admin__setting-ok">Saved</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
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
/**
 * The documents for one check, fetched when the queue draws it.
 *
 * Per row rather than with the queue: the links are short-lived signed URLs to
 * the private bucket, so fetching them all up front would mint a set that
 * expires while somebody works through the list.
 */
function KycDocsFor({ userId }: { userId: string }) {
  const docs = useApi(() => api.kycDocuments(userId), [userId])
  if (docs.loading) return null
  if (docs.error) return <ErrorNote error={docs.error} onRetry={docs.reload} />
  return <KycDocuments docs={docs.data ?? []} />
}

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
        A seller cannot consign anything until this passes. Open the documents and
        check the name on them against the name typed here — reject anything that does
        not read cleanly rather than guessing. Only the last four digits of the number
        are kept, so the document is the only thing you can check the rest against.
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
              {' · '}
              {k.documentCount} document{k.documentCount === 1 ? '' : 's'}
            </div>

            <KycDocsFor userId={k.userId} />
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
