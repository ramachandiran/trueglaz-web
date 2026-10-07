import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  api, ApiError, moneyExact, useApi,
  type CourierCharge, type CourierKind, type StatementRow, type StatementTotals,
} from '@trueglaz/core'
import { QueueScreen } from '../components/QueueScreen'
import './BalanceSheetPage.css'

/**
 * What each closed item earned, and what moving it cost.
 *
 * "Closed" is the buyer's acceptance. Before that the money is escrow, not
 * earned; after it nothing about a unit's economics can change except a courier
 * bill arriving late — which is why the courier column is the one that can be
 * edited here, and the only one.
 *
 * It is a statement of profit per item rather than an accounting balance sheet
 * (assets against liabilities), which is what the escrow reconciliation on the
 * admin dashboard is. The name is the one it was asked for by.
 *
 * The vocabulary does not quite fit consignment, and the page says so where it
 * matters: TrueGlaz never buys a unit, so "buying cost" is what the seller is
 * paid, and the GST is on the commission, not the sale.
 */

const ALL = 'all'

export function BalanceSheetPage() {
  const months = useApi(() => api.balanceSheetMonths(), [])
  const [picked, setPicked] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const perPage = 10

  // Opens on the latest month with anything in it: a statement is read a month
  // at a time, and "all time" is a longer answer than anybody came for.
  const monthList = months.data ?? []
  const active = picked ?? monthList[0]?.month ?? ALL
  const range = active === ALL ? { from: null, to: null } : monthRange(active)

  const stmt = useApi(() => api.balanceSheet(range.from, range.to), [range.from, range.to])
  const rows = stmt.data?.rows ?? []

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase()
    if (!t) return rows
    return rows.filter((r) => [r.sku, r.title, r.orderNumber].some((v) => v.toLowerCase().includes(t)))
  }, [rows, search])

  const pages = Math.ceil(filtered.length / perPage)
  const validPage = Math.min(Math.max(1, page), pages || 1)
  const shown = filtered.slice((validPage - 1) * perPage, validPage * perPage)

  const tabs = [
    ...monthList.map((m) => ({ key: m.month, label: monthLabel(m.month), count: m.count })),
    { key: ALL, label: 'All time', count: monthList.reduce((n, m) => n + m.count, 0) },
  ]

  return (
    <>
      <QueueScreen
        title="Balance sheet"
        subtitle="Every closed item: what it sold for, what the seller was paid, the tax, and what moving it cost"
        tabs={tabs}
        active={active}
        onTab={(k) => { setPicked(k); setPage(1); setOpen(null) }}
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by SKU, item or order number…"
        shown={filtered.length}
        total={rows.length}
        unit="closed items"
        loading={(stmt.loading && !stmt.data) || months.loading}
        error={stmt.error ?? months.error}
        onRetry={() => { stmt.reload(); months.reload() }}
        emptyTitle="Nothing closed in this period"
        emptyHint="An item closes when its buyer accepts it, or the acceptance window ends."
        page={validPage}
        pages={pages}
        onPage={(p) => { setPage(p); setOpen(null) }}
        actions={
          <button className="tg-button tg-button--primary" onClick={() => setDownloading(true)}>
            Download Excel
          </button>
        }
        summary={stmt.data && <Summary totals={stmt.data.totals} />}
      >
        <table className="q__table bs__table">
          <thead>
            <tr>
              <th>Closed</th>
              <th>Item</th>
              <th className="q__num">Selling price</th>
              <th className="q__num">Buying cost</th>
              <th className="q__num">GST</th>
              <th className="q__num">Courier</th>
              <th className="q__num">Profit</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => [
              <Row
                key={r.orderLineId}
                row={r}
                expanded={open === r.itemId}
                onToggle={() => setOpen(open === r.itemId ? null : r.itemId)}
              />,
              open === r.itemId && (
                <tr key={`${r.orderLineId}-charges`} className="bs__panel-row">
                  <td colSpan={7}>
                    <CourierPanel row={r} onChanged={stmt.reload} />
                  </td>
                </tr>
              ),
            ])}
          </tbody>
        </table>
      </QueueScreen>

      <p className="bs__foot tg-muted">
        Profit = selling price + shipping paid by the buyer − buying cost − GST − courier charges.
        Payment-gateway fees are not included.
      </p>

      {downloading && (
        <DownloadDialog
          initial={range}
          onClose={() => setDownloading(false)}
        />
      )}
    </>
  )
}

/** Figures for exactly the period the tabs have selected. */
function Summary({ totals: t }: { totals: StatementTotals }) {
  const cards: Array<{ label: string; value: string; note?: string; tone?: 'profit' }> = [
    { label: 'Closed items', value: String(t.count) },
    { label: 'Sold for', value: moneyExact(t.sellingMinor) },
    { label: 'Shipping from buyers', value: moneyExact(t.shippingMinor) },
    { label: 'Paid to sellers', value: moneyExact(t.buyingMinor), note: 'buying cost' },
    { label: 'GST', value: moneyExact(t.gstMinor), note: 'on commission, not ours' },
    { label: 'Courier charges', value: moneyExact(t.courierMinor) },
    { label: 'Profit', value: moneyExact(t.profitMinor), tone: 'profit' },
  ]
  return (
    <div className="bs__cards">
      {cards.map((c) => (
        <div key={c.label} className={`bs__card${c.tone ? ' bs__card--profit' : ''}`}>
          <span className="bs__card-label">{c.label}</span>
          <span className={`bs__card-value${c.tone && t.profitMinor < 0 ? ' bs__neg' : ''}`}>{c.value}</span>
          {c.note && <span className="bs__card-note tg-muted">{c.note}</span>}
        </div>
      ))}
    </div>
  )
}

function Row({
  row: r, expanded, onToggle,
}: { row: StatementRow; expanded: boolean; onToggle: () => void }) {
  return (
    <tr className={expanded ? 'bs__row bs__row--open' : 'bs__row'}>
      <td className="bs__when">{day(r.closedAt)}</td>
      <td>
        <Link to={`/items/${r.itemId}`} className="bs__sku tg-mono">{r.sku}</Link>
        <span className="bs__gear">{r.title}</span>
        <span className="bs__order tg-muted">{r.orderNumber}</span>
      </td>
      <td className="q__num">
        <span className="bs__amount">{moneyExact(r.sellingMinor)}</span>
        {r.shippingMinor > 0 && (
          <span className="bs__sub tg-muted">+ {moneyExact(r.shippingMinor)} shipping</span>
        )}
      </td>
      <td className="q__num">
        <span className="bs__amount">{moneyExact(r.buyingMinor)}</span>
        <span className="bs__sub tg-muted">{r.payoutState ? `payout ${r.payoutState.replace(/_/g, ' ')}` : 'no payout yet'}</span>
      </td>
      <td className="q__num">{moneyExact(r.gstMinor)}</td>
      <td className="q__num">
        <button
          type="button"
          className={`bs__courier${r.charges.length === 0 ? ' bs__courier--empty' : ''}`}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {r.charges.length === 0
            ? '+ Add'
            : <>{moneyExact(r.courierMinor)}<span className="bs__count">{r.charges.length}</span></>}
        </button>
      </td>
      <td className={`q__num bs__profit${r.profitMinor < 0 ? ' bs__neg' : ''}`}>
        {moneyExact(r.profitMinor)}
      </td>
    </tr>
  )
}

const KINDS: Array<{ value: CourierKind; label: string }> = [
  { value: 'inbound', label: 'Inbound — seller to us' },
  { value: 'outbound', label: 'Outbound — us to buyer' },
  { value: 'return', label: 'Return' },
  { value: 'other', label: 'Other' },
]

/**
 * Every courier bill on a unit, and a way to add another.
 *
 * Many entries, because a unit that is received, sold, returned and sold again
 * has been on four legs and each is its own bill. There is no edit: a bill keyed
 * wrong is struck and keyed again, so the record keeps what was originally
 * entered and who struck it.
 */
function CourierPanel({ row, onChanged }: { row: StatementRow; onChanged: () => void }) {
  const [kind, setKind] = useState<CourierKind>('outbound')
  const [courier, setCourier] = useState('')
  const [tracking, setTracking] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [striking, setStriking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rupees = Number(amount)
  const valid = Number.isFinite(rupees) && rupees > 0

  async function add() {
    setBusy(true); setError(null)
    try {
      await api.addCourierCharge(row.itemId, {
        kind,
        courierCode: courier.trim() || null,
        trackingNumber: tracking.trim() || null,
        // Paise, rounded once, here: a float in the request body is how
        // ₹380.10 becomes 38009.999999999996.
        amountMinor: Math.round(rupees * 100),
        incurredOn: date,
        note: note.trim() || null,
      })
      setAmount(''); setTracking(''); setNote('')
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record that')
    } finally { setBusy(false) }
  }

  async function strike(c: CourierCharge) {
    setBusy(true); setError(null)
    try {
      await api.voidCourierCharge(c.id)
      setStriking(null)
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not strike that')
    } finally { setBusy(false) }
  }

  return (
    <div className="bs__panel">
      <div className="bs__panel-head">
        <strong>Courier charges for {row.sku}</strong>
        <span className="tg-muted">
          {row.charges.length === 0
            ? 'None recorded yet — profit is counted as if moving it was free.'
            : `${row.charges.length} bill${row.charges.length === 1 ? '' : 's'}, ${moneyExact(row.courierMinor)} in all`}
        </span>
      </div>

      {row.charges.length > 0 && (
        <ul className="bs__charges">
          {row.charges.map((c) => (
            <li key={c.id} className="bs__charge">
              <span className="tg-badge">{c.kind}</span>
              <span className="bs__charge-main">
                {[c.courierCode, c.trackingNumber].filter(Boolean).join(' · ') || '—'}
                {c.note && <span className="tg-muted"> — {c.note}</span>}
              </span>
              <span className="tg-muted bs__charge-date">{plainDay(c.incurredOn)}</span>
              <span className="bs__charge-amount">{moneyExact(c.amountMinor)}</span>
              {striking === c.id ? (
                <span className="bs__strike">
                  <button className="tg-button" disabled={busy} onClick={() => strike(c)}>Strike it</button>
                  <button className="tg-button tg-button--subtle" onClick={() => setStriking(null)}>Keep</button>
                </span>
              ) : (
                <button className="tg-button tg-button--subtle bs__strike-btn" onClick={() => setStriking(c.id)}>
                  Strike
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="bs__form"
        onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void add() }}
      >
        <label className="bs__field">
          <span>Leg</span>
          <select className="tg-select" value={kind} onChange={(e) => setKind(e.target.value as CourierKind)}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
        <label className="bs__field">
          <span>Courier</span>
          <input className="tg-input" value={courier} placeholder="bluedart" onChange={(e) => setCourier(e.target.value)} />
        </label>
        <label className="bs__field">
          <span>Tracking</span>
          <input className="tg-input" value={tracking} placeholder="optional" onChange={(e) => setTracking(e.target.value)} />
        </label>
        <label className="bs__field">
          <span>Amount (₹)</span>
          <input
            className="tg-input"
            type="number" min="0.01" step="0.01" inputMode="decimal"
            value={amount} placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="bs__field">
          <span>Billed on</span>
          <input className="tg-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="bs__field bs__field--wide">
          <span>Note</span>
          <input className="tg-input" value={note} placeholder="optional" onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="tg-button tg-button--primary bs__add" disabled={!valid || !date || busy}>
          {busy ? 'Saving…' : 'Add charge'}
        </button>
      </form>
      {error && <p className="bs__error" role="alert">{error}</p>}
    </div>
  )
}

/**
 * The statement as a file, for any range.
 *
 * The preview line is the point of showing the figures here at all: choosing a
 * range blind and finding out it was empty after the download is the version of
 * this dialog that wastes everybody's time.
 */
function DownloadDialog({
  initial, onClose,
}: { initial: { from: string | null; to: string | null }; onClose: () => void }) {
  const [from, setFrom] = useState(initial.from ?? '')
  const [to, setTo] = useState(initial.to ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const backwards = !!from && !!to && from > to
  const preview = useApi(
    () => (backwards ? Promise.resolve(null) : api.balanceSheet(from || null, to || null)),
    [from, to, backwards],
  )

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [busy, onClose])

  const t = new Date()
  const y = t.getFullYear(), m = t.getMonth()
  const fyStart = m >= 3 ? y : y - 1          // India's financial year runs April to March
  const presets: Array<{ label: string; from: string; to: string }> = [
    { label: 'This month', ...monthRange(`${y}-${String(m + 1).padStart(2, '0')}`) },
    { label: 'Last month', ...monthRange(m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}`) },
    { label: 'This financial year', from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` },
    { label: 'All time', from: '', to: '' },
  ]

  async function go() {
    setBusy(true); setError(null)
    try {
      const { blob, filename } = await api.downloadStatement(from || null, to || null)
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(href)
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The download did not go through')
    } finally { setBusy(false) }
  }

  const n = preview.data?.totals.count

  return createPortal(
    <div className="bs__scrim" onMouseDown={() => !busy && onClose()}>
      <div
        className="bs__dialog"
        role="dialog" aria-modal="true" aria-labelledby="bs-dl-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="bs__dialog-title" id="bs-dl-title">Download statement</h2>
        <p className="tg-muted bs__dialog-sub">
          An Excel workbook: one row per closed item, every courier charge on its own sheet, and live formulas.
        </p>

        <div className="bs__presets">
          {presets.map((p) => (
            <button
              key={p.label} type="button"
              className={`bs__preset${from === p.from && to === p.to ? ' bs__preset--on' : ''}`}
              onClick={() => { setFrom(p.from); setTo(p.to) }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="bs__dates">
          <label className="bs__field">
            <span>From</span>
            <input className="tg-input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="bs__field">
            <span>To</span>
            <input className="tg-input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <p className="tg-muted bs__hint">Leave both empty for all time. Days are counted in India time.</p>

        <p className={`bs__preview${backwards ? ' bs__neg' : ''}`} aria-live="polite">
          {backwards
            ? 'The start date is after the end date.'
            : preview.loading ? 'Counting…'
              : preview.data
                ? `${n} closed item${n === 1 ? '' : 's'} · profit ${moneyExact(preview.data.totals.profitMinor)}`
                : ''}
        </p>

        {error && <p className="bs__error" role="alert">{error}</p>}

        <div className="bs__buttons">
          <button className="tg-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button
            className="tg-button tg-button--primary"
            disabled={busy || backwards || preview.loading}
            onClick={go}
          >
            {busy ? 'Preparing…' : 'Download .xlsx'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// -- dates ---------------------------------------------------------------------

/** First and last day of a YYYY-MM, as the API wants them. */
function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/** An instant, shown as the day it was in India — which is how the server filters it. */
function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  })
}

/** A calendar date has no zone, so it is built from its parts and never from a UTC parse. */
function plainDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function today(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
