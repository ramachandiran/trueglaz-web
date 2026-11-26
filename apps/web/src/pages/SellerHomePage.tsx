import { Link, useNavigate } from 'react-router-dom'
import { api, dateOnly, money, relative, STATE_LABELS, useApi, useSession, type SellerHome, type WantedMatch, type WantedRequest } from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import { Icon, ICONS } from '../components/StaffShell'
import { PageHead } from '../components/PageHead'
import { KpiCard, KpiRow } from '../components/KpiCard'
import './SellerHomePage.css'

/**
 * The seller's dashboard (TG-211), on the console's layout.
 *
 * A seller's questions are "what am I owed", "does anything need my answer"
 * and "what should I send in next", so the money leads as figure cards, the
 * journey of their gear is a path with a count at each step, and the Wanted
 * board sits beside their own work rather than behind a link.
 */
export function SellerHomePage() {
  const { session } = useSession()
  const home = useApi(() => api.sellerHome(), [])
  const wanted = useApi(() => api.wantedBoard(), [])
  const first = (session?.displayName ?? '').split(' ')[0]
  const d = home.data
  const urgent = (d?.actions ?? []).filter((a) => a.tone === 'urgent')
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const head = (
    <PageHead
      title={`${greeting()}${first ? `, ${first}` : ''}`}
      subtitle={!d ? today : `${today} · ${!d.status.canSell
        ? 'One step before you can sell: confirm who you are'
        : urgent.length > 0
          ? `${urgent.length === 1 ? 'One thing needs' : `${urgent.length} things need`} you`
          : d.money.itemCount === 0 ? 'Send in your first piece of gear' : 'Nothing needs you right now'}`}
      actions={d?.status.canSell ? <>
        <Link to="/wanted" className="c-btn"><Icon d={ICONS.search} /> Buyers’ requests</Link>
        <Link to="/sell/new" className="c-btn c-btn--cta"><Icon d={ICONS.camera} /> Consign an item</Link>
      </> : undefined}
    />
  )

  if (home.loading && !d) return <>{head}<Loading label="Loading your selling" /></>
  if (home.error && !d) return <>{head}<ErrorNote error={home.error} onRetry={home.reload} /></>
  if (!d) return null

  const m = d.money
  const onSale = d.pipeline.find((s) => s.key === 'on_sale')?.count ?? 0
  const rest = d.actions.filter((a) => a.tone !== 'urgent')

  return (
    <div className="c-stack sh">
      {head}
      {!d.status.canSell && <Onboarding d={d} />}

      <KpiRow label="Your money">
        <KpiCard lead icon={ICONS.rupee} title="Paid out to you" value={money(m.paidOutMinor)} to="/sell/manage?tab=payouts"
          chip={<span className="c-chip2 c-chip2--good"><Icon d={ICONS.check} /> {m.soldCount} sold</span>} note="so far" />
        <KpiCard icon={ICONS.clock} title="On its way to you" value={money(m.owedMinor)} to="/sell/manage?tab=payouts"
          chip={m.owedMinor > 0 ? <span className="c-chip2 c-chip2--warn"><Icon d={ICONS.clock} /> Releasing</span> : <span className="c-chip2">None due</span>}
          note="sold, being released" />
        <KpiCard icon={ICONS.tag} title="Expected from sales" value={money(m.expectedMinor)} to="/sell/manage"
          chip={<span className="c-chip2 c-chip2--navy">After our fee</span>} note="if all on sale sells" />
        <KpiCard icon={ICONS.inventory} title="Items with us" value={String(m.itemCount)} to="/sell/manage"
          chip={<span className="c-chip2 c-chip2--good">{onSale} on sale</span>} note="consigned in all" />
      </KpiRow>

      <Journey d={d} />

      <section className="c-grid sh__row">
        <div className="c-card">
          <div className="c-card__head"><h2>What needs you</h2><span className="c-card__note">{d.actions.length === 0 ? 'All clear' : `${d.actions.length} to do`}</span></div>
          {d.actions.length === 0 ? (
            <p className="c-empty"><b>All clear.</b> No prices to answer, boxes to post or payouts held. We will tell you the moment that changes.</p>
          ) : (
            [...urgent, ...rest].map((a) => (
              <Link key={a.key} to={a.href} className={`c-task${a.tone === 'urgent' ? ' c-task--hot' : ''}`}>
                <span className="c-task__n">{a.count}</span>
                <span className="c-task__body"><b>{a.title}</b><span>{a.hint}</span></span>
                <span className="c-task__go"><Icon d={ICONS.arrow} /></span>
              </Link>
            ))
          )}
        </div>
        <WantedCard rows={wanted.data ?? []} loading={wanted.loading} canSell={d.status.canSell} matches={d.wantedMatches} />
      </section>

      <Recent rows={d.recent} />
    </div>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function chipFor(state: string): string {
  if (['LISTED', 'SOLD', 'ACCEPTED', 'DELIVERED', 'DISPATCHED'].includes(state)) return 'good'
  if (['INSPECTION_FAILED', 'QUARANTINED', 'SELLER_DECLINED', 'REJECTED_PRE_INTAKE', 'RETURN_TO_SELLER', 'RETURN_REQUESTED', 'RETURNED', 'EXPIRED'].includes(state)) return 'bad'
  if (['AWAITING_SELLER_APPROVAL', 'RESERVED', 'UNSOLD_REVIEW'].includes(state)) return 'warn'
  return 'navy'
}

/** The path a piece of gear takes, with how many of yours are at each step. */
function Journey({ d }: { d: SellerHome }) {
  const steps = d.pipeline.filter((s) => s.key !== 'back')
  const back = d.pipeline.find((s) => s.key === 'back')
  return (
    <section className="c-card" aria-labelledby="sh-path">
      <div className="c-card__head">
        <h2 id="sh-path">Where your gear is</h2>
        {back && back.count > 0 && <span className="c-chip2 c-chip2--warn">{back.count} coming back to you</span>}
        <Link to="/sell/manage" className="c-link">All my items</Link>
      </div>
      <ol className="sh__steps">
        {steps.map((s) => (
          <li key={s.key} className={`sh__step${s.count > 0 ? ' sh__step--has' : ''}`}>
            <span className="sh__step-n">{s.count}</span>
            <span className="sh__step-label">{s.label}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Your gear's latest moves, as the console's table card. */
function Recent({ rows }: { rows: SellerHome['recent'] }) {
  const nav = useNavigate()
  return (
    <section className="c-card c-tcard" aria-labelledby="sh-recent">
      <div className="c-tbar">
        <h2 id="sh-recent">Your gear, lately</h2>
        <Link to="/sell/manage" className="c-btn c-btn--sm">All my items <Icon d={ICONS.arrow} /></Link>
      </div>
      {rows.length === 0 ? (
        <p className="c-empty">Nothing yet. Once you consign something, every step it takes shows up here.</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead>
              <tr><th>Item</th><th>Stage</th><th>Grade</th><th className="c-num">Price</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.itemId} className="c-clickable" onClick={() => nav(`/items/${r.itemId}`)}>
                  <td>
                    <Link to={`/items/${r.itemId}`} className="sh__item" onClick={(e) => e.stopPropagation()}>
                      <b>{r.title}</b><span className="tg-mono">{r.sku}</span>
                    </Link>
                  </td>
                  <td><span className={`c-chip2 c-chip2--${chipFor(r.toState)}`}>{STATE_LABELS[r.toState] ?? r.toState}</span></td>
                  <td>{r.grade ? <span className="c-chip2">{r.grade}</span> : <span className="tg-muted">—</span>}</td>
                  <td className="c-num">{r.priceMinor != null ? money(r.priceMinor) : <span className="tg-muted">—</span>}</td>
                  <td className="tg-muted"><time dateTime={r.at ?? undefined}>{relative(r.at)}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** First-time sellers: the steps, in order, with where each one is. */
function Onboarding({ d }: { d: SellerHome }) {
  const verified = d.status.kycStatus === 'verified'
  const steps = [
    { done: verified, title: 'Confirm who you are', hint: d.status.kycStatus === 'in_review' ? 'Under review. We will tell you the moment it passes.' : 'A photo of your ID. We keep only its last four digits.', href: '/sell/manage' },
    { done: d.status.canSell, title: 'We approve you to sell', hint: 'A person checks, usually the same day.', href: '/sell/manage' },
    { done: d.status.hasPayoutAccount, title: 'Say where to send your money', hint: 'A UPI id or bank account.', href: '/profile#bank' },
    { done: d.money.itemCount > 0, title: 'Consign your first item', hint: 'Describe it, we pick it up, grade it and sell it.', href: '/sell/new' },
  ]
  const done = steps.filter((s) => s.done).length
  return (
    <section className="c-card" aria-labelledby="sh-start">
      <div className="c-card__head"><h2 id="sh-start">Getting started</h2><span className="c-card__note"><b>{done}</b> of {steps.length} done</span></div>
      <ol className="sh__start">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link to={s.href} className={`c-task${s.done ? ' sh__start--done' : ''}`}>
              <span className="sh__tick" aria-hidden="true">{s.done ? <Icon d={ICONS.check} /> : i + 1}</span>
              <span className="c-task__body"><b>{s.title}</b><span>{s.done ? 'Done' : s.hint}</span></span>
              <span className="c-task__go"><Icon d={ICONS.arrow} /></span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * What buyers are waiting for. Asks the seller's own gear answers come first
 * and say which item; a near miss says what is missing.
 */
function WantedCard({ rows, loading, canSell, matches }: {
  rows: WantedRequest[]; loading: boolean; canSell: boolean; matches: WantedMatch[]
}) {
  const by = new Map(matches.map((m) => [m.requestId, m]))
  const rank = (r: WantedRequest) => (by.get(r.id)?.kind === 'match' ? 0 : by.get(r.id) ? 1 : 2)
  const shown = [...rows].sort((a, b) => rank(a) - rank(b)).slice(0, 5)
  const full = matches.filter((m) => m.kind === 'match').length
  return (
    <section className="c-card sh__wanted" aria-labelledby="sh-wanted">
      <div className="c-card__head">
        <h2 id="sh-wanted">Buyers are asking for</h2>
        <Link to="/wanted" className="c-link">{rows.length > shown.length ? `See all ${rows.length}` : 'Open the board'}</Link>
      </div>
      <p className="sh__lede">
        {full > 0 ? `${full} of these ${full === 1 ? 'is' : 'are'} gear you already have.` : 'If you have one of these, it already has a buyer.'}
      </p>
      {loading && <p className="c-empty">Loading…</p>}
      {!loading && shown.length === 0 && <p className="c-empty">Nobody is asking for anything right now.</p>}
      <div className="c-rows">
        {shown.map((r) => {
          const m = by.get(r.id)
          return (
            <div key={r.id} className="c-row sh__ask">
              <span className={`c-tile ${m?.kind === 'match' ? 'c-tile--good' : m ? 'c-tile--warn' : 'sh__tile--navy'} sh__ask-tile`}><Icon d={m ? ICONS.check : ICONS.search} /></span>
              <span className="c-row__main">
                <span className="c-row__title">{r.wanted}</span>
                <span className="c-row__meta">
                  {[r.minGradeCode && `grade ${r.minGradeCode} or better`, r.maxPriceMinor != null && `up to ${money(r.maxPriceMinor)}`, r.createdAt && `asked ${dateOnly(r.createdAt)}`].filter(Boolean).join(' · ')}
                </span>
                {m && (
                  <Link to={`/items/${m.itemId}`} className="sh__ask-flag">
                    {m.kind === 'match' ? 'You have this' : `Close: ${m.reason}`} · <span className="tg-mono">{m.sku}</span>
                  </Link>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {canSell && <Link to="/sell/new" className="c-btn sh__ask-cta">I have one, consign it</Link>}
    </section>
  )
}
