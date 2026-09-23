import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api, ApiError, dateOnly, money, useApi, useSession,
  type MyRequest, type WantedRequest,
} from '@trueglaz/core'
import { Empty, ErrorNote, GradeBadge, Loading } from '../components/ui'
import './WantedPage.css'

/**
 * The other half of the market.
 *
 * A consignment shop only ever has what someone happened to send in, so a buyer
 * who finds an empty shelf has nowhere to go and a seller deciding what to
 * consign is guessing. This is both problems answered at once: buyers say what
 * they are after, and anyone thinking of selling can read it.
 */
export function WantedPage() {
  const { session } = useSession()
  const board = useApi(() => api.wantedBoard(), [])
  const mine = useApi(() => (session ? api.myRequests() : Promise.resolve(null)), [session?.userId])

  return (
    <div className="wanted">
      <header className="wanted__head">
        <h1 className="wanted__title">Wanted</h1>
        <p className="wanted__lede">
          What buyers are looking for and we do not have. Every one of these is a person
          waiting — if you have the thing, it has a home before you send it in.
        </p>
        {session && <Link className="tg-button wanted__sell" to="/sell">Consign something</Link>}
      </header>

      {session && <MySlots mine={mine} />}

      <section aria-label="Open requests">
        <h2 className="wanted__section-title">
          On the board{board.data ? ` (${board.data.length})` : ''}
        </h2>

        {board.loading && <Loading label="Loading the board" />}
        {board.error && <ErrorNote error={board.error} onRetry={board.reload} />}

        {board.data?.length === 0 && (
          <Empty
            title="Nobody is asking for anything yet"
            hint="When a buyer asks for something we do not have, it appears here once a person has read it."
          />
        )}

        {(board.data?.length ?? 0) > 0 && (
          <ul className="wanted__board">
            {(board.data ?? []).map((r) => <BoardCard key={r.id} request={r} />)}
          </ul>
        )}
      </section>
    </div>
  )
}

function BoardCard({ request }: { request: WantedRequest }) {
  return (
    <li className="want tg-card">
      <h3 className="want__title">{request.wanted}</h3>
      <div className="want__terms">
        {request.maxPriceMinor != null && (
          <span className="want__budget">up to {money(request.maxPriceMinor)}</span>
        )}
        {request.minGradeCode && (
          <span className="want__grade">
            <GradeBadge code={request.minGradeCode} />
            <span className="tg-muted">{request.minGradeLabel} or better</span>
          </span>
        )}
      </div>
      {request.note && <p className="want__note">“{request.note}”</p>}
      <p className="want__asked tg-muted">Asked {dateOnly(request.createdAt)}</p>
    </li>
  )
}

/* -- a buyer's own two slots ----------------------------------------------- */

const EMPTY_ASK = { modelFreeText: '', minGradeCode: '', maxPrice: '', note: '' }

function MySlots({ mine }: { mine: ReturnType<typeof useApi<import('@trueglaz/core').MyRequests | null>> }) {
  const grades = useApi(() => api.grades(), [])
  const [form, setForm] = useState(EMPTY_ASK)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (mine.loading) return <Loading label="Loading your requests" />
  // Without this the section simply vanished on a failed load — no message, no
  // retry, just a page that looks like it forgot you had asked for anything.
  if (mine.error) {
    return (
      <section className="tg-card wanted__mine" aria-label="Your requests">
        <h2 className="wanted__section-title">Your requests</h2>
        <ErrorNote error={mine.error} onRetry={mine.reload} />
      </section>
    )
  }
  const data = mine.data
  if (!data) return null

  // Withdrawn, rejected and fulfilled asks hold no slot, so listing them beside
  // the live ones made "both of your 2 slots are in use" sit above four rows and
  // read as a bug. They are still worth showing — a buyer wants to know why one
  // was turned down — just not as though they were still in play.
  const live = data.requests.filter((r) => r.state === 'submitted' || r.state === 'published')
  const decided = data.requests.filter((r) => r.state !== 'submitted' && r.state !== 'published')

  async function submit() {
    setBusy(true); setError(null)
    try {
      await api.askFor({
        modelFreeText: form.modelFreeText.trim(),
        minGradeCode: form.minGradeCode || null,
        maxPriceMinor: form.maxPrice ? Math.round(Number(form.maxPrice) * 100) : null,
        note: form.note.trim() || null,
      })
      setForm(EMPTY_ASK); setAsking(false)
      mine.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send that')
    } finally { setBusy(false) }
  }

  async function withdraw(id: string) {
    setBusy(true); setError(null)
    try {
      await api.withdrawRequest(id)
      mine.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not withdraw that')
    } finally { setBusy(false) }
  }

  return (
    <section className="tg-card wanted__mine" aria-label="Your requests">
      <div className="wanted__mine-head">
        <h2 className="wanted__section-title">Your requests</h2>
        <span className="wanted__slots tg-muted">
          {data.slotsLeft === 0
            ? `Both of your ${data.limit} slots are in use`
            : `${data.slotsLeft} of ${data.limit} slots free`}
        </span>
      </div>

      <p className="tg-muted wanted__fineprint">
        Two at a time, so the board stays a list of things people actually want. Withdraw
        one and the slot comes straight back.
      </p>

      {error && <p className="wanted__error" role="alert">{error}</p>}

      {live.length > 0 && (
        <ul className="wanted__list">
          {live.map((r) => (
            <MyRow key={r.id} request={r} busy={busy} onWithdraw={() => withdraw(r.id)} />
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <details className="wanted__earlier">
          <summary className="tg-muted">Earlier asks ({decided.length})</summary>
          <ul className="wanted__list">
            {decided.map((r) => (
              <MyRow key={r.id} request={r} busy={busy} onWithdraw={() => withdraw(r.id)} />
            ))}
          </ul>
        </details>
      )}

      {data.slotsLeft === 0 ? (
        <p className="tg-muted wanted__fineprint">
          Withdraw one above to ask for something else.
        </p>
      ) : !asking ? (
        <button className="tg-button tg-button--primary" onClick={() => setAsking(true)}>
          Ask for something
        </button>
      ) : (
        <div className="wanted__form">
          <label className="wanted__field wanted__field--wide">
            <span className="wanted__label">What are you after?</span>
            <input
              className="tg-input"
              value={form.modelFreeText}
              placeholder="e.g. Canon EOS R5 body, or Sigma 85mm f/1.4 Art in Sony E"
              onChange={(e) => setForm({ ...form, modelFreeText: e.target.value })}
            />
            <span className="tg-muted wanted__hint">
              The make and model is enough. A person reads this before it goes up.
            </span>
          </label>

          <label className="wanted__field">
            <span className="wanted__label">Lowest condition you'd take</span>
            <select
              className="tg-select"
              value={form.minGradeCode}
              onChange={(e) => setForm({ ...form, minGradeCode: e.target.value })}
            >
              <option value="">Any condition</option>
              {(grades.data ?? []).filter((g) => g.isActive).map((g) => (
                <option key={g.code} value={g.code}>{g.code} · {g.label}</option>
              ))}
            </select>
          </label>

          <label className="wanted__field">
            <span className="wanted__label">Your top price</span>
            <input
              className="tg-input"
              inputMode="numeric"
              value={form.maxPrice}
              placeholder="₹"
              onChange={(e) => setForm({ ...form, maxPrice: e.target.value })}
            />
            <span className="tg-muted wanted__hint">Optional, but it makes the ask concrete.</span>
          </label>

          <label className="wanted__field wanted__field--wide">
            <span className="wanted__label">Anything else</span>
            <input
              className="tg-input"
              value={form.note}
              placeholder="e.g. must have the original box; happy with light wear"
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <span className="tg-muted wanted__hint">
              No contact details — everything goes through TrueGlaz, which is what makes
              the escrow and the grading worth anything.
            </span>
          </label>

          <div className="wanted__actions">
            <button
              className="tg-button tg-button--primary"
              disabled={busy || form.modelFreeText.trim().length < 3}
              onClick={submit}
            >
              {busy ? 'Sending…' : 'Send for review'}
            </button>
            <button className="tg-button" onClick={() => { setAsking(false); setForm(EMPTY_ASK) }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function MyRow({ request, busy, onWithdraw }: {
  request: MyRequest
  busy: boolean
  onWithdraw: () => void
}) {
  const open = request.state === 'submitted' || request.state === 'published'
  return (
    <li className="wanted__row">
      <div>
        <strong>{request.wanted}</strong>
        <span className={`tg-badge ${badgeFor(request.state)} wanted__state`}>{label(request.state)}</span>
        <p className="tg-muted wanted__row-meta">
          {request.maxPriceMinor != null && `up to ${money(request.maxPriceMinor)} · `}
          {request.minGradeLabel && `${request.minGradeLabel} or better · `}
          asked {dateOnly(request.createdAt)}
          {request.state === 'rejected' && request.rejectedReasonCode && (
            <> · turned down: {request.rejectedReasonCode.replace(/_/g, ' ')}</>
          )}
        </p>
      </div>
      {open && (
        <button className="tg-button" disabled={busy} onClick={onWithdraw}>Withdraw</button>
      )}
    </li>
  )
}

function label(state: string): string {
  switch (state) {
    case 'submitted': return 'Waiting on review'
    case 'published': return 'On the board'
    case 'rejected': return 'Not published'
    case 'withdrawn': return 'Withdrawn'
    case 'fulfilled': return 'Found'
    default: return state
  }
}

function badgeFor(state: string): string {
  if (state === 'published' || state === 'fulfilled') return 'tg-badge--good'
  if (state === 'rejected') return 'tg-badge--bad'
  if (state === 'submitted') return 'tg-badge--warn'
  return ''
}
