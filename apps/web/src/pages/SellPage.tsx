import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api, ApiError, dateOnly, money, useApi,
  type ConsignmentItem, type SellerApprovalView,
} from '@trueglaz/core'
import { Empty, ErrorNote, GradeBadge, Loading, StateBadge } from '../components/ui'
import { KycPanel } from '../components/KycPanel'
import './SellPage.css'

type Tab = 'items' | 'approvals' | 'payouts'

/**
 * The seller's side: what you've consigned, what needs your decision, and what
 * you've been paid. Approvals lead because they are the only thing here that
 * blocks money moving — an item sits unlisted until the seller answers.
 */
export function SellPage() {
  const [tab, setTab] = useState<Tab>('items')
  const approvals = useApi(() => api.myApprovals(), [])
  const kyc = useApi(() => api.myKyc(), [])
  const pending = (approvals.data ?? []).filter((a) => a.approval.decision === 'pending')

  const canSell = kyc.data?.canSell ?? false

  // Until identity clears there is nothing useful on this page, so the check is
  // the page. Showing tabs over an empty list would only invite a refusal later.
  if (!kyc.loading && !canSell) {
    return (
      <div className="sell">
        <h1 className="sell__title">Selling</h1>
        <KycPanel kyc={kyc} onChanged={() => { approvals.reload() }} />
      </div>
    )
  }

  return (
    <div className="sell">
      <header className="sell__head">
        <h1 className="sell__title">Selling</h1>
        <Link to="/sell/new" className="tg-button tg-button--primary">Consign an item</Link>
      </header>

      <KycPanel kyc={kyc} onChanged={() => { approvals.reload() }} />

      <nav className="sell__tabs" aria-label="Seller sections">
        <TabButton active={tab === 'items'} onClick={() => setTab('items')} label="My items" />
        <TabButton
          active={tab === 'approvals'}
          onClick={() => setTab('approvals')}
          label="Price approvals"
          badge={pending.length || undefined}
        />
        <TabButton active={tab === 'payouts'} onClick={() => setTab('payouts')} label="Payouts" />
      </nav>

      {tab === 'items' && <MyItems />}
      {tab === 'approvals' && <Approvals state={approvals} />}
      {tab === 'payouts' && <Payouts />}
    </div>
  )
}

function TabButton({
  active, onClick, label, badge,
}: { active: boolean; onClick: () => void; label: string; badge?: number }) {
  return (
    <button
      type="button"
      className={`sell__tab${active ? ' sell__tab--active' : ''}`}
      onClick={onClick}
    >
      {label}
      {badge ? <span className="tg-badge tg-badge--accent sell__tab-badge">{badge}</span> : null}
    </button>
  )
}

function MyItems() {
  const items = useApi(() => api.myItems(), [])
  const submissions = useApi(() => api.mySubmissions(), [])

  if (items.loading) return <Loading label="Loading your items" />
  if (items.error) return <ErrorNote error={items.error} onRetry={items.reload} />

  const rows = items.data ?? []
  const drafts = (submissions.data ?? []).filter((s) => s.state === 'draft')

  return (
    <>
      {drafts.length > 0 && (
        <div className="sell__drafts tg-card">
          <strong>You have {drafts.length} unfinished {drafts.length === 1 ? 'submission' : 'submissions'}.</strong>
          <ul className="sell__draft-list">
            {drafts.map((s) => (
              <li key={s.id}>
                <Link to={`/sell/${s.id}`}>Started {dateOnly(s.createdAt)} · {s.pricingMode} pricing</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty title="Nothing consigned yet" hint="Send us a lens or a body and we'll grade it, list it and pay you when it sells." />
      ) : (
        <div className="sell__list">
          {rows.map((i: ConsignmentItem) => (
            <Link key={i.id} to={`/items/${i.id}`} className="sell__row tg-card">
              <div className="sell__row-main">
                <span className="tg-mono">{i.internalSku}</span>
                <StateBadge state={i.currentState} />
                {i.assignedGradeCode && <GradeBadge code={i.assignedGradeCode} />}
              </div>
              <div className="sell__row-meta tg-muted">
                <span>Declared {i.declaredGradeCode}</span>
                <span>Asking {money(i.askingAmountMinor)}</span>
                {i.floorAmountMinor != null && <span>Floor {money(i.floorAmountMinor)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

function Approvals({ state }: { state: ReturnType<typeof useApi<SellerApprovalView[]>> }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [counter, setCounter] = useState<Record<string, string>>({})

  if (state.loading) return <Loading label="Loading approvals" />
  if (state.error) return <ErrorNote error={state.error} onRetry={state.reload} />

  const rows = (state.data ?? []).filter((a) => a.approval.decision === 'pending')
  if (rows.length === 0) {
    return <Empty title="Nothing waiting on you" hint="We only ask when a price lands below your floor, the grade came back lower than you declared, or you chose manual pricing." />
  }

  async function decide(id: string, decision: string, amount?: number) {
    setBusy(id); setError(null)
    try {
      await api.decideApproval(id, decision, amount ?? null)
      state.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record that')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="sell__list">
      {error && <p className="sell__error" role="alert">{error}</p>}
      {rows.map((a) => {
        const id = a.approval.id
        const typed = Number(counter[id] ?? '')
        const canCounter = a.approval.counterRound < 1
        return (
          <article key={id} className="sell__approval tg-card">
            <p className="sell__because">{a.requiredBecause}</p>

            <div className="sell__figures">
              <Figure label="We'd list it at" value={money(a.proposedAmountMinor)} strong />
              <Figure label="Our commission" value={money(a.commissionMinor)} />
              <Figure label="You'd receive" value={money(a.expectedNetMinor)} strong />
            </div>

            <p className="tg-muted sell__fineprint">
              You declared {a.declaredGradeCode}; we graded {a.assignedGradeCode ?? '—'}.
              These figures are locked in — changing our fee table later cannot alter them.
            </p>

            <div className="sell__decide">
              <button
                className="tg-button tg-button--primary"
                disabled={busy === id}
                onClick={() => decide(id, 'accepted')}
              >
                Accept and list
              </button>

              {canCounter && (
                <div className="sell__counter">
                  <input
                    className="tg-input sell__counter-input"
                    type="number"
                    min={1}
                    placeholder="Your price (₹)"
                    value={counter[id] ?? ''}
                    onChange={(e) => setCounter({ ...counter, [id]: e.target.value })}
                  />
                  <button
                    className="tg-button"
                    disabled={busy === id || !typed || typed <= 0}
                    onClick={() => decide(id, 'countered', Math.round(typed * 100))}
                  >
                    Counter once
                  </button>
                </div>
              )}

              <button
                className="tg-button sell__decline"
                disabled={busy === id}
                onClick={() => decide(id, 'declined')}
              >
                Decline
              </button>
            </div>
            {canCounter && (
              <p className="tg-muted sell__fineprint">
                You get one counter. Declining sends the item back to you.
              </p>
            )}
          </article>
        )
      })}
    </div>
  )
}

function Payouts() {
  const payouts = useApi(() => api.myPayouts(), [])
  const account = useApi(() => api.myPayoutAccount(), [])
  const [form, setForm] = useState({ method: 'upi', accountHolderName: '', upiVpa: '', accountNumber: '', ifsc: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(
    () => (payouts.data ?? []).filter((p) => p.state === 'paid').reduce((sum, p) => sum + p.netMinor, 0),
    [payouts.data],
  )

  async function save() {
    setBusy(true); setError(null)
    try {
      await api.addPayoutAccount({
        method: form.method,
        accountHolderName: form.accountHolderName,
        upiVpa: form.method === 'upi' ? form.upiVpa : null,
        accountNumber: form.method === 'bank' ? form.accountNumber : null,
        ifsc: form.method === 'bank' ? form.ifsc : null,
      })
      account.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sell__list">
      <section className="tg-card sell__panel">
        <h2 className="sell__panel-title">Where we send your money</h2>
        {account.loading && <Loading label="Loading" />}
        {account.data ? (
          <p className="sell__account">
            <strong>{account.data.method.toUpperCase()}</strong>
            {' · '}{account.data.upiVpa ?? account.data.accountNumberMasked ?? account.data.accountHolderName}
            {' · '}
            <span className={`tg-badge ${account.data.verificationState === 'verified' ? 'tg-badge--good' : 'tg-badge--warn'}`}>
              {account.data.verificationState}
            </span>
          </p>
        ) : (
          !account.loading && (
            <>
              <p className="tg-muted sell__fineprint">
                Payouts are held until an account is on file and verified.
              </p>
              <div className="sell__account-form">
                <select className="tg-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} aria-label="Payout method">
                  <option value="upi">UPI</option>
                  <option value="bank">Bank transfer</option>
                </select>
                <input className="tg-input" placeholder="Account holder name" value={form.accountHolderName} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} />
                {form.method === 'upi' ? (
                  <input className="tg-input" placeholder="UPI id" value={form.upiVpa} onChange={(e) => setForm({ ...form, upiVpa: e.target.value })} />
                ) : (
                  <>
                    <input className="tg-input" placeholder="Account number" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
                    <input className="tg-input" placeholder="IFSC" value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} />
                  </>
                )}
                <button className="tg-button tg-button--primary" disabled={busy || !form.accountHolderName} onClick={save}>
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
              {error && <p className="sell__error" role="alert">{error}</p>}
            </>
          )
        )}
      </section>

      <section className="tg-card sell__panel">
        <div className="sell__panel-head">
          <h2 className="sell__panel-title">Payouts</h2>
          {total > 0 && <span className="sell__paid-total">{money(total)} paid to date</span>}
        </div>
        {payouts.loading && <Loading label="Loading payouts" />}
        {payouts.error && <ErrorNote error={payouts.error} onRetry={payouts.reload} />}
        {payouts.data?.length === 0 && (
          <p className="tg-muted">Nothing yet. A payout appears when a buyer accepts delivery.</p>
        )}
        {(payouts.data ?? []).length > 0 && (
          <table className="sell__table">
            <thead>
              <tr><th>Gross</th><th>Net to you</th><th>State</th><th>Paid</th></tr>
            </thead>
            <tbody>
              {(payouts.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{money(p.grossMinor)}</td>
                  <td><strong>{money(p.netMinor)}</strong></td>
                  <td>
                    <span className={`tg-badge ${p.state === 'paid' ? 'tg-badge--good' : p.state === 'on_hold' ? 'tg-badge--warn' : ''}`}>
                      {p.state.replace(/_/g, ' ')}
                    </span>
                    {p.holdReasonCode && <span className="tg-muted"> {p.holdReasonCode.replace(/_/g, ' ')}</span>}
                  </td>
                  <td className="tg-muted">{p.paidAt ? dateOnly(p.paidAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="sell__figure">
      <span className="sell__figure-label tg-muted">{label}</span>
      <span className={`sell__figure-value${strong ? ' sell__figure-value--strong' : ''}`}>{value}</span>
    </div>
  )
}
