import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api, ApiError, dateOnly, money, useApi, HAPPY_PATH, STATE_LABELS,
  type SellerApprovalView,
} from '@trueglaz/core'
import { GearPhoto, photoKindFor } from '../components/GearPhoto'
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

  return (
    <div className="sell">
      <aside className="sell__sidebar">
        <div className="sell__aside-card tg-card">
          <h1 className="sell__title">Selling</h1>
          <p className="tg-muted sell__blurb">
            Track what you’ve consigned, answer price approvals, and follow payouts from one place.
          </p>
          <Link to="/sell/new" className="tg-button tg-button--primary sell__cta">
            Consign an item
          </Link>
        </div>

        <div className="sell__aside-card tg-card">
          <h2 className="sell__aside-title">Identity check</h2>
          <p className="tg-muted sell__blurb">
            You need to be verified before you can consign anything or reach seller tools.
          </p>
          <KycPanel kyc={kyc} onChanged={() => { approvals.reload() }} />
        </div>
      </aside>

      <section className="sell__main" aria-label="Seller sections">
        <div className="sell__head">
          <div>
            <p className="sell__eyebrow tg-muted">Your selling workspace</p>
            <h2 className="sell__main-title">Manage inventory, approvals, and payouts</h2>
          </div>
          {!canSell && !kyc.loading && (
            <p className="sell__notice tg-muted">
              Finish identity verification to unlock consignments and approvals.
            </p>
          )}
        </div>

        {/* The one thing a seller cannot work out for themselves is what anybody
            actually wants, so the board is offered before the tabs. */}
        <p className="sell__wanted tg-muted">
          Not sure what to send in? <Link to="/wanted">See what buyers are asking for</Link> —
          every one of them is somebody waiting.
        </p>

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

        {!canSell && !kyc.loading ? (
          <div className="tg-card sell__locked">
            <h3 className="sell__panel-title">Selling is locked</h3>
            <p className="tg-muted sell__blurb">
              Complete the identity check on the left to unlock your items, approvals, and payouts.
            </p>
          </div>
        ) : (
          <>
            {tab === 'items' && <MyItems />}
            {tab === 'approvals' && <Approvals state={approvals} />}
            {tab === 'payouts' && <Payouts />}
          </>
        )}
      </section>
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
  const models = useApi(() => api.models(), [])
  const categories = useApi(() => api.categories(), [])
  const submissions = useApi(() => api.mySubmissions(), [])
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [status, setStatus] = useState<string | 'all'>('all')

  const rows = items.data ?? []
  const drafts = (submissions.data ?? []).filter((s) => s.state === 'draft')
  const byStatus = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of rows) counts.set(item.currentState, (counts.get(item.currentState) ?? 0) + 1)
    return counts
  }, [rows])
  const statuses = useMemo(() => {
    const extras = [...byStatus.keys()].filter((s) => !HAPPY_PATH.includes(s as never))
    return [...HAPPY_PATH, ...extras.sort()]
  }, [byStatus])
  const modelById = useMemo(
    () => new Map((models.data?.content ?? []).map((m) => [m.id, m])),
    [models.data],
  )
  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  )
  const sortedRows = useMemo(() => {
    const list = [...rows].sort((a, b) => {
      const left = new Date(a.listedAt ?? a.createdAt).getTime()
      const right = new Date(b.listedAt ?? b.createdAt).getTime()
      return sort === 'newest' ? right - left : left - right
    })
    return list.map((item) => {
      const model = item.productModelId ? modelById.get(item.productModelId) ?? null : null
      const category = model?.categoryId ? categoryById.get(model.categoryId) ?? null : null
      return {
        item,
        model,
        category,
        title: model?.name ?? item.modelFreeText ?? item.internalSku,
        kind: photoKindFor(category?.name),
      }
    })
  }, [rows, sort, modelById, categoryById])
  const visibleRows = useMemo(
    () => sortedRows.filter(({ item }) => status === 'all' || item.currentState === status),
    [sortedRows, status],
  )

  if (items.loading) return <Loading label="Loading your items" />
  if (items.error) return <ErrorNote error={items.error} onRetry={items.reload} />

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

      <div className="sell__items-toolbar">
        <p className="tg-muted sell__items-count">
          {visibleRows.length} {visibleRows.length === 1 ? 'item' : 'items'}
        </p>
        <label className="sell__sort">
          <span className="tg-muted">Status</span>
          <select className="tg-select" value={status} onChange={(e) => setStatus(e.target.value as string | 'all')}>
            <option value="all">All statuses ({rows.length})</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {STATE_LABELS[s] ?? s} ({byStatus.get(s) ?? 0})
              </option>
            ))}
          </select>
        </label>
        <label className="sell__sort">
          <span className="tg-muted">Sort by</span>
          <select className="tg-select" value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <Empty title="Nothing consigned yet" hint="Send us a lens or a body and we'll grade it, list it and pay you when it sells." />
      ) : visibleRows.length === 0 ? (
        <Empty title="Nothing matches that status" hint="Try a different status or switch back to All statuses." />
      ) : (
        <div className="sell__widgets">
          {visibleRows.map(({ item, title, kind, category }) => (
            <Link key={item.id} to={`/items/${item.id}`} className="sell__widget tg-card">
              <div className="sell__widget-image">
                <GearPhoto kind={kind} size="thumb" alt={title} />
              </div>
              <div className="sell__widget-content">
                <div className="sell__widget-header">
                  <strong className="sell__widget-title">{title}</strong>
                  <div className="sell__widget-badges">
                    <StateBadge state={item.currentState} />
                    {item.assignedGradeCode && <GradeBadge code={item.assignedGradeCode} />}
                  </div>
                </div>
                <p className="tg-muted sell__widget-meta">
                  <span className="tg-mono">{item.internalSku}</span>
                  {category && <span>{category.name}</span>}
                </p>
              </div>
              <div className="sell__widget-footer">
                <div className="sell__widget-prices">
                  <div className="sell__widget-price-item">
                    <span className="tg-muted">Declared</span>
                    <strong>{item.declaredGradeCode}</strong>
                  </div>
                  <div className="sell__widget-price-item">
                    <span className="tg-muted">Asking</span>
                    <strong>{money(item.askingAmountMinor)}</strong>
                  </div>
                  {item.floorAmountMinor != null && (
                    <div className="sell__widget-price-item">
                      <span className="tg-muted">Floor</span>
                      <strong>{money(item.floorAmountMinor)}</strong>
                    </div>
                  )}
                </div>
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
    <div className="sell__section">
      <div className="sell__section-bar">
        <div>
          <p className="sell__eyebrow tg-muted">Pending decisions</p>
          <h3 className="sell__section-title">Price approvals</h3>
        </div>
        <p className="tg-muted sell__section-note">
          {rows.length} {rows.length === 1 ? 'item' : 'items'} waiting on you
        </p>
      </div>

      {error && <p className="sell__error" role="alert">{error}</p>}
      <div className="sell__list">
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
    </div>
  )
}

function Payouts() {
  const payouts = useApi(() => api.myPayouts(), [])
  const account = useApi(() => api.myPayoutAccount(), [])

  const total = useMemo(
    () => (payouts.data ?? []).filter((p) => p.state === 'paid').reduce((sum, p) => sum + p.netMinor, 0),
    [payouts.data],
  )

  return (
    <div className="sell__section">
      <div className="sell__section-bar">
        <div>
          <p className="sell__eyebrow tg-muted">Money</p>
          <h3 className="sell__section-title">Payouts</h3>
        </div>
        <p className="tg-muted sell__section-note">
          {payouts.data?.length ?? 0} {((payouts.data?.length ?? 0) === 1 ? 'payout' : 'payouts')}
          {total > 0 && ` · ${money(total)} paid to date`}
        </p>
      </div>

      <div className="sell__list">
      <section className="tg-card sell__panel">
        <h2 className="sell__panel-title">Where we send your money</h2>
        {account.loading && <Loading label="Loading" />}
        {account.data ? (
          <p className="sell__account">
            <strong>{account.data.method.toUpperCase()}</strong>
            {' · '}
            {account.data.upiVpa ?? (account.data.accountLast4 ? `account ending ${account.data.accountLast4}` : account.data.accountHolderName)}
            {' · '}
            <span className={`tg-badge ${account.data.verificationState === 'verified' ? 'tg-badge--good' : 'tg-badge--warn'}`}>
              {account.data.verificationState}
            </span>
            {' '}
            <Link to="/profile#bank">Change</Link>
          </p>
        ) : (
          !account.loading && (
            <p className="tg-muted sell__fineprint">
              Payouts are held until an account is on file and verified.{' '}
              <Link to="/profile#bank">Add your bank or UPI details</Link> — it takes a code
              sent to your email, because nobody should be able to redirect your money
              with a stolen session alone.
            </p>
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
