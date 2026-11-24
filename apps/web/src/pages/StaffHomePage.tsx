import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, money, relative, STATE_LABELS, useApi, useSession, type InspectionSla, type SalesPoint, type StaffHome } from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import { ModelPhoto } from '../components/ModelPhoto'
import { Icon, ICONS, staffHref } from '../components/StaffShell'
import { PageHead } from '../components/PageHead'
import { useStaffHome } from '../components/consoleTitle'
import './StaffHomePage.css'

/**
 * The Control room (TG-126; redesigned in TG-197 on the approved template).
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
  const insights = useApi(() => api.staffInsights(), [])
  const [period, setPeriod] = useState<'this' | 'last'>('this')
  const first = (session?.displayName ?? '').split(' ')[0]
  const waiting = (data?.actions ?? []).filter((a) => a.tone !== 'quiet').reduce((n, a) => n + a.count, 0)
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const months = insights.data?.months ?? []

  const head = (
    <PageHead
      title={`${greeting()}${first ? `, ${first}` : ''}`}
      subtitle={data ? `${today} · ${waiting === 0 ? 'Nothing is waiting on the team' : `${waiting} task${waiting === 1 ? '' : 's'} waiting across the team`}` : today}
      actions={<>
        <label className="tg-visually-hidden" htmlFor="home-period">Figures for</label>
        <select id="home-period" className="c-btn home__period" value={period} onChange={(e) => setPeriod(e.target.value as 'this' | 'last')}>
          <option value="this">This month</option>
          <option value="last">Last month</option>
        </select>
        <button type="button" className="c-btn" disabled={months.length === 0} onClick={() => exportCsv(months, insights.data?.weeks ?? [])}>
          <Icon d={ICONS.export} /> Export
        </button>
      </>}
    />
  )

  if (loading && !data) return <>{head}<Loading label="Loading your day" /></>
  if (error && !data) return <>{head}<ErrorNote error={error} onRetry={reload} /></>
  if (!data) return null

  const t = data.totals
  const dispatch = data.actions.find((a) => a.key === 'to_dispatch')
  // The month the cards read, and the one they compare with.
  const cur = months[months.length - (period === 'this' ? 1 : 2)]
  const prev = months[months.length - (period === 'this' ? 2 : 3)]
  const monthLabel = (m?: SalesPoint, style: 'short' | 'long' = 'short') => m ? monthName(m.period, style) : ''
  const listedWeek = data.last7.reduce((n, d) => n + d.listed, 0)

  return (
    <div className="c-stack home">
      {head}
      <section className="c-kpis" aria-label="Headline figures">
        <Kpi to={cur ? soldHref(cur.period, 'month') : '/admin/inventory'} icon={ICONS.rupee} on title={period === 'this' ? 'Sales this month' : `Sales in ${monthLabel(cur, 'long')}`}
          value={cur ? money(cur.salesMinor) : '—'} chip={<Delta cur={cur?.salesMinor} prev={prev?.salesMinor} />} note={prev ? `vs ${monthLabel(prev)}` : ''} />
        <Kpi to={cur ? soldHref(cur.period, 'month') : '/admin/inventory'} icon={ICONS.bag} title="Units sold"
          value={cur ? String(cur.units) : '—'} chip={<Delta cur={cur?.units} prev={prev?.units} />} note={prev ? `vs ${monthLabel(prev)}` : ''} />
        <Kpi to={inv('On sale now', ['LISTED', 'RESERVED'])} icon={ICONS.tag} title="On sale now"
          value={String(t.onSaleCount)} chip={<span className="c-chip2 c-chip2--good"><Icon d={ICONS.up} /> {listedWeek} this week</span>} note={`${money(t.onSaleValueMinor)} of stock`} />
        <Kpi to="/admin/fulfilment?tab=open" icon={ICONS.fulfilment} title="Orders to dispatch"
          value={String(dispatch?.count ?? 0)}
          chip={dispatch?.count ? <span className="c-chip2 c-chip2--warn"><Icon d={ICONS.clock} /> To pack</span> : <span className="c-chip2 c-chip2--good"><Icon d={ICONS.check} /> All sent</span>}
          note={dispatch?.count ? 'paid; hand to the courier' : 'nothing waiting to go out'} />
      </section>

      <section className="home__row2">
        {insights.error && !insights.data
          ? <div className="c-card"><ErrorNote error={insights.error} onRetry={insights.reload} /></div>
          : <SalesInsights months={months} weeks={insights.data?.weeks ?? []} loading={insights.loading} />}
        <SlaGauge sla={insights.data?.inspection ?? null} />
      </section>

      <RecentOrders orders={data.recentOrders ?? []} />

      <section className="c-grid c-grid--3">
        <div className="c-card">
          <div className="c-card__head"><h2>Work queue</h2><span className="c-card__note">{data.actions.length} queue{data.actions.length === 1 ? '' : 's'} with work</span></div>
          {data.actions.length === 0
            ? <p className="c-empty"><b>All clear.</b> No submissions, orders, returns or checks are waiting.</p>
            : <div className="c-rows">
              {GROUPS.filter((g) => data.actions.some((a) => a.group === g.name)).map((g) => (
                <div key={g.name}>
                  <div className="c-group">{g.name}</div>
                  {data.actions.filter((a) => a.group === g.name).map((a) => (
                    <Link key={a.key} to={staffHref(a.href)} className="c-row home__q">
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

        <div className="c-card">
          <div className="c-card__head"><h2>Just moved</h2><Link to="/admin/inventory" className="c-link">All inventory</Link></div>
          <div className="c-rows">
            {data.recent.length === 0 && <p className="c-empty">Nothing has moved yet.</p>}
            {data.recent.slice(0, 6).map((r) => (
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
    </div>
  )
}

/** Month or week name for a period key: "2026-11" or "2026-11-23" (a Monday). */
function monthName(period: string, style: 'short' | 'long' = 'short'): string {
  const d = new Date(`${period.length === 7 ? `${period}-01` : period}T00:00:00`)
  return style === 'short' ? d.toLocaleDateString('en-IN', { month: 'short' }) : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
function weekName(period: string): string {
  return new Date(`${period}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
function soldHref(period: string, unit: 'month' | 'week'): string {
  const label = unit === 'month' ? `Sold in ${monthName(period, 'long')}` : `Sold in the week of ${weekName(period)}`
  return `/admin/inventory?sold=${period}&label=${encodeURIComponent(label)}`
}

/** ₹ in the shortest honest form for an axis: ₹0, ₹40k, ₹5L, ₹1.2Cr. */
function compactInr(minor: number): string {
  const r = minor / 100
  if (r >= 1e7) return `₹${+(r / 1e7).toFixed(1)}Cr`
  if (r >= 1e5) return `₹${+(r / 1e5).toFixed(1)}L`
  if (r >= 1e3) return `₹${Math.round(r / 1e3)}k`
  return `₹${Math.round(r)}`
}

/** The change from one period to the last, as a chip: green up, red down. */
function Delta({ cur, prev }: { cur?: number; prev?: number }) {
  if (cur == null || prev == null) return null
  if (prev === 0 && cur === 0) return <span className="c-chip2">No change</span>
  if (prev === 0) return <span className="c-chip2 c-chip2--good"><Icon d={ICONS.up} /> New</span>
  const pct = Math.round(((cur - prev) / prev) * 1000) / 10
  const up = pct >= 0
  return (
    <span className={`c-chip2 c-chip2--${up ? 'good' : 'bad'}`}>
      <span className={up ? undefined : 'home__down'}><Icon d={ICONS.up} /></span>
      <span className="tg-visually-hidden">{up ? 'up' : 'down'} </span>{Math.abs(pct)}%
    </span>
  )
}

function Kpi({ to, icon, on, title, value, chip, note }: {
  to: string; icon: string; on?: boolean; title: string; value: string; chip?: ReactNode; note: string
}) {
  return (
    // Named by what it shows (TG-163): the words on screen are its name.
    <Link to={to} className="c-card c-hit c-kpi2">
      <span className="c-kpi2__t">
        <span className={`c-kpi2__ico${on ? ' c-kpi2__ico--on' : ''}`}><Icon d={icon} /></span>
        {title}
        <span className="c-kpi2__info c-kpi__go"><Icon d={ICONS.arrow} /></span>
      </span>
      <span className="c-kpi2__v">{value}</span>
      <span className="c-kpi2__f">{chip}<span>{note}</span></span>
      <span className="tg-visually-hidden"> Open the list.</span>
    </Link>
  )
}

/**
 * Sales by month or by week (TG-197): striped bars, the current period lit in
 * orange with its value over it; commission as a navy line and refunds as a
 * small bar beside, for administrators. A bar opens what sold in it.
 */
function SalesInsights({ months, weeks, loading }: { months: SalesPoint[]; weeks: SalesPoint[]; loading: boolean }) {
  const nav = useNavigate()
  const [unit, setUnit] = useState<'month' | 'week'>('month')
  const pts = unit === 'month' ? months : weeks
  const [focus, setFocus] = useState<number | null>(null)
  const admin = pts.some((p) => p.commissionMinor != null)
  const lit = focus ?? pts.length - 1
  const cur = pts[pts.length - 1]
  const prev = pts[pts.length - 2]
  const label = (p: SalesPoint) => (unit === 'month' ? monthName(p.period) : weekName(p.period))
  const longLabel = (p: SalesPoint) => (unit === 'month' ? monthName(p.period, 'long') : `the week of ${weekName(p.period)}`)

  const W = 720, H = 250, top = 36, bot = 30, left = 52
  const max = Math.max(1, ...pts.map((p) => Math.max(p.salesMinor, p.commissionMinor ?? 0)))
  const step = niceMoneyStep(max)
  const ceil = Math.max(step, Math.ceil(max / step) * step)
  const y = (v: number) => top + (H - top - bot) * (1 - v / ceil)
  const bw = pts.length ? (W - left) / pts.length : 0
  const barW = Math.min(34, bw * 0.55)
  const cx = (i: number) => left + i * bw + bw / 2
  const open = (p: SalesPoint) => nav(soldHref(p.period, unit))
  const line = admin ? pts.map((p, i) => `${cx(i).toFixed(1)},${y(p.commissionMinor ?? 0).toFixed(1)}`).join(' ') : ''

  return (
    <div className="c-card home__chart">
      <div className="c-card__head">
        <h2>Sales insights</h2>
        <div className="home__seg" role="group" aria-label="Show sales by">
          <button type="button" aria-pressed={unit === 'week'} onClick={() => { setUnit('week'); setFocus(null) }}>Weekly</button>
          <button type="button" aria-pressed={unit === 'month'} onClick={() => { setUnit('month'); setFocus(null) }}>Monthly</button>
        </div>
      </div>
      <div className="home__big">
        <span className="home__bignum">{cur ? money(cur.salesMinor) : '—'}</span>
        {cur && prev && <Delta cur={cur.salesMinor} prev={prev.salesMinor} />}
        <span className="home__bigsub">{unit === 'month' ? 'this month' : 'this week'}</span>
        <ul className="home__legend" aria-label="Legend">
          <li><i className="home__key home__key--sales" />Sales</li>
          {admin && <li><i className="home__key home__key--comm" />Commission</li>}
          {admin && <li><i className="home__key home__key--ref" />Refunds</li>}
        </ul>
      </div>
      {loading && pts.length === 0 ? <Loading label="Loading sales" /> : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label={`Sales per ${unit}`} className="home__svg">
          <defs>
            <pattern id="home-stripes" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" className="home__stripe-bg" />
              <line x1="0" y1="0" x2="0" y2="7" className="home__stripe" strokeWidth="3" />
            </pattern>
            <linearGradient id="home-lit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--tg-cta)" />
              <stop offset="1" stopColor="var(--tg-cta)" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {Array.from({ length: Math.round(ceil / step) + 1 }, (_, i) => i * step).map((g) => (
            <g key={g} aria-hidden="true">
              <line x1={left} x2={W} y1={y(g)} y2={y(g)} className="home__grid" />
              <text x={left - 10} y={y(g) + 4} textAnchor="end" className="home__axis">{compactInr(g)}</text>
            </g>
          ))}
          {pts.map((p, i) => {
            const h = H - bot - y(p.salesMinor)
            const isLit = i === lit
            const x = cx(i) - barW / 2
            return (
              <g key={p.period} className="home__bar" role="link" tabIndex={0}
                aria-label={`${longLabel(p)}: ${money(p.salesMinor)} from ${p.units} sold${p.commissionMinor != null ? `, ${money(p.commissionMinor)} commission, ${money(p.refundsMinor ?? 0)} refunded` : ''}. Open the list.`}
                onMouseEnter={() => setFocus(i)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(i)} onBlur={() => setFocus(null)}
                onClick={() => open(p)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(p) } }}>
                <rect x={left + i * bw} y={top} width={bw} height={H - top - bot} fill="transparent" />
                {p.salesMinor > 0
                  ? <rect x={x} y={H - bot - h} width={barW} height={h} rx={barW / 2} fill={isLit ? 'url(#home-lit)' : 'url(#home-stripes)'} />
                  : <rect x={x} y={H - bot - 12} width={barW} height={12} rx={6} className="home__bar-empty" />}
                {admin && (p.refundsMinor ?? 0) > 0 && (
                  <rect x={x + barW + 2} y={y(p.refundsMinor ?? 0)} width={6} height={H - bot - y(p.refundsMinor ?? 0)} rx={3} className="home__refund" />
                )}
              </g>
            )
          })}
          {admin && <polyline points={line} fill="none" className="home__comm" aria-hidden="true" />}
          {admin && pts.map((p, i) => <circle key={p.period} cx={cx(i)} cy={y(p.commissionMinor ?? 0)} r={3} className="home__comm-dot" aria-hidden="true" />)}
          {pts[lit] && (() => {
            const p = pts[lit]
            const ty = Math.max(top - 30, y(p.salesMinor) - 40)
            const text = compactInr(p.salesMinor)
            const w = Math.max(64, text.length * 9 + 22)
            return (
              <g aria-hidden="true" pointerEvents="none">
                <rect x={cx(lit) - w / 2} y={ty} width={w} height={28} rx={8} className="home__tip" />
                <text x={cx(lit)} y={ty + 19} textAnchor="middle" className="home__tip-t">{text}</text>
                {p.salesMinor > 0 && <circle cx={cx(lit)} cy={y(p.salesMinor) + 4} r={6} className="home__tip-dot" />}
              </g>
            )
          })()}
          {pts.map((p, i) => (
            <text key={`l-${p.period}`} x={cx(i)} y={H - 8} textAnchor="middle" aria-hidden="true"
              className={`home__axis${i === lit ? ' home__axis--on' : ''}`}>{label(p)}</text>
          ))}
        </svg>
      )}
    </div>
  )
}

function niceMoneyStep(maxMinor: number): number {
  const r = maxMinor / 100
  const steps = [1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8]
  for (const s of steps) if (r / s <= 4) return s * 100
  return 1e8 * 100
}

/**
 * Inspection against the 48-hour promise (TG-197): a segmented arc for the
 * share inspected in time this month, and the count against the target.
 */
function SlaGauge({ sla }: { sla: InspectionSla | null }) {
  const pct = sla?.withinPct ?? null
  const n = 14, cxy = { x: 150, y: 140 }, r1 = 84, r2 = 128
  const frac = (pct ?? 0) / 100
  const seg = (i: number) => {
    const a0 = Math.PI + (i / n) * Math.PI + 0.035
    const a1 = Math.PI + ((i + 1) / n) * Math.PI - 0.035
    const p = (a: number, r: number) => `${(cxy.x + r * Math.cos(a)).toFixed(2)},${(cxy.y + r * Math.sin(a)).toFixed(2)}`
    return `M${p(a0, r1)} L${p(a0, r2)} A${r2},${r2} 0 0 1 ${p(a1, r2)} L${p(a1, r1)} A${r1},${r1} 0 0 0 ${p(a0, r1)}Z`
  }
  const tone = (i: number) => {
    const at = (i + 0.5) / n
    if (pct == null) return 'home__seg-off'
    return at <= frac - 0.12 ? 'home__seg-on' : at <= frac ? 'home__seg-mid' : at <= frac + 0.07 ? 'home__seg-soft' : 'home__seg-off'
  }
  const below = pct != null && sla != null && pct < sla.targetPct
  return (
    <div className="c-card home__sla">
      <div className="c-card__head">
        <h2>Inspection SLA</h2>
        <Link to="/admin/operations?tab=inspect" className="c-link">Open bench</Link>
      </div>
      <svg viewBox="0 0 300 160" className="home__gauge" role="img"
        aria-label={pct == null ? 'Nothing inspected yet this month' : `${pct}% of this month's inspections finished within ${sla?.windowHours} hours`}>
        {Array.from({ length: n }, (_, i) => <path key={i} d={seg(i)} className={tone(i)} />)}
        <text x={cxy.x} y={cxy.y - 14} textAnchor="middle" className="home__gauge-n">{pct == null ? '—' : `${pct}%`}</text>
        <text x={cxy.x} y={cxy.y + 8} textAnchor="middle" className="home__gauge-l">inspected within {sla?.windowHours ?? 48} h</text>
      </svg>
      {sla && (
        <>
          <div className="home__sla-row">
            <div><small>Inspected this month</small><b>{sla.doneThisMonth} item{sla.doneThisMonth === 1 ? '' : 's'}</b></div>
            <div className="home__sla-target">Target <b>{sla.targetPct}%</b></div>
          </div>
          <div className="home__meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0} aria-label="On time this month">
            <span style={{ width: `${pct ?? 0}%` }} className={below ? 'home__meter--below' : undefined} />
            <i style={{ left: `${sla.targetPct}%` }} aria-hidden="true" />
          </div>
          <p className="home__sla-now">
            <b>{sla.onBench}</b> on the bench now
            {sla.pastWindow > 0
              ? <> · <span className="c-late">{sla.pastWindow} past {sla.windowHours} h</span></>
              : sla.onBench > 0 ? <> · all within {sla.windowHours} h</> : null}
          </p>
        </>
      )}
    </div>
  )
}

/** Twelve months and twelve weeks of the chart's figures, as a spreadsheet. */
function exportCsv(months: SalesPoint[], weeks: SalesPoint[]) {
  const admin = months.some((m) => m.commissionMinor != null)
  const head = ['Period', 'Kind', 'Units sold', 'Sales (INR)', ...(admin ? ['Commission (INR)', 'Refunds (INR)'] : [])]
  const row = (p: SalesPoint, kind: string) => [p.period, kind, p.units, (p.salesMinor / 100).toFixed(2),
    ...(admin ? [((p.commissionMinor ?? 0) / 100).toFixed(2), ((p.refundsMinor ?? 0) / 100).toFixed(2)] : [])]
  const lines = [head, ...months.map((m) => row(m, 'month')), ...weeks.map((w) => row(w, 'week'))].map((r) => r.join(','))
  const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `trueglaz-sales-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
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

/** The latest orders in a table card with search and a status filter (TG-197). */
function RecentOrders({ orders }: { orders: RecentOrder[] }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const shown = useMemo(() => orders.filter((o) => {
    const k = q.trim().toLowerCase()
    if (k && !`${o.orderNumber} ${o.buyerName ?? ''}`.toLowerCase().includes(k)) return false
    return !status || orderStatus(o)[0] === status
  }), [orders, q, status])
  const statuses = [...new Set(orders.map((o) => orderStatus(o)[0]))]
  return (
    <section className="c-card c-tcard" aria-labelledby="home-orders">
      <div className="c-tbar">
        <h2 id="home-orders">Recent orders</h2>
        <label className="c-tbar__search">
          <Icon d={ICONS.search} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders" aria-label="Search recent orders" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Link to="/admin/fulfilment" className="c-btn">All orders <Icon d={ICONS.chevron} /></Link>
      </div>
      {orders.length === 0 ? <p className="c-empty">No orders yet.</p> : shown.length === 0 ? <p className="c-empty">No recent order matches.</p> : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead><tr><th>Order ID</th><th>Placed</th><th>Buyer</th><th>Status</th><th className="c-num">Total</th></tr></thead>
            <tbody>
              {shown.map((o, i) => {
                const to = orderHref(o)
                const [label, tone] = orderStatus(o)
                return (
                  <tr key={o.id} className={to ? 'c-clickable' : undefined} onClick={to ? () => nav(to) : undefined}>
                    <td>{to ? <Link to={to} className="home__order" onClick={(e) => e.stopPropagation()}>{o.orderNumber}</Link> : <b className="home__order">{o.orderNumber}</b>}</td>
                    <td className="tg-muted">{o.at ? new Date(o.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td><span className="c-who"><span className={`c-av c-av--${i % 4}`}>{initials(o.buyerName)}</span>{o.buyerName ?? '—'}</span></td>
                    <td><span className={`c-pill${tone ? ` c-pill--${tone}` : ''}`}>{label}</span></td>
                    <td className="c-num">{money(o.totalMinor)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function initials(name: string | null): string {
  const p = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}
