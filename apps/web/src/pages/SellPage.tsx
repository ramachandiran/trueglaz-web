import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  api, ApiError, dateOnly, money, useApi, HAPPY_PATH, STATE_LABELS,
  type SellerApprovalView, type KycStatus,
} from '@trueglaz/core'
import { photoKindFor } from '../components/GearPhoto'
import { Empty, ErrorNote, GradeBadge, Loading, StateBadge } from '../components/ui'
import { KycPanel } from '../components/KycPanel'
import { SellerPriceDecision } from '../components/SellerPriceDecision'
import './SellPage.css'
import { ModelPhoto } from '../components/ModelPhoto'

type Tab = 'items' | 'approvals' | 'payouts'

/**
 * The seller's side: what you've consigned, what needs your decision, and what
 * you've been paid. Approvals lead because they are the only thing here that
 * blocks money moving — an item sits unlisted until the seller answers.
 */
type Phase = 'loading' | 'open' | 'identity' | 'awaiting' | 'declined'

export function SellPage() {
  const [searchParams] = useSearchParams()
  const asked = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>(asked === 'approvals' || asked === 'payouts' ? asked : 'items')
  const approvals = useApi(() => api.myApprovals(), [])
  const kyc = useApi(() => api.myKyc(), [])
  // The authoritative selling state (approved / pending_review / rejected /
  // not_requested) lives here, not on the KYC record — it is what separates
  // "verified, waiting on us" from "not verified yet".
  const home = useApi(() => api.sellerHome(), [])
  const pending = (approvals.data ?? []).filter((a) => a.approval.decision === 'pending')
  const submitted = searchParams.get('submitted') === 'true'

  // Decided once we know the answer. Read from `data`, not `loading`: useApi
  // keeps `data` across a reload but flips `loading`, and gating on it
  // unmounted the KYC panel every time a photograph finished uploading —
  // taking the half-filled form with it.
  const kycLoaded = kyc.data !== null || !kyc.loading
  const canSell = kyc.data?.canSell ?? false
  const verified = kyc.data?.status === 'verified'
  const sellingState = home.data?.status.sellingState

  // Three gated states, not one. A verified seller waiting on our approval must
  // not be told to "complete the identity check" — they already did; the hold
  // is on us. Only an unverified seller sees the document form.
  const phase: Phase =
    !kycLoaded ? 'loading'
      : canSell ? 'open'
        : verified ? (sellingState === 'rejected' ? 'declined' : 'awaiting')
          : 'identity'

  if (phase === 'open') {
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
            <KycPanel kyc={kyc} onChanged={() => { approvals.reload() }} />
          </div>
        </aside>

        <section className="sell__main" aria-label="Seller sections">
          <div className="sell__head">
            <div>
              <Link to="/sell" className="tg-muted">← Back to your home</Link>
              <p className="sell__eyebrow tg-muted">Your selling workspace</p>
              <h2 className="sell__main-title">Manage inventory, approvals, and payouts</h2>
            </div>
          </div>

          {submitted && (
            <div className="tg-card sell__success">
              <p className="sell__success-text">✓ Item submitted and waiting for approval</p>
            </div>
          )}

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

          {tab === 'items' && <MyItems />}
          {tab === 'approvals' && <Approvals state={approvals} />}
          {tab === 'payouts' && <Payouts />}
        </section>
      </div>
    )
  }

  return <SellGate phase={phase} kyc={kyc} legalName={kyc.data?.legalName ?? null} rejectedReason={kyc.data?.rejectedReasonCode ?? null} onChanged={() => { approvals.reload(); home.reload() }} />
}

/**
 * The pre-workspace experience: a single centered column that says exactly where
 * the seller is in getting switched on — verify, wait on us, or (rarely) a
 * decline — with a four-step tracker so the hold never feels like a dead end.
 */
function SellGate({
  phase, kyc, legalName, rejectedReason, onChanged,
}: {
  phase: Phase
  kyc: ReturnType<typeof useApi<KycStatus>>
  legalName: string | null
  rejectedReason: string | null
  onChanged: () => void
}) {
  if (phase === 'loading') {
    return <div className="sell sell--gate"><div className="sellgate"><Loading label="Loading your selling status" /></div></div>
  }

  const steps = [
    { key: 'verify', label: 'Verify identity' },
    { key: 'review', label: 'TrueGlaz reviews' },
    { key: 'consign', label: 'Consign your gear' },
    { key: 'paid', label: 'Get paid when it sells' },
  ]
  const activeIndex = phase === 'identity' ? 0 : 1 // declined also sits at step 2

  return (
    <div className="sell sell--gate">
      <div className="sellgate">
        <div className="tg-card sellgate__hero">
          {phase === 'identity' && (
            <>
              <span className="tg-badge tg-badge--accent sellgate__badge">Step 1 of 2 to start selling</span>
              <h1 className="sellgate__title">Verify your identity to start selling</h1>
              <p className="tg-muted sellgate__lede">
                We take custody of your gear and send you the money when it sells, so we confirm who we’re dealing with first.
                We keep only the last four digits of your document afterwards.
              </p>
              <div className="sellgate__panel">
                <KycPanel kyc={kyc} onChanged={onChanged} />
              </div>
            </>
          )}

          {phase === 'awaiting' && (
            <>
              <span className="tg-badge tg-badge--warn sellgate__badge">Awaiting approval</span>
              <h1 className="sellgate__title">You’re verified — waiting for TrueGlaz to approve your selling account</h1>
              <p className="tg-muted sellgate__lede">
                Your identity check passed{legalName ? <> as <strong>{legalName}</strong></> : null}. Our team is reviewing your
                account to switch on selling. This is usually done within a day, and we’ll email you the moment it’s approved —
                you don’t need to do anything else.
              </p>
              <div className="sellgate__reassure">
                <span>✓ Identity verified</span>
                <span className="sellgate__dot">·</span>
                <span>⏳ Selling approval in progress</span>
              </div>
            </>
          )}

          {phase === 'declined' && (
            <>
              <span className="tg-badge tg-badge--bad sellgate__badge">Not approved</span>
              <h1 className="sellgate__title">Your selling account wasn’t approved</h1>
              <p className="tg-muted sellgate__lede">
                Your identity is verified, but we weren’t able to enable selling on your account
                {rejectedReason ? <> (<code>{rejectedReason}</code>)</> : null}. If you think this is a mistake, contact us and
                we’ll take another look. You can still buy on TrueGlaz in the meantime.
              </p>
              <Link to="/" className="tg-button tg-button--primary sellgate__cta">Browse the shop</Link>
            </>
          )}
        </div>

        <ol className="sellgate__steps" aria-label="How selling works">
          {steps.map((s, i) => {
            const state = phase === 'declined' && i === 1 ? 'error'
              : i < activeIndex ? 'done'
                : i === activeIndex ? 'current'
                  : 'upcoming'
            return (
              <li key={s.key} className={`sellgate__step sellgate__step--${state}`}>
                <span className="sellgate__step-mark">{state === 'done' ? '✓' : state === 'error' ? '✕' : i + 1}</span>
                <span className="sellgate__step-label">{s.label}</span>
              </li>
            )
          })}
        </ol>
      </div>
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
  const [discardTarget, setDiscardTarget] = useState<string | null>(null)
  const [discardingId, setDiscardingId] = useState<string | null>(null)
  const [discardError, setDiscardError] = useState<string | null>(null)
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

  async function discardDraft() {
    if (!discardTarget) return
    setDiscardingId(discardTarget)
    setDiscardError(null)
    try {
      await api.withdrawSubmission(discardTarget)
      setDiscardTarget(null)
      submissions.reload()
    } catch (error) {
      setDiscardError(error instanceof ApiError ? error.message : 'Could not discard that submission')
    } finally {
      setDiscardingId(null)
    }
  }

  return (
    <>
      {drafts.length > 0 && (
        <div className="sell__drafts tg-card">
          <strong>You have {drafts.length} unfinished {drafts.length === 1 ? 'submission' : 'submissions'}.</strong>
          <ul className="sell__draft-list">
            {drafts.map((s) => (
              <li key={s.id} className="sell__draft-line">
                <Link to={`/sell/${s.id}`}>Started {dateOnly(s.createdAt)} · {s.pricingMode} pricing</Link>
                <button
                  type="button"
                  className="tg-button sell__draft-discard"
                  disabled={discardingId === s.id}
                  onClick={() => setDiscardTarget(s.id)}
                >
                  {discardingId === s.id ? 'Discarding…' : 'Discard'}
                </button>
              </li>
            ))}
          </ul>
          {discardError && <p className="sell__error" role="alert">{discardError}</p>}
        </div>
      )}

      {discardTarget && (
        <div className="sell__scrim" onMouseDown={() => !discardingId && setDiscardTarget(null)}>
          <div
            className="sell__confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sell-discard-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="sell-discard-title" className="sell__confirm-title">Discard unfinished submission?</h3>
            <p className="sell__confirm-copy tg-muted">
              This draft will be deleted and cannot be restored.
            </p>
            {discardError && <p className="sell__error" role="alert">{discardError}</p>}
            <div className="sell__confirm-actions">
              <button
                type="button"
                className="tg-button"
                disabled={!!discardingId}
                onClick={() => setDiscardTarget(null)}
              >
                Keep it
              </button>
              <button
                type="button"
                className="tg-button tg-button--primary"
                disabled={!!discardingId}
                onClick={discardDraft}
              >
                {discardingId === discardTarget ? 'Discarding…' : 'Discard submission'}
              </button>
            </div>
          </div>
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
                <ModelPhoto modelId={item.productModelId} kind={kind} size="thumb" alt={title} />
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
  if (state.loading) return <Loading label="Loading approvals" />
  if (state.error) return <ErrorNote error={state.error} onRetry={state.reload} />

  const rows = (state.data ?? []).filter((a) => a.approval.decision === 'pending')
  if (rows.length === 0) {
    return <Empty title="Nothing waiting on you" hint="We only ask when a price lands below your floor, the grade came back lower than you declared, or you chose manual pricing." />
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

      <div className="sell__list">
        {rows.map((a) => (
          <SellerPriceDecision key={a.approval.id} a={a} onDone={state.reload} />
        ))}
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

