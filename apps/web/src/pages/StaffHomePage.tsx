import { Link, useNavigate } from 'react-router-dom'
import { money, relative, STATE_LABELS, useSession, type StaffHome } from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import { ModelPhoto } from '../components/ModelPhoto'
import { Icon, ICONS } from '../components/StaffShell'
import { useConsoleTitle, useStaffHome } from '../components/consoleTitle'
import './StaffHomePage.css'

type Action = StaffHome['actions'][number]

/**
 * The Control room (TG-126), in the admin template's dashboard layout.
 *
 * Every number on it is a door: click it and the list it counted opens,
 * filtered to exactly those rows. That holds because each link is built from
 * the same rule the number was counted with - a state list, an id list, a
 * sold-in window - and the list applies that rule to its own data rather than
 * approximating it with the nearest tab.
 */
export function StaffHomePage() {
  const { session } = useSession()
  const { data, error, loading, reload } = useStaffHome(true, true)
  const first = (session?.displayName ?? '').split(' ')[0]
  const waiting = (data?.actions ?? []).filter((a) => a.tone !== 'quiet').reduce((n, a) => n + a.count, 0)
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  useConsoleTitle(
    `${greeting()}${first ? `, ${first}` : ''}`,
    data ? `${today} · ${waiting === 0 ? 'Nothing is waiting on you' : `${waiting} thing${waiting === 1 ? '' : 's'} need you`}` : today,
  )

  if (loading && !data) return <Loading label="Loading your day" />
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />
  if (!data) return null

  const t = data.totals
  const dispatch = data.actions.find((a) => a.key === 'to_dispatch')
  const urgent = data.actions.filter((a) => a.tone === 'urgent')
  const needs = [...urgent, ...data.actions.filter((a) => a.tone === 'normal')].slice(0, 4)

  return (
    <div className="c-stack home">
      <section className="c-grid c-grid--dash" aria-label="Headline figures">
        <SalesChart months={data.months ?? []} />
        <Kpi to={inv('On sale now', ['LISTED', 'RESERVED'])} icon={ICONS.tag} title="On sale now"
          value={t.onSaleCount} note={`${money(t.onSaleValueMinor)} of stock`} spark={data.last7.map((d) => d.listed)} />
        <Kpi to="/admin/inventory?sold=7d&label=Sold+in+the+last+7+days" icon={ICONS.rupee} tone="cta" title="Sold · last 7 days"
          value={t.soldWeekCount} note={money(t.soldWeekValueMinor)} spark={data.last7.map((d) => d.sold)} />
        <Kpi to="/admin/inventory" icon={ICONS.camera} tone="good" title="Units on the platform"
          value={t.units} note="Everything ever taken in" spark={data.last7.map((d) => d.received)} />
        <Kpi to="/admin/fulfilment?tab=open" icon={ICONS.fulfilment} tone={dispatch?.count ? 'bad' : undefined} title="Orders to dispatch"
          value={dispatch?.count ?? 0} note={dispatch?.count ? 'Paid; pack and hand to the courier' : 'Nothing waiting to go out'} />
      </section>

      <section className="c-grid c-grid--3">
        <div className="c-card">
          <div className="c-card__head"><h2>Needs you first</h2>{urgent.length > 0 && <span className="c-pill c-pill--bad">{urgent.length} urgent</span>}</div>
          {needs.length === 0
            ? <p className="c-empty"><b>All clear.</b> New work appears here as it arrives.</p>
            : needs.map((a) => (
              <Link key={a.key} to={staffHref(a)} className={`c-task${a.tone === 'urgent' ? ' c-task--hot' : ''}`}>
                <span className="c-task__n">{a.count}</span>
                <span className="c-task__body"><b>{a.title}</b><span>{a.hint}</span></span>
                <span className="c-task__go"><Icon d={ICONS.arrow} /></span>
              </Link>
            ))}
        </div>

        <div className="c-card">
          <div className="c-card__head"><h2>Just moved</h2><Link to="/admin/inventory" className="c-link">All inventory</Link></div>
          <div className="c-rows">
            {data.recent.length === 0 && <p className="c-empty">Nothing has moved yet.</p>}
            {data.recent.slice(0, 5).map((r) => (
              <Link key={r.itemId} to={`/items/${r.itemId}`} className="c-row">
                <span className="c-thumb"><ModelPhoto slug={r.modelSlug} kind="gear" size="mini" alt="" badge={false} /></span>
                <span className="c-row__main">
                  <span className="c-row__title">{r.title}</span>
                  <span className="c-row__meta">
                    {r.sku} · {STATE_LABELS[r.toState] ?? r.toState}
                    {r.priceMinor != null && ['LISTED', 'SOLD', 'DISPATCHED', 'DELIVERED', 'ACCEPTED'].includes(r.toState) && ` · ${money(r.priceMinor)}`}
                  </span>
                </span>
                <span className="home__moved-side">
                  {r.grade && <span className="c-chip">{r.grade}</span>}
                  <time className="c-row__side" dateTime={r.at ?? undefined}>{relative(r.at)}</time>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <Pipeline data={data} />
      </section>

      <section className="c-grid c-grid--2">
        <RecentOrders orders={data.recentOrders ?? []} />
        <div className="c-card">
          <div className="c-card__head"><h2>Work queue</h2><span className="c-card__note">{data.actions.length} queue{data.actions.length === 1 ? '' : 's'} with work</span></div>
          {data.actions.length === 0
            ? <p className="c-empty"><b>All clear.</b> No submissions, orders, returns or checks are waiting.</p>
            : <div className="c-rows">
              {GROUPS.filter((g) => data.actions.some((a) => a.group === g.name)).map((g) => (
                <div key={g.name}>
                  <div className="c-group">{g.name}</div>
                  {data.actions.filter((a) => a.group === g.name).map((a) => (
                    <Link key={a.key} to={staffHref(a)} className="c-row home__q">
                      <span className={`c-tile c-tile--${g.tone} home__qtile`}><Icon d={g.icon} /></span>
                      <span className="c-row__main">
                        <span className="c-row__title">{a.title}</span>
                        <span className="c-row__meta">{a.hint}</span>
                      </span>
                      {a.tone === 'urgent' && <span className="c-pill c-pill--bad">urgent</span>}
                      <span className="c-chip">{a.count}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>}
        </div>
      </section>
    </div>
  )
}

const GROUPS: { name: string; icon: string; tone: string }[] = [
  { name: 'Intake', icon: ICONS.inventory, tone: 'navy' },
  { name: 'Workshop', icon: ICONS.operations, tone: 'cta' },
  { name: 'Orders', icon: ICONS.fulfilment, tone: 'good' },
  { name: 'Returns', icon: ICONS.returns, tone: 'bad' },
  { name: 'People', icon: ICONS.people, tone: 'navy' },
  { name: 'Money', icon: ICONS.money, tone: 'warn' },
]

/** An Inventory link for an exact list of states, labelled for the "Showing …" line. */
function inv(label: string, states: string[]): string {
  return `/admin/inventory?state=${states.join(',')}&label=${encodeURIComponent(label)}`
}

// Where each queue lives, for an API that still sends the pre-console paths.
const LEGACY: Record<string, string> = {
  '/ops': '/admin/operations', '/inventory': '/admin/inventory', '/fulfilment': '/admin/fulfilment',
  '/returns': '/admin/returns', '/people': '/admin/people', '/admin': '/admin/money',
}
function staffHref(a: Action): string {
  const [path, rest] = a.href.split(/(?=[?#])/)
  return (LEGACY[path] ?? path) + (rest ?? '')
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** A small trend line with no axes: the shape of the week, not the numbers. */
function Spark({ values, stroke = 'var(--tg-brand)' }: { values: number[]; stroke?: string }) {
  if (values.length < 2) return null
  const w = 72, h = 26, pad = 3
  const max = Math.max(...values), min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(pad + (1 - (v - min) / span) * (h - 2 * pad)).toFixed(1)}`).join(' ')
  return (
    <svg className="c-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  )
}

function Kpi({ to, icon, tone, title, value, note, spark }: {
  to: string; icon: string; tone?: 'cta' | 'good' | 'bad'; title: string; value: number; note: string; spark?: number[]
}) {
  return (
    <Link to={to} className="c-card c-hit" aria-label={`${title}: ${value}. ${note}. Open the list.`}>
      <div className="c-kpi__top">
        <span className={`c-tile${tone ? ` c-tile--${tone}` : ''}`}><Icon d={icon} /></span>
        <span className="c-kpi__title">{title}</span>
        <span className="c-kpi__go"><Icon d={ICONS.arrow} /></span>
      </div>
      <div className="c-kpi__num">{value}</div>
      <div className="c-kpi__foot"><span>{note}</span>{spark && <Spark values={spark} />}</div>
    </Link>
  )
}

/** Twelve months of units sold; each bar opens the units sold that month. */
function SalesChart({ months }: { months: NonNullable<StaffHome['months']> }) {
  const nav = useNavigate()
  const W = 520, H = 330, top = 14, bot = 28, left = 30
  const max = Math.max(4, ...months.map((m) => m.units))
  const step = niceStep(max)
  const ceil = Math.ceil(max / step) * step
  const bw = months.length ? (W - left) / months.length : 0
  const cur = months[months.length - 1]
  const prev = months[months.length - 2]
  const change = prev && prev.units > 0 && cur ? Math.round(((cur.units - prev.units) / prev.units) * 100) : null
  const monthName = (m: string, style: 'short' | 'long' = 'short') =>
    new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' })
  const open = (m: string) => nav(`/admin/inventory?sold=${m}&label=${encodeURIComponent(`Sold in ${monthName(m, 'long')}`)}`)

  return (
    <div className="c-card c-span2 home__chart">
      <div className="c-card__head"><h2>Units sold</h2><span className="c-card__note"><b>Last 12 months</b> · click a month</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label="Units sold per month">
        {Array.from({ length: ceil / step + 1 }, (_, i) => i * step).map((g) => {
          const y = top + (H - top - bot) * (1 - g / ceil)
          return (
            <g key={g}>
              <line x1={left} x2={W} y1={y} y2={y} className="home__grid" />
              <text x={left - 8} y={y + 4} textAnchor="end" className="home__axis">{g}</text>
            </g>
          )
        })}
        {months.map((m, i) => {
          const h = ((H - top - bot) * m.units) / ceil
          const x = left + i * bw + bw * 0.2
          const last = i === months.length - 1
          const recent = i >= months.length - 3
          return (
            <g key={m.month} className="home__bar" role="link" tabIndex={0}
              aria-label={`${monthName(m.month, 'long')}: ${m.units} sold, ${money(m.valueMinor)}. Open the list.`}
              onClick={() => open(m.month)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(m.month) } }}>
              <title>{`${monthName(m.month, 'long')}: ${m.units} sold · ${money(m.valueMinor)}`}</title>
              <rect x={left + i * bw} y={top} width={bw} height={H - top - bot} fill="transparent" />
              {m.units > 0
                ? <rect x={x} y={H - bot - h} width={bw * 0.6} height={h} rx={6} className={last ? 'home__bar-now' : recent ? 'home__bar-recent' : 'home__bar-old'} />
                : <rect x={x} y={H - bot - 3} width={bw * 0.6} height={3} rx={1.5} className="home__bar-zero" />}
              <text x={x + bw * 0.3} y={H - 9} textAnchor="middle" className="home__axis">{monthName(m.month)}</text>
            </g>
          )
        })}
      </svg>
      {cur && (
        <div className="c-kpi__foot">
          <span>{cur.units} sold in {monthName(cur.month, 'long')} · <b className="home__strong">{money(cur.valueMinor)}</b></span>
          {change !== null && <span className={`c-delta ${change >= 0 ? 'c-delta--up' : 'c-delta--down'}`}>{change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs {monthName(prev.month)}</span>}
        </div>
      )}
    </div>
  )
}

function niceStep(max: number): number {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]) if (max / s <= 5) return s
  return 1000
}

const TONE_COLOR: Record<string, string> = {
  inbound: 'var(--c-navy-tint)', workshop: 'var(--tg-cta)', sale: 'var(--tg-brand)',
  shipping: '#5d7f95', returns: 'var(--tg-bad)', done: '#9fb3c0', other: 'var(--tg-warn)',
}

/** Where every unit is, as a ring; each slice and legend row opens those units. */
function Pipeline({ data }: { data: StaffHome }) {
  const nav = useNavigate()
  const stages = data.pipeline
  const total = stages.reduce((n, s) => n + s.count, 0)
  const R = 74, r = 52, cx = 90, cy = 90
  const gap = stages.filter((s) => s.count).length > 1 ? 0.035 : 0
  let a = -Math.PI / 2
  const P = (rr: number, t: number) => `${(cx + rr * Math.cos(t)).toFixed(2)},${(cy + rr * Math.sin(t)).toFixed(2)}`
  const href = (s: StaffHome['pipeline'][number]) => inv(s.label, s.states ?? [])

  return (
    <div className="c-card">
      <div className="c-card__head"><h2>Where every unit is</h2><span className="c-card__note">Now</span></div>
      <svg viewBox="0 0 180 180" className="home__ring" role="group" aria-label="Units by stage">
        {total === 0 && <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke="var(--c-line-soft)" strokeWidth={R - r} />}
        {stages.filter((s) => s.count > 0).map((s) => {
          const sweep = (s.count / total) * Math.PI * 2
          const whole = sweep >= Math.PI * 2 - 0.001
          const b = a + sweep - gap
          const large = b - a > Math.PI ? 1 : 0
          const d = whole
            ? `M${P(R, -Math.PI / 2)} A${R},${R} 0 1 1 ${P(R, Math.PI * 1.5 - 0.001)} L${P(r, Math.PI * 1.5 - 0.001)} A${r},${r} 0 1 0 ${P(r, -Math.PI / 2)}Z`
            : `M${P(R, a)} A${R},${R} 0 ${large} 1 ${P(R, b)} L${P(r, b)} A${r},${r} 0 ${large} 0 ${P(r, a)}Z`
          a += sweep
          return (
            <path key={s.key} d={d} fill={TONE_COLOR[s.tone] ?? 'var(--tg-text-muted)'} className="home__slice" role="link" tabIndex={0}
              aria-label={`${s.label}: ${s.count}. Open the list.`} onClick={() => nav(href(s))}
              onKeyDown={(e) => { if (e.key === 'Enter') nav(href(s)) }}>
              <title>{`${s.label}: ${s.count}`}</title>
            </path>
          )
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="home__ring-lab">Units</text>
        <text x={cx} y={cy + 18} textAnchor="middle" className="home__ring-num">{total}</text>
      </svg>
      <ul className="c-legend">
        {stages.filter((s) => s.key !== 'other' || s.count > 0).map((s) => (
          <li key={s.key}>
            <Link to={href(s)}><i style={{ background: TONE_COLOR[s.tone] ?? 'var(--tg-text-muted)' }} />{s.label}<b>{s.count}</b></Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

type RecentOrder = NonNullable<StaffHome['recentOrders']>[number]

/** Where an order is worked from, for a row in Recent orders. */
function orderHref(o: RecentOrder): string | null {
  const q = `&q=${encodeURIComponent(o.orderNumber)}`
  const s = o.lineStates
  if (s.includes('return_requested')) return `/admin/returns?tab=requested${q}`
  if (s.some((x) => x === 'open' || x === 'packing')) return `/admin/fulfilment?tab=open${q}`
  if (s.includes('dispatched')) return `/admin/fulfilment?tab=dispatched${q}`
  if (s.includes('delivered')) return `/admin/fulfilment?tab=delivered${q}`
  if (s.includes('accepted')) return `/admin/fulfilment?tab=closed${q}`
  return null
}

function orderStatus(o: RecentOrder): [string, string] {
  const s = o.lineStates
  if (o.state === 'cancelled') return ['Cancelled', 'bad']
  if (s.includes('return_requested')) return ['Return requested', 'bad']
  if (s.some((x) => x === 'open' || x === 'packing')) return ['Paid · to pack', 'warn']
  if (s.includes('dispatched')) return ['Dispatched', 'navy']
  if (s.includes('delivered')) return ['Delivered', 'good']
  if (s.includes('accepted') || o.state === 'completed') return ['Completed', 'good']
  return [o.state.replace(/_/g, ' '), '']
}

function RecentOrders({ orders }: { orders: RecentOrder[] }) {
  const nav = useNavigate()
  return (
    <div className="c-card">
      <div className="c-card__head"><h2>Recent orders</h2><Link to="/admin/fulfilment" className="c-link">All orders</Link></div>
      {orders.length === 0 ? <p className="c-empty">No orders yet.</p> : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead><tr><th>Order</th><th>Buyer</th><th>Placed</th><th className="c-num">Total</th><th>Status</th></tr></thead>
            <tbody>
              {orders.map((o, i) => {
                const to = orderHref(o)
                const [label, tone] = orderStatus(o)
                return (
                  <tr key={o.id} className={to ? 'c-clickable' : undefined} onClick={to ? () => nav(to) : undefined}>
                    <td>{to ? <Link to={to} className="home__order" onClick={(e) => e.stopPropagation()}>{o.orderNumber}</Link> : <b>{o.orderNumber}</b>}</td>
                    <td><span className="c-who"><span className={`c-av c-av--${i % 4}`}>{initials(o.buyerName)}</span>{o.buyerName ?? '—'}</span></td>
                    <td className="tg-muted">{o.at ? new Date(o.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td className="c-num">{money(o.totalMinor)}</td>
                    <td><span className={`c-pill${tone ? ` c-pill--${tone}` : ''}`}>{label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function initials(name: string | null): string {
  const p = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}
