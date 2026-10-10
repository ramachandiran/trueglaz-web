import { Link } from 'react-router-dom'
import { api, dateOnly, money, relative, STATE_LABELS, useApi, useSession, type SellerHome, type WantedRequest } from '@trueglaz/core'
import { ErrorNote, GradeBadge, Loading } from '../components/ui'
import './SellerHomePage.css'

/**
 * Where a seller lands.
 *
 * A seller's questions are different from staff's: "what am I owed", "does
 * anything need my answer", and "what should I send in next". So money leads,
 * the journey of their gear is a path rather than a bar, and the Wanted board -
 * the one place a seller can learn what is worth sending - sits beside their own
 * work rather than behind a link.
 */
export function SellerHomePage() {
  const { session } = useSession()
  const home = useApi(() => api.sellerHome(), [])
  const wanted = useApi(() => api.wantedBoard(), [])

  if (home.loading) return <Loading label="Loading your selling" />
  if (home.error) return <ErrorNote error={home.error} onRetry={home.reload} />
  if (!home.data) return null

  const d = home.data
  const first = (session?.displayName ?? '').split(' ')[0]
  const urgent = d.actions.filter((a) => a.tone === 'urgent')
  const rest = d.actions.filter((a) => a.tone !== 'urgent')

  return (
    <div className="sl">
      <header className="sl__hero">
        <div>
          <p className="sl__eyebrow">Your selling</p>
          <h1 className="sl__title">Hello{first ? `, ${first}` : ''}</h1>
          <p className="sl__sub">
            {!d.status.canSell
              ? 'One step before you can sell: confirm who you are.'
              : urgent.length > 0
                ? `${urgent.length === 1 ? 'One thing needs' : `${urgent.length} things need`} you.`
                : d.money.itemCount === 0
                  ? 'Send in your first piece of gear and we will take it from there.'
                  : 'Everything is moving. Nothing needs you right now.'}
          </p>
        </div>
        <div className="sl__cta">
          {d.status.canSell
            ? <Link to="/sell/new" className="tg-button tg-button--primary sl__cta-main">Consign an item</Link>
            : <Link to="/sell/manage" className="tg-button tg-button--primary sl__cta-main">Verify your identity</Link>}
          <Link to="/sell/manage" className="sl__cta-link">Manage my items →</Link>
        </div>
      </header>

      {d.status.canSell && <Money d={d} />}
      <Journey d={d} />

      <div className="sl__cols">
        <div className="sl__main">
          {!d.status.canSell ? <Onboarding d={d} /> : (
            <section aria-labelledby="sl-todo">
              <h2 id="sl-todo" className="sl__h2">What needs you</h2>
              {d.actions.length === 0 ? (
                <div className="sl__clear">
                  <strong>All clear.</strong>
                  <span>No prices to answer, boxes to post or payouts held. We will tell you the moment that changes.</span>
                </div>
              ) : (
                <div className="sl__todo">
                  {[...urgent, ...rest].map((a) => (
                    <Link key={a.key} to={a.href} className={`sl__task sl__task--${a.tone}`}>
                      <span className="sl__task-count">{a.count}</span>
                      <span className="sl__task-body">
                        <strong>{a.title}</strong>
                        <span>{a.hint}</span>
                      </span>
                      <span className="sl__go" aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="sl-recent">
            <h2 id="sl-recent" className="sl__h2">Your gear, lately</h2>
            <div className="sl__card">
              {d.recent.length === 0 ? (
                <p className="sl__empty">Nothing yet. Once you consign something, every step it takes shows up here.</p>
              ) : (
                <ul className="sl__feed">
                  {d.recent.map((r) => (
                    <li key={r.itemId}>
                      <Link to={`/items/${r.itemId}`} className="sl__feed-item">
                        <span className={`sl__dot sl__dot--${dotFor(r.toState)}`} aria-hidden="true" />
                        <span className="sl__feed-body">
                          <span className="sl__feed-title">{r.title}{r.grade && <span className="sl__grade">{r.grade}</span>}</span>
                          <span className="sl__feed-meta">
                            {STATE_LABELS[r.toState] ?? r.toState}
                            {r.priceMinor != null && ['LISTED', 'SOLD', 'DISPATCHED', 'DELIVERED', 'ACCEPTED'].includes(r.toState) && ` · ${money(r.priceMinor)}`}
                          </span>
                        </span>
                        <time className="sl__feed-time" dateTime={r.at ?? undefined}>{relative(r.at)}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <aside className="sl__side">
          <WantedWidget rows={wanted.data ?? []} loading={wanted.loading} canSell={d.status.canSell} />
        </aside>
      </div>
    </div>
  )
}

function dotFor(state: string): string {
  if (['LISTED', 'SOLD', 'ACCEPTED', 'DELIVERED', 'DISPATCHED'].includes(state)) return 'good'
  if (['INSPECTION_FAILED', 'QUARANTINED', 'SELLER_DECLINED', 'REJECTED_PRE_INTAKE', 'RETURN_TO_SELLER', 'RETURN_REQUESTED'].includes(state)) return 'bad'
  if (['AWAITING_SELLER_APPROVAL', 'RESERVED'].includes(state)) return 'warn'
  return 'plain'
}

/** What they have been paid, what is on its way, and what the shelf is worth to them. */
function Money({ d }: { d: SellerHome }) {
  const m = d.money
  return (
    <div className="sl__money">
      <div className="sl__m sl__m--lead">
        <span className="sl__m-label">Paid out to you</span>
        <span className="sl__m-value">{money(m.paidOutMinor)}</span>
        <span className="sl__m-note">{m.soldCount} sale{m.soldCount === 1 ? '' : 's'} so far</span>
      </div>
      <div className="sl__m">
        <span className="sl__m-label">On its way to you</span>
        <span className="sl__m-value">{money(m.owedMinor)}</span>
        <span className="sl__m-note">sold, being released</span>
      </div>
      <div className="sl__m">
        <span className="sl__m-label">Expected from what is on sale</span>
        <span className="sl__m-value">{money(m.expectedMinor)}</span>
        <span className="sl__m-note">after our fee, if it all sells</span>
      </div>
    </div>
  )
}

/** The path a piece of gear takes, as a path, with how many of yours are at each step. */
function Journey({ d }: { d: SellerHome }) {
  const steps = d.pipeline.filter((s) => s.key !== 'back')
  const back = d.pipeline.find((s) => s.key === 'back')
  return (
    <section className="sl__journey" aria-label="Where your gear is">
      <ol className="sl__steps">
        {steps.map((s, i) => (
          <li key={s.key} className={`sl__step${s.count > 0 ? ' sl__step--has' : ''}`}>
            <span className="sl__step-n">{s.count}</span>
            <span className="sl__step-label">{s.label}</span>
            {i < steps.length - 1 && <span className="sl__chev" aria-hidden="true">›</span>}
          </li>
        ))}
      </ol>
      {back && back.count > 0 && <p className="sl__back">{back.count} coming back to you</p>}
    </section>
  )
}

/** First-time sellers: three steps, in order, with where each one is. */
function Onboarding({ d }: { d: SellerHome }) {
  const verified = d.status.kycStatus === 'verified'
  const steps = [
    { done: verified, title: 'Confirm who you are', hint: d.status.kycStatus === 'in_review' ? 'Under review. We will tell you the moment it passes.' : 'A photo of your ID. We keep only its last four digits.', href: '/sell/manage' },
    { done: d.status.canSell, title: 'We approve you to sell', hint: 'A person checks, usually the same day.', href: '/sell/manage' },
    { done: d.status.hasPayoutAccount, title: 'Say where to send your money', hint: 'A UPI id or bank account.', href: '/profile#bank' },
    { done: d.money.itemCount > 0, title: 'Consign your first item', hint: 'Describe it, we pick it up, grade it and sell it.', href: '/sell/new' },
  ]
  return (
    <section aria-labelledby="sl-start">
      <h2 id="sl-start" className="sl__h2">Getting started</h2>
      <ol className="sl__start">
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? 'sl__start-done' : ''}>
            <Link to={s.href}>
              <span className="sl__tick" aria-hidden="true">{s.done ? '✓' : i + 1}</span>
              <span className="sl__task-body"><strong>{s.title}</strong><span>{s.hint}</span></span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The board, beside the seller's own work: what buyers are waiting for. */
function WantedWidget({ rows, loading, canSell }: { rows: WantedRequest[]; loading: boolean; canSell: boolean }) {
  const shown = rows.slice(0, 5)
  return (
    <section className="sl__wanted" aria-labelledby="sl-wanted">
      <div className="sl__wanted-head">
        <h2 id="sl-wanted" className="sl__wanted-title">Buyers are asking for</h2>
        {rows.length > 0 && <span className="sl__wanted-n">{rows.length}</span>}
      </div>
      <p className="sl__wanted-lede">If you have one of these, it already has a buyer.</p>
      {loading && <p className="sl__empty">Loading…</p>}
      {!loading && shown.length === 0 && <p className="sl__empty">Nobody is asking for anything right now.</p>}
      <ul className="sl__wanted-list">
        {shown.map((r) => (
          <li key={r.id} className="sl__ask">
            <strong className="sl__ask-what">{r.wanted}</strong>
            <span className="sl__ask-meta">
              {r.minGradeCode && <GradeBadge code={r.minGradeCode} />}
              {r.maxPriceMinor != null && <span>up to {money(r.maxPriceMinor)}</span>}
              {r.createdAt && <span className="sl__ask-when">asked {dateOnly(r.createdAt)}</span>}
            </span>
            {r.note && <span className="sl__ask-note">“{r.note}”</span>}
          </li>
        ))}
      </ul>
      <div className="sl__wanted-foot">
        <Link to="/wanted">{rows.length > shown.length ? `See all ${rows.length}` : 'Open the board'} →</Link>
        {canSell && <Link to="/sell/new" className="tg-button sl__wanted-cta">I have one</Link>}
      </div>
    </section>
  )
}
