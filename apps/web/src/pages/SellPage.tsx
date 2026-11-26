import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  api, ApiError, dateOnly, money, useApi, HAPPY_PATH, STATE_LABELS,
  type SellerApprovalView, type KycStatus,
} from '@trueglaz/core'
import { Empty, ErrorNote, Loading } from '../components/ui'
import { KycPanel } from '../components/KycPanel'
import { SellerPriceDecision } from '../components/SellerPriceDecision'
import { Icon, ICONS } from '../components/StaffShell'
import { PageHead } from '../components/PageHead'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { chipFor } from './SellerHomePage'
import './SellPage.css'

type Tab = 'items' | 'approvals' | 'payouts'

/**
 * The seller's side: what you've consigned, what needs your decision, and what
 * you've been paid. Approvals lead because they are the only thing here that
 * blocks money moving — an item sits unlisted until the seller answers.
 */
type Phase = 'loading' | 'open' | 'identity' | 'awaiting' | 'declined'

export function SellPage() {
  // The tab lives in the URL (TG-211): the sidebar links to each one.
  const [searchParams, setSearchParams] = useSearchParams()
  const asked = searchParams.get('tab')
  const tab: Tab = asked === 'approvals' || asked === 'payouts' ? asked : 'items'
  const setTab = (t: Tab) => setSearchParams(t === 'items' ? {} : { tab: t })
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

  const TITLES: Record<Tab, string> = { items: 'My items', approvals: 'Price approvals', payouts: 'Payouts' }
  const head = (
    <PageHead
      title={TITLES[tab]}
      crumbs={[{ label: 'Dashboard', to: '/sell' }, { label: TITLES[tab] }]}
      subtitle={tab === 'items' ? 'Everything you have consigned, where it is and what it is asking.'
        : tab === 'approvals' ? 'An item stays unlisted until you answer.' : 'What you have been paid, and where we send it.'}
      actions={<Link to="/sell/new" className="c-btn c-btn--cta"><Icon d={ICONS.camera} /> Consign an item</Link>}
    />
  )

  if (phase === 'open') {
    return (
      <div className="c-stack sell">
        {head}
        {submitted && (
          <p className="sell__success" role="status"><Icon d={ICONS.check} /> Item submitted. We will review it and tell you what happens next.</p>
        )}
        <section className="c-card c-tcard" aria-label="Your selling">
          <div className="c-tbar">
            <div className="c-tabs" role="tablist" aria-label="Seller sections">
              <TabButton active={tab === 'items'} onClick={() => setTab('items')} label="My items" />
              <TabButton active={tab === 'approvals'} onClick={() => setTab('approvals')} label="Price approvals" badge={pending.length || undefined} />
              <TabButton active={tab === 'payouts'} onClick={() => setTab('payouts')} label="Payouts" />
            </div>
          </div>
          {tab === 'items' && <MyItems />}
          {tab === 'approvals' && <Approvals state={approvals} />}
          {tab === 'payouts' && <Payouts kyc={kyc} onChanged={() => approvals.reload()} />}
        </section>
      </div>
    )
  }

  return (
    <div className="c-stack sell">
      <PageHead title="Start selling" crumbs={[{ label: 'Dashboard', to: '/sell' }, { label: 'Start selling' }]}
        subtitle="We confirm who you are once, then you can consign as much as you like." />
      <SellGate phase={phase} kyc={kyc} legalName={kyc.data?.legalName ?? null} rejectedReason={kyc.data?.rejectedReasonCode ?? null} onChanged={() => { approvals.reload(); home.reload() }} />
    </div>
  )
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
    return <div className="sellgate"><Loading label="Loading your selling status" /></div>
  }

  const steps = [
    { key: 'verify', label: 'Verify identity' },
    { key: 'review', label: 'TrueGlaz reviews' },
    { key: 'consign', label: 'Consign your gear' },
    { key: 'paid', label: 'Get paid when it sells' },
  ]
  const activeIndex = phase === 'identity' ? 0 : 1 // declined also sits at step 2

  return (
      <div className="sellgate">
        <div className="c-card sellgate__hero">
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
  )
}

function TabButton({
  active, onClick, label, badge,
}: { active: boolean; onClick: () => void; label: string; badge?: number }) {
  return (
    <button type="button" role="tab" aria-selected={active} className={`c-tabs__tab${active ? ' c-tabs__tab--on' : ''}`} onClick={onClick}>
      {label}
      {badge ? <span className="c-tabs__n">{badge}</span> : null}
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
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const [allDrafts, setAllDrafts] = useState(false)

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
      }
    })
  }, [rows, sort, modelById, categoryById])
  const visibleRows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return sortedRows.filter(({ item, title, category }) =>
      (status === 'all' || item.currentState === status) &&
      (!t || `${title} ${item.internalSku} ${category?.name ?? ''}`.toLowerCase().includes(t)))
  }, [sortedRows, status, q])
  // Twenty at a time (TG-211): a long-standing seller has hundreds.
  const from = at < visibleRows.length ? at : 0
  const pageRows = visibleRows.slice(from, from + PAGE)

  const nav = useNavigate()
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
        <div className="sell__drafts">
          <span className="c-tile c-tile--warn sell__drafts-tile"><Icon d={ICONS.clock} /></span>
          <div className="sell__drafts-body">
            <b>You have {drafts.length} unfinished {drafts.length === 1 ? 'submission' : 'submissions'}</b>
            <ul className="sell__draft-list">
              {(allDrafts ? drafts : drafts.slice(0, 3)).map((s) => (
                <li key={s.id} className="sell__draft-line">
                  <Link to={`/sell/${s.id}`} className="c-link">Started {dateOnly(s.createdAt)} · {s.pricingMode} pricing</Link>
                  <button type="button" className="c-btn c-btn--sm" disabled={discardingId === s.id} onClick={() => { setDiscardError(null); setDiscardTarget(s.id) }}>
                    {discardingId === s.id ? 'Discarding…' : 'Discard'}
                  </button>
                </li>
              ))}
            </ul>
            {drafts.length > 3 && (
              <button type="button" className="sell__more" onClick={() => setAllDrafts((v) => !v)}>
                {allDrafts ? 'Show fewer' : `Show all ${drafts.length}`}
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!discardTarget}
        title="Discard unfinished submission?"
        confirmLabel="Discard submission"
        cancelLabel="Keep it"
        destructive
        busy={!!discardingId}
        error={discardError}
        onConfirm={discardDraft}
        onCancel={() => !discardingId && setDiscardTarget(null)}
      >
        This draft will be deleted and cannot be restored.
      </ConfirmDialog>

      <div className="sell__filters">
        <label className="sell__find">
          <Icon d={ICONS.search} />
          <input type="search" value={q} placeholder="Find by name or SKU" aria-label="Find by name or SKU"
            onChange={(e) => { setQ(e.target.value); setAt(0) }} />
        </label>
        <p className="sell__count"><b>{visibleRows.length}</b> {visibleRows.length === 1 ? 'item' : 'items'}{status !== 'all' && ` · ${STATE_LABELS[status] ?? status}`}</p>
        <label className="sell__sel">
          <span className="tg-visually-hidden">Status</span>
          <select value={status} onChange={(e) => { setStatus(e.target.value as string | 'all'); setAt(0) }}>
            <option value="all">All statuses ({rows.length})</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{STATE_LABELS[s] ?? s} ({byStatus.get(s) ?? 0})</option>
            ))}
          </select>
        </label>
        <label className="sell__sel">
          <span className="tg-visually-hidden">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <Empty title="Nothing consigned yet" hint="Send us a lens or a body and we'll grade it, list it and pay you when it sells." />
      ) : visibleRows.length === 0 ? (
        <Empty title="Nothing matches" hint="Try other words, a different status, or All statuses." />
      ) : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead>
              <tr>
                <th>Item</th><th>Stage</th><th>Grade</th>
                <th className="c-num">Asking</th><th className="c-num">Floor</th><th>Since</th><th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ item, title, category }) => (
                <tr key={item.id} className="c-clickable" onClick={() => nav(`/items/${item.id}`)}>
                  <td>
                    <Link to={`/items/${item.id}`} className="sell__item" onClick={(e) => e.stopPropagation()}>
                      <b>{title}</b>
                      <span><span className="tg-mono">{item.internalSku}</span>{category && ` · ${category.name}`}</span>
                    </Link>
                  </td>
                  <td>
                    <span className={`c-chip2 c-chip2--${chipFor(item.currentState)}`}>
                      {item.withdrawnBySeller ? 'Withdrawn by you' : STATE_LABELS[item.currentState] ?? item.currentState}
                    </span>
                  </td>
                  <td>
                    {item.assignedGradeCode
                      ? <span className="c-chip2" title={`You declared ${item.declaredGradeCode}`}>{item.assignedGradeCode}</span>
                      : <span className="tg-muted" title="Declared by you; we grade it on arrival">{item.declaredGradeCode} declared</span>}
                  </td>
                  <td className="c-num"><b>{money(item.askingAmountMinor)}</b></td>
                  <td className="c-num">{item.floorAmountMinor != null ? money(item.floorAmountMinor) : <span className="tg-muted">—</span>}</td>
                  <td className="tg-muted">{dateOnly(item.listedAt ?? item.createdAt)}</td>
                  <td className="sell__go"><Icon d={ICONS.chevron} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {visibleRows.length > PAGE && (
        <nav className="sell__pager" aria-label="Pages">
          <span>{from + 1}–{Math.min(visibleRows.length, from + PAGE)} of {visibleRows.length}</span>
          <button type="button" className="c-btn c-btn--sm" disabled={from === 0} onClick={() => setAt(Math.max(0, from - PAGE))}>Previous</button>
          <button type="button" className="c-btn c-btn--sm" disabled={from + PAGE >= visibleRows.length} onClick={() => setAt(from + PAGE)}>Next</button>
        </nav>
      )}
    </>
  )
}

const PAGE = 20

function Approvals({ state }: { state: ReturnType<typeof useApi<SellerApprovalView[]>> }) {
  if (state.loading) return <Loading label="Loading approvals" />
  if (state.error) return <ErrorNote error={state.error} onRetry={state.reload} />

  const rows = (state.data ?? []).filter((a) => a.approval.decision === 'pending')
  if (rows.length === 0) {
    return <Empty title="Nothing waiting on you" hint="We only ask when a price lands below your floor, the grade came back lower than you declared, or you chose manual pricing." />
  }

  return (
    <div className="sell__approvals">
      <p className="sell__count"><b>{rows.length}</b> {rows.length === 1 ? 'item' : 'items'} waiting on you</p>
      <div className="sell__list">
        {rows.map((a) => (
          <SellerPriceDecision key={a.approval.id} a={a} onDone={state.reload} />
        ))}
      </div>
    </div>
  )
}

function Payouts({ kyc, onChanged }: { kyc: ReturnType<typeof useApi<KycStatus>>; onChanged: () => void }) {
  const payouts = useApi(() => api.myPayouts(), [])
  const account = useApi(() => api.myPayoutAccount(), [])
  const list = payouts.data ?? []
  const paid = useMemo(() => list.filter((p) => p.state === 'paid').reduce((sum, p) => sum + p.netMinor, 0), [list])
  const due = useMemo(() => list.filter((p) => p.state !== 'paid' && p.state !== 'cancelled').reduce((sum, p) => sum + p.netMinor, 0), [list])

  return (
    <div className="sell__payouts">
      <div className="sell__side">
        <section className="sell__panel" aria-labelledby="sell-acct">
          <h3 id="sell-acct">Where we send your money</h3>
          {account.loading && <Loading label="Loading" />}
          {account.data ? (
            <div className="sell__acct">
              <span className="c-tile sh__tile--navy"><Icon d={ICONS.building} /></span>
              <span className="sell__acct-main">
                <b>{account.data.method.toUpperCase()}</b>
                <span>{account.data.upiVpa ?? (account.data.accountLast4 ? `account ending ${account.data.accountLast4}` : account.data.accountHolderName)}</span>
              </span>
              <span className={`c-chip2 c-chip2--${account.data.verificationState === 'verified' ? 'good' : 'warn'}`}>{account.data.verificationState}</span>
              <Link to="/profile#bank" className="c-btn c-btn--sm">Change</Link>
            </div>
          ) : (
            !account.loading && (
              <p className="sell__fine">
                Payouts are held until an account is on file and verified. <Link to="/profile#bank" className="c-link">Add your bank or UPI details</Link>.
                It takes a code sent to your email, so nobody can redirect your money with a stolen session alone.
              </p>
            )
          )}
        </section>
        <section className="sell__panel" aria-labelledby="sell-kyc">
          <h3 id="sell-kyc">Identity check</h3>
          <KycPanel kyc={kyc} onChanged={onChanged} />
        </section>
      </div>

      <section className="sell__panel sell__panel--table" aria-labelledby="sell-paid">
        <div className="sell__panel-head">
          <h3 id="sell-paid">Payout history</h3>
          <span className="c-card__note"><b>{money(paid)}</b> paid{due > 0 && <> · <b>{money(due)}</b> on its way</>}</span>
        </div>
        {payouts.loading && <Loading label="Loading payouts" />}
        {payouts.error && <ErrorNote error={payouts.error} onRetry={payouts.reload} />}
        {payouts.data?.length === 0 && <p className="c-empty">Nothing yet. A payout appears when a buyer accepts delivery.</p>}
        {list.length > 0 && (
          <div className="c-table-wrap">
            <table className="c-table">
              <thead>
                <tr><th className="c-num">Sale</th><th className="c-num">Net to you</th><th>State</th><th>Paid</th></tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="c-num">{money(p.grossMinor)}</td>
                    <td className="c-num"><b>{money(p.netMinor)}</b></td>
                    <td>
                      <span className={`c-chip2 c-chip2--${p.state === 'paid' ? 'good' : p.state === 'on_hold' ? 'warn' : 'navy'}`}>{p.state.replace(/_/g, ' ')}</span>
                      {p.holdReasonCode && <span className="tg-muted sell__why"> {p.holdReasonCode.replace(/_/g, ' ')}</span>}
                    </td>
                    <td className="tg-muted">{p.paidAt ? dateOnly(p.paidAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

