import { Link } from 'react-router-dom'
import { api, money, relative, STATE_LABELS, useApi, useSession, type StaffHome } from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import './StaffHomePage.css'

const GROUPS = ['Intake', 'Workshop', 'Orders', 'Returns', 'People', 'Money'] as const

/**
 * Where staff land.
 *
 * Four different shapes on purpose, because they answer four different questions:
 * tiles for "how are we doing", a single bar for "where is everything", cards
 * for "what is waiting on me", and a timeline for "what just moved". Inventory is
 * for looking things up; this is for knowing what to do next.
 */
export function StaffHomePage() {
  const { session } = useSession()
  const { data, error, loading, reload } = useApi(() => api.staffHome(), [])

  if (loading) return <Loading label="Loading your day" />
  if (error) return <ErrorNote error={error} onRetry={reload} />
  if (!data) return null

  const urgent = data.actions.filter((a) => a.tone === 'urgent')
  const rest = data.actions.filter((a) => a.tone !== 'urgent')
  const waiting = data.actions.filter((a) => a.tone !== 'quiet').reduce((n, a) => n + a.count, 0)
  const first = (session?.displayName ?? '').split(' ')[0]

  return (
    <div className="sh">
      <header className="sh__hello">
        <div>
          <h1 className="sh__title">{greeting()}{first ? `, ${first}` : ''}</h1>
          <p className="sh__date">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <p className={`sh__pill${waiting === 0 ? ' sh__pill--clear' : ''}`}>
          {waiting === 0 ? 'Nothing is waiting on you' : `${waiting} thing${waiting === 1 ? '' : 's'} need you`}
        </p>
      </header>

      <Tiles data={data} />
      <Pipeline data={data} />

      <div className="sh__cols">
        <div className="sh__main">
          {urgent.length > 0 && (
            <section aria-labelledby="sh-urgent">
              <h2 id="sh-urgent" className="sh__h2">Do these first</h2>
              <div className="sh__urgent">
                {urgent.map((a) => (
                  <Link key={a.key} to={a.href} className="sh__hot">
                    <span className="sh__hot-count">{a.count}</span>
                    <span className="sh__hot-body">
                      <strong>{a.title}</strong>
                      <span>{a.hint}</span>
                    </span>
                    <span className="sh__go" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="sh-queue">
            <h2 id="sh-queue" className="sh__h2">{urgent.length ? 'Also on your plate' : 'On your plate'}</h2>
            {rest.length === 0 && urgent.length === 0 && (
              <div className="sh__clear">
                <strong>All clear.</strong>
                <span>No submissions, orders, returns or checks are waiting. New work appears here as it arrives.</span>
              </div>
            )}
            <div className="sh__groups">
              {GROUPS.map((g) => {
                const items = rest.filter((a) => a.group === g)
                if (items.length === 0) return null
                return (
                  <div key={g} className="sh__group">
                    <h3 className="sh__group-name">{g}</h3>
                    {items.map((a) => (
                      <Link key={a.key} to={a.href} className={`sh__row${a.tone === 'quiet' ? ' sh__row--quiet' : ''}`}>
                        <span className="sh__row-count">{a.count}</span>
                        <span className="sh__row-body">
                          <span className="sh__row-title">{a.title}</span>
                          <span className="sh__row-hint">{a.hint}</span>
                        </span>
                        <span className="sh__go" aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="sh__side">
          <section className="sh__card" aria-labelledby="sh-recent">
            <h2 id="sh-recent" className="sh__h2">Just moved</h2>
            <ul className="sh__feed">
              {data.recent.length === 0 && <li className="sh__empty">Nothing has moved yet.</li>}
              {data.recent.map((r) => (
                <li key={r.itemId}>
                  <Link to={`/items/${r.itemId}`} className="sh__feed-item">
                    <span className={`sh__dot sh__dot--${dotFor(r.toState)}`} aria-hidden="true" />
                    <span className="sh__feed-body">
                      <span className="sh__feed-title">
                        {r.title}
                        {r.grade && <span className="sh__grade">{r.grade}</span>}
                      </span>
                      <span className="sh__feed-meta">
                        <span className="tg-mono">{r.sku}</span> · {STATE_LABELS[r.toState] ?? r.toState}
                        {r.priceMinor != null && ['LISTED', 'SOLD', 'DISPATCHED', 'DELIVERED', 'ACCEPTED'].includes(r.toState) && ` · ${money(r.priceMinor)}`}
                      </span>
                    </span>
                    <time className="sh__feed-time" dateTime={r.at ?? undefined}>{relative(r.at)}</time>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/inventory" className="sh__more">See all inventory →</Link>
          </section>

          <Week data={data} />
        </aside>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** The state an item has just reached, as a colour: moving forward, selling, or going wrong. */
function dotFor(state: string): string {
  if (['LISTED', 'SOLD', 'ACCEPTED', 'DELIVERED', 'DISPATCHED'].includes(state)) return 'good'
  if (['INSPECTION_FAILED', 'QUARANTINED', 'RETURN_REQUESTED', 'RETURN_REJECTED', 'SELLER_DECLINED', 'REJECTED_PRE_INTAKE', 'RETURN_TO_SELLER'].includes(state)) return 'bad'
  if (['AWAITING_SELLER_APPROVAL', 'RESERVED', 'UNSOLD_REVIEW'].includes(state)) return 'warn'
  return 'plain'
}

function Tiles({ data }: { data: StaffHome }) {
  const t = data.totals
  return (
    <div className="sh__tiles">
      <div className="sh__tile sh__tile--lead">
        <span className="sh__tile-label">On sale now</span>
        <span className="sh__tile-value">{t.onSaleCount}</span>
        <span className="sh__tile-note">{money(t.onSaleValueMinor)} of stock</span>
      </div>
      <div className="sh__tile">
        <span className="sh__tile-label">Sold, last 7 days</span>
        <span className="sh__tile-value">{t.soldWeekCount}</span>
        <span className="sh__tile-note">{money(t.soldWeekValueMinor)}</span>
      </div>
      <div className="sh__tile">
        <span className="sh__tile-label">Units on the platform</span>
        <span className="sh__tile-value">{t.units}</span>
        <span className="sh__tile-note">everything ever taken in</span>
      </div>
      <div className="sh__tile sh__tile--today">
        <span className="sh__tile-label">Today</span>
        <dl className="sh__today">
          <div><dt>Received</dt><dd>{data.today.received}</dd></div>
          <div><dt>Listed</dt><dd>{data.today.listed}</dd></div>
          <div><dt>Sold</dt><dd>{data.today.sold}</dd></div>
          <div><dt>Returns</dt><dd>{data.today.returns}</dd></div>
        </dl>
      </div>
    </div>
  )
}

/** Six stages, one bar: how much is in each, in proportion. */
function Pipeline({ data }: { data: StaffHome }) {
  const total = data.pipeline.reduce((n, s) => n + s.count, 0) || 1
  return (
    <section className="sh__pipe" aria-label="Where every unit is">
      <div className="sh__bar" role="img" aria-label={data.pipeline.map((s) => `${s.label} ${s.count}`).join(', ')}>
        {data.pipeline.map((s) => (
          <span key={s.key} className={`sh__seg sh__seg--${s.tone}`} style={{ flexGrow: Math.max(s.count, total * 0.03) }} />
        ))}
      </div>
      <ul className="sh__legend">
        {data.pipeline.map((s) => (
          <li key={s.key}>
            <span className={`sh__swatch sh__seg--${s.tone}`} aria-hidden="true" />
            <span className="sh__legend-count">{s.count}</span>
            <span className="sh__legend-label">{s.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Seven days of units received, put on sale and sold: bars, no axes, the numbers are on them. */
function Week({ data }: { data: StaffHome }) {
  const max = Math.max(1, ...data.last7.flatMap((d) => [d.received, d.listed, d.sold]))
  const dayName = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })
  return (
    <section className="sh__card" aria-labelledby="sh-week">
      <h2 id="sh-week" className="sh__h2">Last 7 days</h2>
      <div className="sh__week">
        {data.last7.map((d) => (
          <div key={d.day} className="sh__day" title={`${d.day}: ${d.received} received, ${d.listed} listed, ${d.sold} sold`}>
            <div className="sh__bars">
              <span className="sh__b sh__b--received" style={{ height: `${(d.received / max) * 100}%` }} />
              <span className="sh__b sh__b--listed" style={{ height: `${(d.listed / max) * 100}%` }} />
              <span className="sh__b sh__b--sold" style={{ height: `${(d.sold / max) * 100}%` }} />
            </div>
            <span className="sh__day-name">{dayName(d.day)}</span>
          </div>
        ))}
      </div>
      <ul className="sh__key">
        <li><span className="sh__swatch sh__b--received" aria-hidden="true" />Received</li>
        <li><span className="sh__swatch sh__b--listed" aria-hidden="true" />Listed</li>
        <li><span className="sh__swatch sh__b--sold" aria-hidden="true" />Sold</li>
      </ul>
    </section>
  )
}
