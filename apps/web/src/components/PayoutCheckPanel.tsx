import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, dateTime, useApi } from '@trueglaz/core'

const MATCH_LABEL: Record<string, string> = {
  DIRECT_MATCH: 'Exact match',
  GOOD_PARTIAL_MATCH: 'Good match',
  MODERATE_PARTIAL_MATCH: 'Partial match',
  POOR_PARTIAL_MATCH: 'Weak match',
  NO_MATCH: 'No match',
  UNCHECKED: 'Bank not reached',
}

export const matchLabel = (m: string | null) => (m ? MATCH_LABEL[m] ?? m : '—')

/**
 * A seller's payout account as staff need to judge it: the name the bank
 * holds, the verified name it was compared with, and how they compared.
 *
 * Only a pending account has a decision. Approving releases payouts held for
 * it; rejecting needs a reason, because the seller reads it.
 */
export function PayoutCheckPanel({ userId }: { userId: string }) {
  const acct = useApi(() => api.staffPayoutAccount(userId), [userId])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const a = acct.data

  async function decide(approve: boolean) {
    setBusy(true); setError(null)
    try {
      if (approve) await api.approvePayoutAccount(userId, note.trim() || undefined)
      else await api.rejectPayoutAccount(userId, note)
      setNote(''); acct.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(false) }
  }

  return (
    <section className="tg-card person__panel" id="payout">
      <h2 className="person__panel-title">Payout account</h2>
      {acct.loading && !a ? <p className="tg-muted">Loading…</p> : !a ? (
        <p className="tg-muted">No payout account on file.</p>
      ) : (
        <>
          <dl className="person__facts">
            <Fact k="State" v={({ pending: 'Waiting for a check', verified: 'Verified', failed: 'Refused' } as Record<string, string>)[a.state] ?? a.state} />
            <Fact k="Where it pays" v={`${a.method.toUpperCase()} · ${a.destination}`} />
            <Fact k="Holder, as typed" v={a.accountHolderName} />
            <Fact k="Holder, as the bank has it" v={a.nameAtBank ?? '—'} />
            <Fact k="Compared with" v={a.checkedAgainstName ?? '—'} />
            <Fact k="Result" v={`${matchLabel(a.nameMatch)}${a.score != null ? ` (${Math.round(a.score)})` : ''}`} />
            <Fact k="Checked by" v={a.checkProvider ?? '—'} />
            <Fact k="Added" v={a.createdAt ? dateTime(a.createdAt) : '—'} />
            {a.reviewReason && <Fact k={a.state === 'failed' ? 'Refused because' : 'Why it waits'} v={a.reviewReason} />}
          </dl>

          {a.state === 'pending' && (
            <>
              <p className="tg-muted person__blurb">
                Approve only if the holder is plainly the same person — a shortened or married
                name, say. A relative's or a business account in another name is a refusal.
              </p>
              <label className="person__field">
                <span className="tg-muted">Note (a reason is required to refuse; the seller reads it)</span>
                <input className="tg-input" value={note} placeholder="What you checked"
                  onChange={(e) => setNote(e.target.value)} />
              </label>
              <div className="person__actions">
                <button className="tg-button tg-button--primary" disabled={busy} onClick={() => decide(true)}>
                  Approve account
                </button>
                <button className="tg-button tg-button--subtle" disabled={busy || !note.trim()} onClick={() => decide(false)}>
                  Refuse account
                </button>
              </div>
            </>
          )}
        </>
      )}
      {error && <p className="person__error" role="alert">{error}</p>}
    </section>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (<><dt>{k}</dt><dd>{v}</dd></>)
}

/** The People page's reminder that payout accounts are waiting, one link each. */
export function PayoutReviewStrip() {
  const list = useApi(() => api.payoutReviews(), [])
  const rows = list.data ?? []
  if (rows.length === 0) return null
  return (
    <div className="people__payouts" role="status">
      <strong>{rows.length} payout account{rows.length === 1 ? '' : 's'} to check</strong>
      <ul>
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/admin/people/${r.userId}#payout`}>{r.ownerName ?? 'Seller'}</Link>
            <span className="tg-muted"> · bank says {r.nameAtBank ?? 'nothing'} · {matchLabel(r.nameMatch)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
