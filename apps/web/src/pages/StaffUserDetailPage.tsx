import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, dateOnly, dateTime, money, useApi } from '@trueglaz/core'
import { PageHead } from '../components/PageHead'
import { ErrorNote, GradeBadge, Loading } from '../components/ui'
import { PayoutCheckPanel } from '../components/PayoutCheckPanel'
import { KycBadge, SellingBadge } from './StaffUsersPage'
import './StaffUsersPage.css'
import './StaffUserDetailPage.css'

type Tab = 'selling' | 'buying'

/**
 * One person: who they are, what their identity check returned, and the two
 * sides of what they have done here.
 *
 * The decision sits at the top rather than under the tabs, because it is the
 * reason a staff member opened the page. The tabs are the evidence for it.
 */
export function StaffUserDetailPage() {
  const { id = '' } = useParams()
  const detail = useApi(() => api.staffUser(id), [id])
  const [tab, setTab] = useState<Tab>('selling')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(approve: boolean) {
    setBusy(true); setError(null)
    try {
      if (approve) await api.approveSelling(id, note)
      else await api.rejectSelling(id, note)
      setNote('')
      detail.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(false) }
  }

  const crumbs = [{ label: 'People', to: '/admin/people' }, { label: detail.data?.user.displayName ?? 'Person' }]
  if (detail.loading && !detail.data) return <><PageHead title="Person" crumbs={crumbs} /><Loading label="Loading" /></>
  if (detail.error && !detail.data) return <><PageHead title="Person" crumbs={crumbs} /><ErrorNote error={detail.error} onRetry={detail.reload} /></>
  if (!detail.data) return null

  const d = detail.data
  const u = d.user
  const verified = d.kyc?.status === 'verified'

  return (
    <div className="people person">
      <PageHead crumbs={crumbs} title={u.displayName}
        subtitle={<>{u.email ?? '—'} · {u.phone ?? '—'} · joined {u.joinedAt ? dateOnly(u.joinedAt) : '—'}</>}
        actions={<div className="person__badges">
          <KycBadge status={u.kycStatus} />
          <SellingBadge state={u.sellingState} />
          {u.accountState !== 'active' && <span className="tg-badge tg-badge--bad">{u.accountState}</span>}
        </div>} />

      <div className="person__panels">
        <section className="tg-card person__panel">
          <h2 className="person__panel-title">Identity check</h2>
          {d.kyc ? (
            <dl className="person__facts">
              <Fact k="Status" v={d.kyc.status.replace(/_/g, ' ')} />
              <Fact k="Name on the document" v={d.kyc.legalName ?? '—'} />
              <Fact
                k="Where the name came from"
                v={d.kyc.nameSource === 'uidai'
                  ? 'The issuer (UIDAI), not typed in'
                  : d.kyc.nameSource === 'digilocker' ? "The seller's DigiLocker (UIDAI), not typed in"
                  : d.kyc.nameSource === 'self_declared' ? 'Typed in by the seller' : '—'}
              />
              <Fact k="Document" v={d.kyc.idType ? `${d.kyc.idType === 'aadhaar' ? 'Aadhaar' : d.kyc.idType.toUpperCase()} ending ${d.kyc.idLast4 ?? '????'}` : '—'} />
              <Fact k="Checked by" v={d.kyc.provider ?? '—'} />
              <Fact k="Mobile on the document" v={d.kyc.mobileHint ?? '—'} />
              <Fact k="Verified" v={d.kyc.verifiedAt ? dateTime(d.kyc.verifiedAt) : '—'} />
            </dl>
          ) : (
            <p className="tg-muted">This account has not started an identity check.</p>
          )}
          <p className="tg-muted person__fineprint">
            We keep the last four digits and nothing more — the number itself is sent to the
            provider and discarded, so there is no fuller version of this to show.
          </p>
        </section>

        <section className="tg-card person__panel">
          <h2 className="person__panel-title">Selling access</h2>
          <p className="tg-muted person__blurb">
            A passing identity check says who somebody is. This says whether they may sell
            here, and it is yours to decide.
          </p>

          {d.sellingDecidedAt && (
            <p className="person__decision">
              <strong>{label(u.sellingState)}</strong> by {d.sellingDecidedBy ?? 'the system'} on{' '}
              {dateTime(d.sellingDecidedAt)}
              {d.sellingNote && <span className="tg-muted person__note"> — “{d.sellingNote}”</span>}
            </p>
          )}

          {!verified && (
            <p className="tg-muted person__blocked">
              Nothing to decide until the identity check has passed.
            </p>
          )}

          {verified && (
            <>
              <label className="person__field">
                <span className="tg-muted">Note (kept with the decision)</span>
                <input
                  className="tg-input"
                  value={note}
                  placeholder="What you checked"
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className="person__actions">
                <button
                  className="tg-button tg-button--primary"
                  disabled={busy || u.sellingState === 'approved'}
                  onClick={() => decide(true)}
                >
                  {u.sellingState === 'approved' ? 'Already selling' : 'Approve selling'}
                </button>
                <button
                  className="tg-button tg-button--subtle"
                  disabled={busy || u.sellingState === 'rejected'}
                  onClick={() => decide(false)}
                >
                  {u.sellingState === 'rejected' ? 'Already refused' : 'Refuse'}
                </button>
              </div>
            </>
          )}

          {d.payoutAccountHint && (
            <p className="tg-muted person__fineprint">Payout destination on file: {d.payoutAccountHint}</p>
          )}
          {error && <p className="person__error" role="alert">{error}</p>}
        </section>

        <PayoutCheckPanel userId={u.userId} />
      </div>

      <div className="person__tabs" role="tablist">
        <button
          role="tab" aria-selected={tab === 'selling'}
          className={`person__tab${tab === 'selling' ? ' person__tab--on' : ''}`}
          onClick={() => setTab('selling')}
        >
          Selling <span className="tg-muted">({u.itemsListed})</span>
        </button>
        <button
          role="tab" aria-selected={tab === 'buying'}
          className={`person__tab${tab === 'buying' ? ' person__tab--on' : ''}`}
          onClick={() => setTab('buying')}
        >
          Buying <span className="tg-muted">({u.ordersPlaced})</span>
        </button>
      </div>

      {tab === 'selling' ? <SellingTab userId={id} /> : <BuyingTab userId={id} />}
    </div>
  )
}

function SellingTab({ userId }: { userId: string }) {
  const rows = useApi(() => api.staffUserSelling(userId), [userId])
  const all = useMemo(() => rows.data ?? [], [rows.data])
  const page = usePaged(all, (r) => `${r.title} ${r.state} ${r.gradeCode ?? ''}`)
  if (rows.loading && !rows.data) return <Loading label="Loading gear" />
  if (rows.error) return <ErrorNote error={rows.error} onRetry={rows.reload} />
  if (all.length === 0) return <p className="tg-muted person__empty">Nothing consigned.</p>

  return (
    <>
    <TableTools page={page} placeholder="Find gear or state" noun="units" />
    <table className="people__table">
      <thead>
        <tr>
          <th>Gear</th><th>State</th><th>Grade</th>
          <th className="people__num">Asking</th>
          <th className="people__num">Listed</th>
          <th className="people__num">Sold for</th>
          <th>Submitted</th>
        </tr>
      </thead>
      <tbody>
        {page.rows.map((r) => (
          <tr key={r.itemId}>
            <td><Link to={`/items/${r.itemId}`} className="people__name">{withoutGrade(r.title)}</Link></td>
            <td><span className="tg-badge">{label(r.state)}</span></td>
            <td>{r.gradeCode ? <GradeBadge code={r.gradeCode} /> : '—'}</td>
            <td className="people__num">{r.askingMinor ? money(r.askingMinor) : '—'}</td>
            <td className="people__num">{r.listedPriceMinor ? money(r.listedPriceMinor) : '—'}</td>
            <td className="people__num">{r.soldPriceMinor ? money(r.soldPriceMinor) : '—'}</td>
            <td className="tg-muted people__when">{r.submittedAt ? dateOnly(r.submittedAt) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <Pager page={page} />
    </>
  )
}

function BuyingTab({ userId }: { userId: string }) {
  const rows = useApi(() => api.staffUserBuying(userId), [userId])
  const all = useMemo(() => rows.data ?? [], [rows.data])
  const page = usePaged(all, (r) => `${r.orderNumber} ${r.title} ${r.orderState} ${r.lineState}`)
  if (rows.loading && !rows.data) return <Loading label="Loading orders" />
  if (rows.error) return <ErrorNote error={rows.error} onRetry={rows.reload} />
  if (all.length === 0) return <p className="tg-muted person__empty">Nothing bought.</p>

  return (
    <>
    <TableTools page={page} placeholder="Find an order or gear" noun="lines" />
    <table className="people__table">
      <thead>
        <tr>
          <th>Order</th><th>Gear</th><th>Grade</th>
          <th>Order state</th><th>This line</th>
          <th className="people__num">Paid</th><th>Placed</th>
        </tr>
      </thead>
      <tbody>
        {page.rows.map((r, i) => (
          <tr key={`${r.orderId}-${i}`}>
            <td className="tg-mono">{r.orderNumber}</td>
            <td>{withoutGrade(r.title)}</td>
            <td>{r.gradeCode ? <GradeBadge code={r.gradeCode} /> : '—'}</td>
            <td><span className="tg-badge">{label(r.orderState)}</span></td>
            <td><span className="tg-badge">{label(r.lineState)}</span></td>
            <td className="people__num">{money(r.pricePaidMinor)}</td>
            <td className="tg-muted people__when">{r.placedAt ? dateOnly(r.placedAt) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <Pager page={page} />
    </>
  )
}

const PAGE = 20

type Paged<T> = { rows: T[]; total: number; matched: number; from: number; to: number; q: string; setQ: (q: string) => void; at: number; setAt: (n: number) => void }

/**
 * TG-205: a long-standing seller has hundreds of rows. Filter as you type,
 * twenty at a time; the filter runs on what the page already holds.
 */
function usePaged<T>(list: T[], text: (r: T) => string): Paged<T> {
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? list.filter((r) => text(r).toLowerCase().includes(t)) : list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, q])
  useEffect(() => { setAt(0) }, [q])
  const from = Math.min(at, Math.max(0, hits.length - 1))
  return { rows: hits.slice(from, from + PAGE), total: list.length, matched: hits.length, from, to: Math.min(hits.length, from + PAGE), q, setQ, at, setAt }
}

function TableTools<T>({ page, placeholder, noun }: { page: Paged<T>; placeholder: string; noun: string }) {
  if (page.total <= 8) return null
  return (
    <div className="person__tools">
      <input className="tg-input person__find" type="search" value={page.q} placeholder={placeholder}
        aria-label={placeholder} onChange={(e) => page.setQ(e.target.value)} />
      <span className="tg-muted" role="status">
        {page.q.trim() ? `${page.matched} of ${page.total} ${noun} match` : `${page.total} ${noun}`}
      </span>
    </div>
  )
}

function Pager<T>({ page }: { page: Paged<T> }) {
  if (page.matched === 0) return <p className="tg-muted person__empty">Nothing matches “{page.q.trim()}”.</p>
  if (page.matched <= PAGE) return null
  return (
    <nav className="person__pager" aria-label="Pages">
      <span className="tg-muted">{page.from + 1}–{page.to} of {page.matched}</span>
      <button className="c-btn c-btn--sm" disabled={page.from === 0} onClick={() => page.setAt(Math.max(0, page.from - PAGE))}>Previous</button>
      <button className="c-btn c-btn--sm" disabled={page.to >= page.matched} onClick={() => page.setAt(page.from + PAGE)}>Next</button>
    </nav>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="person__fact">
      <dt className="tg-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

function label(v: string) {
  return v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

/**
 * A catalogue title carries the grade ("X-T5 · TG-10"), which is useful on a
 * listing and repetitive in a table that already has a grade column.
 */
function withoutGrade(title: string) {
  return title.replace(/\s*·\s*TG-\d+\s*$/, '')
}
