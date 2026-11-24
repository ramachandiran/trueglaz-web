import { useState } from 'react'
import { api, dateTime, useApi, type AuditEntry } from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import './AuditPage.css'
import { PageHead } from '../components/PageHead'
import { Icon, ICONS } from '../components/StaffShell'
import '../components/QueueScreen.css'

const PAGE = 50

/**
 * The application-wide audit trail: who did what, when, and to what.
 *
 * Admin only, and read-only — there is no edit or delete here on purpose. A log
 * that the people it records can change is not a log. The rows come two ways:
 * a `request` line for every state-changing call (what route, what outcome), and
 * a `domain` line for an event described in its own terms (a payout approved, a
 * seller approved) with the before and after.
 */
export function AuditPage() {
  const [action, setAction] = useState('')
  const [source, setSource] = useState('')
  const [offset, setOffset] = useState(0)

  const page = useApi(
    () => api.auditLog({ action: action.trim() || undefined, source: source || undefined, limit: PAGE, offset }),
    [action, source, offset],
  )

  const entries = page.data?.entries ?? []
  const total = page.data?.total ?? 0

  function reset(set: (v: string) => void) {
    return (v: string) => { set(v); setOffset(0) }
  }

  return (
    <div className="c-stack audit">
      <PageHead title="Audit log" subtitle={`Every action that changed something, newest first. ${total.toLocaleString()} recorded.`}
        crumbs={[{ label: 'Control room', to: '/admin' }, { label: 'Audit log' }]} />
    <section className="c-card c-tcard" aria-label="Audit entries">
      <div className="c-tbar">
        <h2>Entries</h2>
        <label className="c-tbar__search audit__search">
          <Icon d={ICONS.search} />
          <input type="search" aria-label="Filter by action" placeholder="Action, e.g. payout or POST /api/v1/payouts"
            value={action} onChange={(e) => reset(setAction)(e.target.value)} />
        </label>
        <select aria-label="Source" value={source} onChange={(e) => reset(setSource)(e.target.value)}>
          <option value="">All sources</option>
          <option value="request">Requests</option>
          <option value="domain">Events</option>
        </select>
      </div>

      {page.loading && !page.data && <Loading label="Loading the audit trail" />}
      {page.error && <ErrorNote error={page.error} onRetry={page.reload} />}

      {page.data && entries.length === 0 && <p className="audit__empty">Nothing matches that.</p>}

      {entries.length > 0 && (
        <div className="audit__tablewrap q__table-container" tabIndex={0} role="region" aria-label="Audit entries table">
          <table className="audit__table q__table">
            <thead>
              <tr><th>When</th><th>Who</th><th>Action</th><th>Outcome</th><th>Target</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => <Row key={e.id} e={e} />)}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE && (
        <nav className="q__pagination" aria-label="Pages">
          <span className="q__page-info">Showing <b>{offset + 1}</b> to <b>{Math.min(offset + PAGE, total)}</b> of <b>{total.toLocaleString()}</b></span>
          <div className="q__pages">
            <button type="button" className="q__page q__page--word" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Newer</button>
            <button type="button" className="q__page q__page--word" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Older</button>
          </div>
        </nav>
      )}
    </section>
    </div>
  )
}

function Row({ e }: { e: AuditEntry }) {
  const who = e.actorName?.trim() || e.actorEmail || (e.actorUserId ? e.actorUserId.slice(0, 8) : 'Anonymous')
  const ok = e.httpStatus == null || e.httpStatus < 400
  return (
    <tr>
      <td className="audit__when">{dateTime(e.occurredAt)}</td>
      <td>
        <span className="audit__who">{who}</span>
        {e.actorRole && <span className="audit__role">{e.actorRole}</span>}
      </td>
      <td className="audit__action">
        <code>{e.action}</code>
        <span className={`audit__src audit__src--${e.source}`}>{e.source}</span>
      </td>
      <td>{e.httpStatus != null
        ? <span className={`audit__status ${ok ? 'audit__status--ok' : 'audit__status--bad'}`}>{e.httpStatus}</span>
        : <span className="audit__muted">—</span>}
      </td>
      <td className="audit__target">
        {e.entityType ? <span>{e.entityType}{e.entityId && <span className="audit__muted"> {e.entityId.slice(0, 8)}</span>}</span> : <span className="audit__muted">—</span>}
      </td>
      <td className="audit__detail">{detail(e)}</td>
    </tr>
  )
}

/** The most informative thing we have: an explicit reason, a before→after, or the path. */
function detail(e: AuditEntry): string {
  if (e.reason) return e.reason
  if (e.before || e.after) {
    const b = summarise(e.before), a = summarise(e.after)
    if (b || a) return `${b || '∅'} → ${a || '∅'}`
  }
  if (e.ip && e.source === 'request') return e.ip
  return ''
}

function summarise(json: string | null): string {
  if (!json) return ''
  try {
    const o = JSON.parse(json) as Record<string, unknown>
    return Object.entries(o).map(([k, v]) => `${k}=${v}`).join(', ')
  } catch {
    return ''
  }
}
