import { useEffect, useState } from 'react'
import {
  api, ApiError, dateOnly, dateTime, money, useApi,
  type InsuranceDeskDetail, type InsuranceStatus,
} from '@trueglaz/core'
import { Empty, ErrorNote, Loading } from '../components/ui'
import { openInsuranceDocument } from '../components/VaultInsurance'
import './OpsPage.css'
import './InsuranceDeskPage.css'

const TABS: { key: InsuranceStatus; label: string }[] = [
  { key: 'requested', label: 'New' },
  { key: 'with_agent', label: 'With agent' },
  { key: 'quote_shared', label: 'Quote with customer' },
  { key: 'policy_uploaded', label: 'Policy to check' },
  { key: 'insured', label: 'Insured' },
  { key: 'closed', label: 'Closed' },
]
const STATUS_LABEL = Object.fromEntries(TABS.map((t) => [t.key, t.label])) as Record<InsuranceStatus, string>
const OPEN: InsuranceStatus[] = ['requested', 'with_agent', 'quote_shared', 'policy_uploaded']

const OUTCOMES = [
  { value: '', label: 'Just a note' },
  { value: 'spoke', label: 'Spoke to the customer' },
  { value: 'no_answer', label: 'Called — no answer' },
  { value: 'message', label: 'Sent a message' },
  { value: 'agent_update', label: 'Update from the agent' },
  { value: 'other', label: 'Other' },
]

/**
 * The insurance desk: quote requests from Gear Vault, worked by hand.
 *
 * TrueGlaz is not the insurer or an agent. Staff pass each request to a
 * licensed agent (named in free text, for our reference only), log every
 * follow-up, mark when the quote reached the customer, and check the policy
 * the customer uploads before their gear shows as insured. The customer is
 * promised a call within 3 working days.
 */
export function InsuranceDeskPage() {
  const [tab, setTab] = useState<InsuranceStatus>('requested')
  const counts = useApi(() => api.insuranceCounts(), [])
  const queue = useApi(() => api.insuranceQueue(tab), [tab])
  const [selected, setSelected] = useState<string | null>(null)

  const rows = queue.data ?? []
  useEffect(() => {
    if (rows.length && !rows.some((r) => r.id === selected)) setSelected(rows[0].id)
    if (!rows.length) setSelected(null)
  }, [queue.data]) // eslint-disable-line react-hooks/exhaustive-deps

  // After an action, follow the request to its new tab so it stays open.
  function refresh(status?: InsuranceStatus) {
    counts.reload()
    if (status && status !== tab) setTab(status)
    else queue.reload()
  }
  const overdue = rows.filter((r) => r.overdue).length

  return (
    <div className="ops desk">
      <h1 className="ops__title">Insurance desk</h1>
      <p className="tg-muted ops__fineprint">
        Quote requests from Gear Vault. Pass each one to the agent and get the customer a call within 3 working days.
        TrueGlaz never prices cover or takes payment.
      </p>

      <div className="desk__tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            className={`desk__tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}<b>{counts.data?.[t.key] ?? 0}</b>
          </button>
        ))}
      </div>

      {queue.loading && !queue.data && <Loading label="Loading requests" />}
      {queue.error && <ErrorNote error={queue.error} onRetry={queue.reload} />}
      {queue.data && rows.length === 0 && (
        <Empty title={`Nothing in ${STATUS_LABEL[tab]}`} hint="Requests appear here when owners ask for a quote in their Gear Vault." />
      )}
      {overdue > 0 && <p className="ops__error" role="status">{overdue} past the 3-working-day promise — call these first.</p>}

      {rows.length > 0 && (
        <div className="desk__grid">
          <table className="desk__table">
            <thead>
              <tr><th>Owner</th><th>Item</th><th>Cover</th><th>Invoice</th><th>Asked</th><th>{OPEN.includes(tab) ? 'Reply by' : 'Updated'}</th><th>Agent</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.id === selected ? 'sel' : ''} onClick={() => setSelected(r.id)}
                  tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSelected(r.id) }} aria-selected={r.id === selected}>
                  <td><b>{r.ownerName ?? 'Customer'}</b><small>{r.callTime ? `Call: ${r.callTime}` : r.source === 'own' ? 'Own policy' : ''}</small></td>
                  <td>{r.modelLabel}</td>
                  <td>{money(r.coverMinor)}</td>
                  <td>{r.invoiceKind ? <span className="desk__doc">{r.invoiceKind === 'trueglaz' ? 'TrueGlaz' : r.invoiceKind.toUpperCase()}</span> : '—'}</td>
                  <td>{dateOnly(r.requestedAt)}</td>
                  <td>
                    {OPEN.includes(tab)
                      ? <span className={r.overdue ? 'desk__late' : ''}>{r.overdue ? 'Overdue · ' : ''}{dateOnly(r.replyBy)}</span>
                      : dateOnly(r.updatedAt)}
                    {r.followUpDue && <small className="desk__late">Follow up today</small>}
                  </td>
                  <td>{r.agentName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {selected && <Detail key={selected} id={selected} onChanged={refresh} />}
        </div>
      )}
    </div>
  )
}

function Detail({ id, onChanged }: { id: string; onChanged: (status: InsuranceStatus) => void }) {
  const d = useApi(() => api.insuranceDetail(id), [id])
  const [view, setView] = useState<InsuranceDeskDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [serial, setSerial] = useState<string | null>(null)
  const [outcome, setOutcome] = useState('')
  const [note, setNote] = useState('')
  const [follow, setFollow] = useState('')
  const [agent, setAgent] = useState('')
  const [reason, setReason] = useState('')
  const [ticked, setTicked] = useState(false)
  const [panel, setPanel] = useState<null | 'agent' | 'close' | 'reupload'>(null)

  const x = view ?? d.data
  useEffect(() => { if (d.data) { setView(null); setAgent(d.data.row.agentName ?? '') } }, [d.data])

  async function act(fn: () => Promise<InsuranceDeskDetail>, after?: () => void) {
    setBusy(true); setErr(null)
    try { const r = await fn(); setView(r); after?.(); onChanged(r.row.status) }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'That did not work') }
    finally { setBusy(false) }
  }

  async function openTrueglazInvoice(invoiceId: string) {
    const tab = window.open('', '_blank')
    try { const blob = await api.invoiceDocument(invoiceId); if (tab) tab.location.href = URL.createObjectURL(blob) }
    catch { tab?.close(); setErr('Could not open the invoice') }
  }

  if (d.loading && !x) return <section className="desk__panel"><Loading /></section>
  if (d.error) return <section className="desk__panel"><ErrorNote error={d.error} onRetry={d.reload} /></section>
  if (!x) return null
  const r = x.row
  const open = OPEN.includes(r.status)
  const sp = x.submittedPolicy

  return (
    <section className="desk__panel" aria-label={`${r.modelLabel} for ${r.ownerName ?? 'customer'}`}>
      <div className="desk__head">
        <h2>{r.modelLabel} · {r.ownerName ?? 'Customer'}</h2>
        <span className={`desk__st desk__st--${r.status}`}>{STATUS_LABEL[r.status]}</span>
      </div>

      <dl className="desk__kv">
        <dt>Phone</dt><dd>{x.phone ? <a href={`tel:${x.phone}`}><b>{x.phone}</b></a> : '—'}{r.callTime ? ` · best: ${r.callTime}` : ''}</dd>
        <dt>Email</dt><dd>{x.email ?? '—'}</dd>
        <dt>Serial</dt>
        <dd>
          {serial ?? (x.serialLast4 ? `••••${x.serialLast4}` : x.serialReadable ? '—' : 'PIN-locked — see the invoice')}
          {!serial && x.serialReadable && (<>{' '}
            <button className="desk__link" onClick={async () => {
              try { setSerial((await api.insuranceSerial(id)).serial) } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not show it') }
            }}>Show full (logged)</button></>
          )}
        </dd>
        <dt>Bought</dt><dd>{x.purchaseDate ? dateOnly(x.purchaseDate) : '—'}{x.paidMinor ? ` · ${money(x.paidMinor)}` : ''}</dd>
        <dt>New price</dt><dd>{x.newPriceMinor ? money(x.newPriceMinor) : '—'}</dd>
        <dt>Cover asked</dt><dd>{money(r.coverMinor)}</dd>
        <dt>Invoice</dt>
        <dd>
          {x.invoice?.kind === 'upload' && x.invoice.documentId && (
            <button className="desk__link" onClick={() => openInsuranceDocument(x.invoice!.documentId!)}>{x.invoice.label}</button>
          )}
          {x.invoice?.kind === 'trueglaz' && x.invoice.invoiceId && (
            <button className="desk__link" onClick={() => openTrueglazInvoice(x.invoice!.invoiceId!)}>{x.invoice.label}</button>
          )}
          {!x.invoice && '—'}
        </dd>
        <dt>Terms</dt>
        <dd>{x.termsVersion ? `Accepted ${dateTime(x.termsAcceptedAt)} · consent to share ${x.consentAt ? '✓' : '✕'}` : 'Own policy — no quote'}</dd>
        {r.agentName && <><dt>Agent</dt><dd>{r.agentName}</dd></>}
        {x.closedReason && <><dt>Closed</dt><dd>{x.closedReason}</dd></>}
        {x.reuploadReason && <><dt>Sent back</dt><dd>{x.reuploadReason}</dd></>}
      </dl>

      {sp && (
        <>
          <div className="desk__lbl">Policy uploaded {sp.uploadedAt ? `· ${dateTime(sp.uploadedAt)}` : ''}</div>
          <dl className="desk__kv">
            <dt>Document</dt><dd>{sp.documentId ? <button className="desk__link" onClick={() => openInsuranceDocument(sp.documentId!)}>Open policy</button> : '—'}</dd>
            <dt>Insurer</dt><dd>{sp.insurerName}</dd>
            <dt>Policy no.</dt><dd>{sp.policyNo}</dd>
          </dl>
          {r.status === 'policy_uploaded' && (
            <>
              <div className="desk__lbl">Check against the document</div>
              <ul className="desk__checks">
                {x.checks.map((c) => (
                  <li key={c.label} className={c.ok === true ? 'ok' : c.ok === false ? 'bad' : 'look'}>
                    <span aria-hidden="true">{c.ok === true ? '✓' : c.ok === false ? '!' : '?'}</span>
                    <span><b>{c.label}</b> — {c.detail}</span>
                  </li>
                ))}
              </ul>
              <label className="desk__tick">
                <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
                I opened the policy: the name and serial match this customer and item.
              </label>
            </>
          )}
        </>
      )}

      {err && <p className="ops__error" role="alert">{err}</p>}

      {open && (
        <div className="desk__acts">
          {r.status === 'requested' && <button className="tg-button tg-button--primary" disabled={busy} onClick={() => setPanel(panel === 'agent' ? null : 'agent')}>Sent to agent →</button>}
          {r.status === 'with_agent' && (
            <>
              <button className="tg-button tg-button--primary" disabled={busy} onClick={() => act(() => api.insuranceQuoteShared(id))}>Quote shared with customer</button>
              <button className="tg-button" disabled={busy} onClick={() => setPanel(panel === 'agent' ? null : 'agent')}>Change agent</button>
            </>
          )}
          {r.status === 'policy_uploaded' && (
            <>
              <button className="tg-button tg-button--primary" disabled={busy || !ticked} onClick={() => act(() => api.insuranceVerify(id, ticked))}>Mark insured ✓</button>
              <button className="tg-button" disabled={busy} onClick={() => setPanel(panel === 'reupload' ? null : 'reupload')}>Ask to re-upload</button>
            </>
          )}
          {r.status !== 'policy_uploaded' && <button className="desk__link" disabled={busy} onClick={() => setPanel(panel === 'close' ? null : 'close')}>Close request</button>}
        </div>
      )}

      {panel === 'agent' && (
        <div className="desk__form">
          <label className="desk__field"><span>Agent (for our reference only)</span>
            <input className="tg-input" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="Agency and person, e.g. Shield Brokers – Ravi" autoFocus /></label>
          <button className="tg-button tg-button--primary" disabled={busy || !agent.trim()}
            onClick={() => act(() => api.insuranceAgent(id, agent.trim()), () => setPanel(null))}>Save</button>
        </div>
      )}
      {(panel === 'close' || panel === 'reupload') && (
        <div className="desk__form">
          <label className="desk__field"><span>{panel === 'close' ? 'Reason — the customer reads this' : 'What to fix — the customer reads this'}</span>
            <input className="tg-input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
              placeholder={panel === 'close' ? 'e.g. You decided not to buy the cover. Ask again any time.' : 'e.g. The serial number is missing from the schedule.'} /></label>
          <button className="tg-button tg-button--primary" disabled={busy || !reason.trim()}
            onClick={() => act(() => panel === 'close' ? api.insuranceClose(id, reason.trim()) : api.insuranceReupload(id, reason.trim()),
              () => { setPanel(null); setReason('') })}>
            {panel === 'close' ? 'Close request' : 'Send back'}
          </button>
        </div>
      )}

      {open && (
        <>
          <div className="desk__lbl">Add follow-up</div>
          <div className="desk__note">
            <select className="tg-input" value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label="Outcome">
              {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <textarea className="tg-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the team…" aria-label="Note" />
            <div className="desk__note-row">
              <label>Next follow-up <input className="tg-input" type="date" value={follow} onChange={(e) => setFollow(e.target.value)} /></label>
              <button className="tg-button" disabled={busy || (!note.trim() && !outcome && !follow)}
                onClick={() => act(() => api.insuranceNote(id, { outcome: outcome || null, body: note.trim() || null, nextFollowUpOn: follow || null }),
                  () => { setNote(''); setOutcome(''); setFollow('') })}>Save note</button>
            </div>
          </div>
        </>
      )}

      <div className="desk__lbl">Follow-up log</div>
      <ol className="desk__log">
        {x.notes.map((n) => (
          <li key={n.id} className={n.kind}>
            <time>{dateTime(n.createdAt)}</time>
            <span>{n.authorName && <b>{n.authorName} — </b>}{n.body}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
