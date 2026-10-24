import { Link } from 'react-router-dom'
import { api, money, relative, STATE_LABELS, useApi, useSession, type StaffHome } from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import '../components/dashboard.css'
import { ModelPhoto } from '../components/ModelPhoto'

const GROUPS = ['Intake', 'Workshop', 'Orders', 'Returns', 'People', 'Money'] as const
const GROUP_ICON: Record<(typeof GROUPS)[number], string> = {
  Intake: '📦', Workshop: '🔧', Orders: '🚚', Returns: '↩️', People: '👤', Money: '💸',
}

/**
 * Where staff land — a single, categorised control room.
 *
 * It answers four questions in one glance, top to bottom: KPI tiles (with a
 * week-long trend line) for "how are we doing", one bar for "where is
 * everything", a two-column body with an urgent zone and a work queue grouped by
 * area for "what is waiting on me", and a timeline for "what just moved".
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
    <div className="dash">
      <header className="dash__head">
        <div>
          <h1 className="dash__title">{greeting()}{first ? `, ${first}` : ''}</h1>
          <p className="dash__date">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <p className={`dash__pill${waiting === 0 ? ' dash__pill--clear' : ''}`}>
          {waiting === 0 ? 'Nothing is waiting on you' : `${waiting} thing${waiting === 1 ? '' : 's'} need you`}
        </p>
      </header>

      <Kpis data={data} />
      <Pipeline data={data} />

      <div className="dash__cols">
        <div className="dash__main">
          {urgent.length > 0 && (
            <section aria-labelledby="dash-urgent">
              <h2 id="dash-urgent" className="dash__sec">Needs you first</h2>
              <div className="dash__urgent">
                {urgent.map((a) => (
                  <Link key={a.key} to={a.href} className="dash__hot">
                    <span className="dash__hot-c">{a.count}</span>
                    <span className="dash__hot-b">
                      <strong>{a.title}</strong>
                      <span>{a.hint}</span>
                    </span>
                    <span className="dash__go" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="dash-queue">
            <h2 id="dash-queue" className="dash__sec">Work queue</h2>
            {rest.length === 0 && urgent.length === 0 ? (
              <div className="dash__card dash__qempty">
                <strong>All clear.</strong> No submissions, orders, returns or checks are waiting. New work appears here as it arrives.
              </div>
            ) : (
              <div className="dash__queue">
                {GROUPS.map((g) => {
                  const items = rest.filter((a) => a.group === g)
                  if (items.length === 0) return null
                  return (
                    <div key={g} className="dash__qcard">
                      <div className="dash__qhead">
                        <span className="dash__qicon" aria-hidden="true">{GROUP_ICON[g]}</span>
                        <h3>{g}</h3>
                      </div>
                      {items.map((a) => (
                        <Link key={a.key} to={a.href} className="dash__qrow">
                          <span className="dash__qrow-c">{a.count}</span>
                          <span>
                            <span className="dash__qrow-t">{a.title}</span>
                            <span className="dash__qrow-h">{a.hint}</span>
                          </span>
                          {a.tone === 'urgent' && <span className="dash__badge">urgent</span>}
                        </Link>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="dash__side">
          <section className="dash__card" aria-labelledby="dash-recent">
            <span className="dash__eyebrow" id="dash-recent">Just moved</span>
            <ul className="dash__feed">
              {data.recent.length === 0 && <li className="dash__qempty">Nothing has moved yet.</li>}
              {data.recent.map((r) => (
                <li key={r.itemId}>
                  <Link to={`/items/${r.itemId}`}>
                    <span className={`dash__dot dash__dot--${dotFor(r.toState)}`} aria-hidden="true" />
                    <ModelPhoto slug={r.modelSlug} kind="gear" size="mini" alt="" />
                    <span className="dash__feed-body">
                      <span className="dash__feed-title">
                        {r.title}
                        {r.grade && <span className="dash__grade">{r.grade}</span>}
                      </span>
                      <span className="dash__feed-meta">
                        <span className="tg-mono">{r.sku}</span> · {STATE_LABELS[r.toState] ?? r.toState}
                        {r.priceMinor != null && ['LISTED', 'SOLD', 'DISPATCHED', 'DELIVERED', 'ACCEPTED'].includes(r.toState) && ` · ${money(r.priceMinor)}`}
                      </span>
                    </span>
                    <time className="dash__feed-time" dateTime={r.at ?? undefined}>{relative(r.at)}</time>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/admin/inventory" className="dash__more">See all inventory →</Link>
          </section>

          <section className="dash__card" aria-labelledby="dash-week">
            <span className="dash__eyebrow" id="dash-week">This week</span>
            <ul className="dash__mini">
              <li><b>{sum(data, 'received')}</b><span>Received</span></li>
              <li><b>{sum(data, 'listed')}</b><span>Listed</span></li>
              <li><b>{sum(data, 'sold')}</b><span>Sold</span></li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function sum(data: StaffHome, key: 'received' | 'listed' | 'sold') {
  return data.last7.reduce((n, d) => n + d[key], 0)
}

/** The state an item has just reached, as a colour: moving forward, selling, or going wrong. */
function dotFor(state: string): string {
  if (['LISTED', 'SOLD', 'ACCEPTED', 'DELIVERED', 'DISPATCHED'].includes(state)) return 'good'
  if (['INSPECTION_FAILED', 'QUARANTINED', 'RETURN_REQUESTED', 'RETURN_REJECTED', 'SELLER_DECLINED', 'REJECTED_PRE_INTAKE', 'RETURN_TO_SELLER'].includes(state)) return 'bad'
  if (['AWAITING_SELLER_APPROVAL', 'RESERVED', 'UNSOLD_REVIEW', 'AWAITING_INSPECTION'].includes(state)) return 'warn'
  return 'plain'
}

/** A tiny trend line, 72×26, no axes — the shape of the week, not the numbers. */
function Spark({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null
  const w = 72, h = 26, pad = 3
  const max = Math.max(...values), min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = pad + (1 - (v - min) / span) * (h - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className="dash__kpi-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  )
}

function Kpis({ data }: { data: StaffHome }) {
  const t = data.totals
  const listed = data.last7.map((d) => d.listed)
  const sold = data.last7.map((d) => d.sold)
  const received = data.last7.map((d) => d.received)
  return (
    <div className="dash__kpis">
      <div className="dash__card dash__kpi dash__kpi--lead">
        <span className="dash__kpi-lab">On sale now</span>
        <span className="dash__kpi-val">{t.onSaleCount}</span>
        <span className="dash__kpi-note">{money(t.onSaleValueMinor)} of stock</span>
        <Spark values={listed} stroke="var(--tg-accent)" />
      </div>
      <div className="dash__card dash__kpi">
        <span className="dash__kpi-lab">Sold · last 7 days</span>
        <span className="dash__kpi-val">{t.soldWeekCount}</span>
        <span className="dash__kpi-note">{money(t.soldWeekValueMinor)}</span>
        <Spark values={sold} stroke="var(--tg-good)" />
      </div>
      <div className="dash__card dash__kpi">
        <span className="dash__kpi-lab">Units on the platform</span>
        <span className="dash__kpi-val">{t.units}</span>
        <span className="dash__kpi-note">everything ever taken in</span>
        <Spark values={received} stroke="var(--tg-text-muted)" />
      </div>
      <div className="dash__card dash__kpi">
        <span className="dash__kpi-lab">Today</span>
        <dl className="dash__today">
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
    <section className="dash__card" aria-label="Where every unit is">
      <span className="dash__eyebrow">Where every unit is</span>
      <div className="dash__bar" role="img" aria-label={data.pipeline.map((s) => `${s.label} ${s.count}`).join(', ')}>
        {data.pipeline.map((s) => (
          <span key={s.key} className={`dash__seg dash__seg--${s.tone}`} style={{ flexGrow: Math.max(s.count, total * 0.03) }} />
        ))}
      </div>
      <ul className="dash__legend">
        {data.pipeline.map((s) => (
          <li key={s.key}>
            <span className={`dash__swatch dash__seg--${s.tone}`} aria-hidden="true" />
            <b>{s.count}</b> {s.label}
          </li>
        ))}
      </ul>
    </section>
  )
}
