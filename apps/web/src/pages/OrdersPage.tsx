import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api, ApiError, dateOnly, dateTime, money, relative, useApi,
  type OrderLineSummary, type OrderSummary, type ReturnForBuyer,
} from '@trueglaz/core'
import { GearPhoto, photoKindFor } from '../components/GearPhoto'
import { Empty, ErrorNote, Loading } from '../components/ui'
import './OrdersPage.css'

/**
 * The buyer's orders.
 *
 * Laid out the way an orders page people already know is laid out — a header
 * strip carrying placed / total / ship to / order number, then one row per item
 * with its picture, its name, and the actions beside it. Familiarity is the
 * whole point of that convention; there is nothing to win by inventing another.
 *
 * Two things are deliberately not borrowed.
 *
 * There is no "buy it again". Every item here is one second-hand unit and it has
 * just been sold, so the button would be a lie on every row. The honest version
 * of that wish goes to the catalogue.
 *
 * And acceptance is not a dead line of text. On a general marketplace the
 * nearest equivalent is a return window that has usually already closed. Here
 * the window is live and it moves money: when it runs out the sale is final and
 * the seller is paid, whether or not the buyer did anything. So an open window
 * is the loudest thing on the card, and it says what happens if it is ignored.
 */

type Tab = 'all' | 'open' | 'needs-you' | 'done'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All orders' },
  { key: 'open', label: 'In progress' },
  { key: 'needs-you', label: 'Needs you' },
  { key: 'done', label: 'Completed' },
]

const FINISHED = ['accepted', 'returned', 'cancelled']

/** A line waits on the buyer when it has arrived and not been confirmed. */
function needsYou(line: OrderLineSummary): boolean {
  return line.state === 'delivered'
}

/** "23h 10m", "40m", or null once it has passed (or when no window is running). */
function timeLeft(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms) || ms <= 0) return null
  const mins = Math.ceil(ms / 60_000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

const RETURN_REASONS: { code: string; label: string; needsNote: boolean }[] = [
  { code: 'not_as_described', label: 'Not as described', needsNote: true },
  { code: 'damaged_in_transit', label: 'Damaged in transit', needsNote: true },
  { code: 'wrong_item', label: 'Wrong item received', needsNote: true },
  { code: 'change_of_mind', label: 'Changed my mind', needsNote: false },
]

export function OrdersPage() {
  const orders = useApi(() => api.myOrders(), [])
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [year, setYear] = useState('all')

  const rows = useMemo(() => orders.data ?? [], [orders.data])

  const years = useMemo(() => {
    const seen = new Set<string>()
    rows.forEach((o) => { if (o.createdAt) seen.add(String(new Date(o.createdAt).getFullYear())) })
    return Array.from(seen).sort((a, b) => Number(b) - Number(a))
  }, [rows])

  const attention = useMemo(
    () => rows.reduce((n, o) => n + o.lines.filter(needsYou).length, 0),
    [rows],
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((o) => {
      if (year !== 'all' && (!o.createdAt || String(new Date(o.createdAt).getFullYear()) !== year)) return false
      if (tab === 'needs-you' && !o.lines.some(needsYou)) return false
      if (tab === 'open' && !o.lines.some((l) => !FINISHED.includes(l.state))) return false
      if (tab === 'done' && !o.lines.every((l) => FINISHED.includes(l.state))) return false
      if (!q) return true
      // Searching orders means searching for the thing you bought, or for a
      // number off an email. Nothing else on the card is something anyone types.
      return o.orderNumber.toLowerCase().includes(q) ||
        o.lines.some((l) => l.title.toLowerCase().includes(q))
    })
  }, [rows, tab, query, year])

  if (orders.loading) return <Loading label="Loading your orders" />
  if (orders.error) return <ErrorNote error={orders.error} onRetry={orders.reload} />

  if (rows.length === 0) {
    return (
      <div className="orders">
        <h1 className="orders__title">Your orders</h1>
        <Empty
          title="No orders yet"
          hint="Anything you buy shows up here, with where it is and when you need to confirm it arrived."
        />
      </div>
    )
  }

  return (
    <div className="orders">
      <div className="orders__masthead">
        <h1 className="orders__title">Your orders</h1>
        <form className="orders__search" role="search" onSubmit={(e) => e.preventDefault()}>
          <label className="tg-visually-hidden" htmlFor="orders-q">Search your orders</label>
          <input
            id="orders-q"
            type="search"
            className="orders__search-input"
            placeholder="Search by item or order number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      </div>

      <div className="orders__tabs" role="tablist" aria-label="Filter orders">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`orders__tab${tab === t.key ? ' orders__tab--on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'needs-you' && attention > 0 && (
              <span className="orders__tab-count">{attention}</span>
            )}
          </button>
        ))}
      </div>

      <div className="orders__filter">
        <span>
          <strong>{shown.length}</strong> {shown.length === 1 ? 'order' : 'orders'}
          {year === 'all' ? '' : ' placed in'}
        </span>
        <label className="tg-visually-hidden" htmlFor="orders-year">Year</label>
        <select
          id="orders-year"
          className="orders__year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="all">all time</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {shown.length === 0 ? (
        <Empty title="Nothing matches" hint="Try a different search, year, or tab." />
      ) : (
        shown.map((o) => <OrderCard key={o.id} order={o} onChanged={orders.reload} />)
      )}
    </div>
  )
}

function OrderCard({ order, onChanged }: { order: OrderSummary; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function accept(lineId: string) {
    setBusy(lineId); setError(null)
    try {
      await api.acceptLine(lineId)
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not confirm that')
    } finally {
      setBusy(null)
    }
  }

  return (
    <article className="order">
      <header className="order__strip">
        <div className="order__fact">
          <span className="order__fact-label">Order placed</span>
          <span className="order__fact-value">{dateOnly(order.createdAt)}</span>
        </div>
        <div className="order__fact">
          <span className="order__fact-label">Total</span>
          <span className="order__fact-value order__fact-value--money">{money(order.totalMinor)}</span>
        </div>
        <div className="order__fact">
          <span className="order__fact-label">Ship to</span>
          <span className="order__fact-value">
            {order.shipToName ?? '—'}
            {order.shipToCity && <span className="order__ship-city">, {order.shipToCity}</span>}
          </span>
        </div>
        <div className="order__fact order__fact--end">
          <span className="order__fact-label">
            Order # <span className="tg-mono">{order.orderNumber}</span>
          </span>
          <span className="order__fact-links">
            <OrderInvoice invoiceId={order.invoiceId} invoiceNumber={order.invoiceNumber} />
          </span>
        </div>
      </header>

      {error && <p className="order__error" role="alert">{error}</p>}

      <div className="order__lines">
        {order.lines.map((line) => (
          <LineRow key={line.id} line={line} busy={busy === line.id} onAccept={() => accept(line.id)} onChanged={onChanged} />
        ))}
      </div>
    </article>
  )
}

function LineRow({
  line, busy, onAccept, onChanged,
}: {
  line: OrderLineSummary
  busy: boolean
  onAccept: () => void
  onChanged: () => void
}) {
  const left = timeLeft(line.acceptanceWindowEndsAt)
  const waiting = needsYou(line) && left != null

  return (
    <div className={`line${waiting ? ' line--waiting' : ''}`}>
      <Link
        to={`/items/${line.consignmentItemId}`}
        className="line__photo"
        tabIndex={-1}
        aria-hidden="true"
      >
        <GearPhoto kind={photoKindFor(line.categoryName)} size="thumb" />
      </Link>

      <div className="line__main">
        <Link to={`/items/${line.consignmentItemId}`} className="line__title">{line.title}</Link>

        <p className="line__facts">
          {line.gradeLabel && <span className="line__grade">{line.gradeLabel}</span>}
          {/* Titles generated at listing time already end in the grade code, and
              repeating it beside them reads as a stutter. */}
          {!line.title.endsWith(line.gradeCodeAtSale) && (
            <span className="tg-mono line__code">{line.gradeCodeAtSale}</span>
          )}
          <span className="line__price">{money(line.itemPriceMinor)}</span>
        </p>

        <Progress line={line} />

        {waiting ? (
          <p className="line__window" role="status">
            <strong className="line__window-head">{left} left to return it</strong>{' '}
            Your payment is held. If it is not what you expected, return it now. If you do
            nothing it is released to the seller automatically at {dateTime(line.acceptanceWindowEndsAt)}.
          </p>
        ) : (
          <p className="line__status">{statusLine(line)}</p>
        )}

        <ReturnPanel line={line} canRaise={waiting} onChanged={onChanged} />
      </div>

      <div className="line__actions">
        {waiting && (
          <button
            type="button"
            className="tg-button tg-button--primary line__cta"
            disabled={busy}
            onClick={onAccept}
          >
            {busy ? 'Confirming…' : 'Confirm it arrived'}
          </button>
        )}
        {line.trackingNumber && (
          <span className="line__tracking">
            <span className="line__tracking-label">{line.courierCode ?? 'Courier'}</span>
            <span className="tg-mono line__tracking-number">{line.trackingNumber}</span>
          </span>
        )}
        <Link className="tg-button line__action" to={`/items/${line.consignmentItemId}`}>
          View your item
        </Link>
        {/* Not "buy it again": there is exactly one of each of these and it has
            just been sold. The catalogue is the honest version of that wish. */}
        <Link
          className="tg-button line__action"
          to={`/catalog${line.categoryName ? `?q=${encodeURIComponent(line.categoryName)}` : ''}`}
        >
          Find another like this
        </Link>
      </div>
    </div>
  )
}

/** Where the parcel is, in the four steps it actually has. */
function Progress({ line }: { line: OrderLineSummary }) {
  // A returned or cancelled line never walked this path, and drawing it part
  // of the way along would say it is still coming.
  if (['returned', 'cancelled'].includes(line.state)) return null

  const steps = ['Paid', 'Dispatched', 'Delivered', 'Confirmed']
  const done = line.state === 'accepted'
  const reached = done ? 3
    : line.state === 'delivered' ? 2
      : line.state === 'dispatched' ? 1
        : 0

  return (
    <ol className="rail" aria-label="Progress">
      {steps.map((s, i) => (
        <li
          key={s}
          className={
            'rail__step' +
            (i <= reached ? ' rail__step--done' : '') +
            // A finished line has no step in progress — every one of them is
            // behind it. Marking the last one "now" as well drew a live
            // highlight on a sale that closed days ago.
            (!done && i === reached ? ' rail__step--now' : '')
          }
          aria-current={!done && i === reached ? 'step' : undefined}
        >
          <span className="rail__dot" aria-hidden="true" />
          <span className="rail__label">{s}</span>
        </li>
      ))}
    </ol>
  )
}

function statusLine(line: OrderLineSummary): string {
  switch (line.state) {
    case 'accepted':
      return line.acceptedBy === 'window_expired'
        ? `Closed automatically on ${dateOnly(line.acceptedAt)} — the return window passed.`
        : `Confirmed on ${dateOnly(line.acceptedAt)}. The seller has been paid.`
    case 'dispatched':
      return line.dispatchedAt ? `On its way — sent ${relative(line.dispatchedAt)}.` : 'On its way to you.'
    case 'delivered':
      return 'Delivered. The return window has ended and the sale is closing.'
    case 'return_requested':
      return 'Return in progress — the clock is stopped while we deal with it.'
    case 'returned':
      return 'Returned. Your refund is on its way.'
    case 'cancelled':
      return 'Cancelled.'
    default:
      return 'Paid and held. We will dispatch it shortly.'
  }
}

/**
 * The invoice, fetched rather than linked.
 *
 * The session token lives in a header and a browser following a link sends
 * none, so the document is pulled and opened as a blob — where every browser
 * already has a better "save as PDF" than we would ship.
 */
function OrderInvoice({
  invoiceId, invoiceNumber,
}: {
  invoiceId: string | null
  invoiceNumber: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!invoiceId) return null

  async function open() {
    if (!invoiceId) return
    setBusy(true); setFailed(false)
    let href: string | null = null
    try {
      href = URL.createObjectURL(await api.invoiceDocument(invoiceId))
      window.open(href, '_blank', 'noopener')
    } catch {
      setFailed(true)
    } finally {
      // Revoked on a timer: revoking at once races the tab that is opening it,
      // and never revoking leaks the blob for the life of the page.
      if (href) setTimeout(() => URL.revokeObjectURL(href as string), 60_000)
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="order__link"
      onClick={open}
      disabled={busy}
      title={invoiceNumber ?? undefined}
    >
      {busy ? 'Opening…' : failed ? 'Try the invoice again' : 'Invoice'}
    </button>
  )
}

/**
 * Returning an item: asking, and then following it.
 *
 * Asking is only on offer while the window is open. Once a return exists the
 * panel says where it stands in words, and, when it has been approved, where to
 * send the parcel.
 */
function ReturnPanel({
  line, canRaise, onChanged,
}: {
  line: OrderLineSummary
  canRaise: boolean
  onChanged: () => void
}) {
  const hasCase = ['return_requested', 'returned'].includes(line.state) || line.acceptedBy === 'return_refused'
  const found = useApi<ReturnForBuyer | null | undefined>(
    () => (hasCase ? api.returnForLine(line.id) : Promise.resolve(null)),
    [line.id, line.state],
  )
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('not_as_described')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const spec = RETURN_REASONS.find((r) => r.code === reason)!

  async function submit() {
    setBusy(true); setError(null)
    try {
      await api.returnRequest(line.id, reason, note)
      setOpen(false); setNote('')
      onChanged(); found.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not go through')
    } finally { setBusy(false) }
  }

  const rc = found.data
  if (rc) {
    const c = rc.case
    const text: Record<string, string> = {
      requested: 'We have your return request and will review it shortly.',
      approved: `Approved. Send it back with ${rc.courierCode ?? 'the courier'}${rc.trackingNumber ? `, tracking ${rc.trackingNumber}` : ''}. We refund you once it has arrived and been checked.`,
      received: 'We have your parcel and are checking it.',
      inspected: 'Checked. We are finishing up.',
      refunded: 'Return accepted. Your refund is being processed.',
      escalated: 'The item did not pass our check on arrival. Our team will contact you.',
      sale_stands: 'After review the sale stands; the item is being sent back to you.',
      declined: `Not accepted. ${c.decisionNote ?? ''}`,
    }
    return (
      <p className="line__status" role="status">
        <strong>Return:</strong> {text[c.state] ?? c.state}
      </p>
    )
  }

  if (!canRaise) return null
  if (!open) {
    return (
      <p className="line__status">
        <button type="button" className="tg-button" onClick={() => setOpen(true)}>Return this item</button>
      </p>
    )
  }
  return (
    <div className="line__status">
      <label className="tg-label">
        Why are you returning it?
        <select className="tg-input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {RETURN_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </label>
      <label className="tg-label">
        {spec.needsNote ? 'What is wrong?' : 'Anything you would like to tell us?'}
        {!spec.needsNote && <span className="tg-muted"> (optional)</span>}
        <textarea className="tg-input" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="order__error" role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button" className="tg-button tg-button--primary"
          disabled={busy || (spec.needsNote && note.trim().length < 10)}
          onClick={submit}
        >
          {busy ? 'Sending…' : 'Request the return'}
        </button>
        <button type="button" className="tg-button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}
