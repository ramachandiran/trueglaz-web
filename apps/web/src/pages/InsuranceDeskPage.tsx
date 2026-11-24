import { useEffect, useState } from 'react'
import {
  api, ApiError, dateOnly, dateTime, money, useApi,
  type InsuranceDeskDetail, type InsuranceStatus,
} from '@trueglaz/core'
import { Empty, ErrorNote, Loading } from '../components/ui'
import { useQueryState } from '../components/useQueryState'
import { openInsuranceDocument } from '../components/VaultInsurance'
import './OpsPage.css'
import './InsuranceDeskPage.css'
import { PageHead } from '../components/PageHead'
import { KpiCard, KpiRow } from '../components/KpiCard'
import { Icon, ICONS } from '../components/StaffShell'
import { FactGrid, PanelSection, SidePanel } from '../components/SidePanel'

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
  const [tabParam, setTabParam] = useQueryState('tab', 'requested')
  const tab = (TABS.some((t) => t.key === tabParam) ? tabParam : 'requested') as InsuranceStatus
  const setTab = (t: InsuranceStatus) => setTabParam(t)
  const counts = useApi(() => api.insuranceCounts(), [])
  const queue = useApi(() => api.insuranceQueue(tab), [tab])
  // The open request lives in the address (?open=), so a link can open it.
  const [openParam, setOpenParam] = useQueryState('open')
  const openId = openParam || null
  const setOpenId = (id: string | null) => setOpenParam(id ?? '')

  const rows = queue.data ?? []

  // After an action, follow the request to its new tab so it stays open.
  function refresh(status?: InsuranceStatus) {
    counts.reload()
    if (status && status !== tab) setTab(status)
    else queue.reload()
  }
  const overdue = rows.filter((r) => r.overdue).length
  const n = (k: InsuranceStatus) => counts.data?.[k] ?? 0

  return (
    <div className="c-stack desk">
      <PageHead title="Insurance desk"
        subtitle="Quote requests from Gear Vault: pass each to the agent; the customer gets a call within 3 working days. TrueGlaz never prices cover or takes payment."
        crumbs={[{ label: 'Control room', to: '/admin' }, { label: 'Insurance desk' }]} />

      <KpiRow label="Requests by stage">
        <KpiCard icon={ICONS.bell} lead title="New requests" value={n('requested')} pressed={tab === 'requested'} onClick={() => setTab('requested')}
          tone={overdue > 0 ? 'bad' : undefined}
          chip={overdue > 0 ? <span className="c-chip2 c-chip2--bad"><Icon d={ICONS.clock} /> {overdue} overdue</span> : undefined}
          note="pass to the agent" />
        <KpiCard icon={ICONS.people} title="With the agent" value={n('with_agent') + n('quote_shared')} pressed={tab === 'with_agent' || tab === 'quote_shared'}
          onClick={() => setTab('with_agent')} note={`${n('quote_shared')} quote${n('quote_shared') === 1 ? '' : 's'} with customers`} />
        <KpiCard icon={ICONS.audit} title="Policies to check" value={n('policy_uploaded')} pressed={tab === 'policy_uploaded'}
          onClick={() => setTab('policy_uploaded')} note="customer uploaded a policy" />
        <KpiCard icon={ICONS.insurance} title="Insured" value={n('insured')} pressed={tab === 'insured'} onClick={() => setTab('insured')} note="cover in force" />
      </KpiRow>

      <div className="c-tbar">
        <div className="c-tabs" role="tablist" aria-label="Insurance requests">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
              className={`c-tabs__tab${tab === t.key ? ' c-tabs__tab--on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}<span className="c-tabs__n">{n(t.key)}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="c-card c-tcard desk__card" aria-label={`${STATUS_LABEL[tab]} requests`}>
        {overdue > 0 && (
          <div className="desk__alert" role="status">
            <Icon d={ICONS.alert} />
            <span><b>{overdue} past the 3-working-day promise.</b> Call these first.</span>
          </div>
        )}
        {queue.loading && !queue.data && <Loading label="Loading requests" />}
        {queue.error && <ErrorNote error={queue.error} onRetry={queue.reload} />}
        {queue.data && rows.length === 0 && (
          <Empty title={`Nothing in ${STATUS_LABEL[tab]}`} hint="Requests appear here when owners ask for a quote in their Gear Vault." />
        )}
        {rows.length > 0 && (
          <div className="q__table-container">
            <table className="q__table desk__table">
              <thead>
                <tr><th>Owner</th><th>Item</th><th className="q__num">Cover</th><th>Invoice</th><th>Asked</th><th>{OPEN.includes(tab) ? 'Reply by' : 'Updated'}</th><th>Agent</th><th><span className="tg-visually-hidden">Open</span></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`q__row--click${r.id === openId ? ' desk__row--on' : ''}${r.overdue ? ' desk__row--late' : ''}`} onClick={() => setOpenId(r.id)}>
                    <td>
                      <span className="c-who">
                        <span className="c-av c-av--0">{initials(r.ownerName)}</span>
                        <span><b>{r.ownerName ?? 'Customer'}</b><span>{r.callTime ? `Call: ${r.callTime}` : r.source === 'own' ? 'Own policy' : '—'}</span></span>
                      </span>
                    </td>
                    <td>{r.modelLabel}</td>
                    <td className="q__num">{money(r.coverMinor)}</td>
                    <td>{r.invoiceKind ? <span className="c-chip2">{r.invoiceKind === 'trueglaz' ? 'TrueGlaz' : r.invoiceKind.toUpperCase()}</span> : '—'}</td>
                    <td>{dateOnly(r.requestedAt)}</td>
                    <td>
                      {OPEN.includes(tab)
                        ? r.overdue
                          ? <span className="c-chip2 c-chip2--bad"><Icon d={ICONS.clock} /> Overdue · {dateOnly(r.replyBy)}</span>
                          : dateOnly(r.replyBy)
                        : dateOnly(r.updatedAt)}
                      {r.followUpDue && <div><span className="c-chip2 c-chip2--warn">Follow up today</span></div>}
                    </td>
                    <td>{r.agentName ?? <span className="tg-muted">—</span>}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="c-btn c-btn--sm" onClick={() => setOpenId(r.id)} aria-label={`Open ${r.modelLabel} for ${r.ownerName ?? 'customer'}`}>
                        Open <Icon d={ICONS.chevron} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openId && <Detail key={openId} id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </div>
  )
}

function initials(name: string | null): string {
  const p = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function Detail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (status: InsuranceStatus) => void }) {
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

  if (!x) {
    return (
      <SidePanel open onClose={onClose} eyebrow="Insurance request" title="Loading…">
        {d.error ? <ErrorNote error={d.error} onRetry={d.reload} /> : <Loading label="Loading the request" />}
      </SidePanel>
    )
  }
  const r = x.row
  const open = OPEN.includes(r.status)
  const sp = x.submittedPolicy
  const tone = r.status === 'insured' ? 'good' : r.status === 'closed' ? '' : r.status === 'requested' ? 'warn' : 'navy'

  // The one thing to do next, at the foot of the panel.
  const footer = open ? (
    <>
      {r.status === 'requested' && (
        <button type="button" className="c-btn c-btn--cta" disabled={busy} onClick={() => setPanel(panel === 'agent' ? null : 'agent')}>
          <Icon d={ICONS.people} /> Sent to agent
        </button>
      )}
      {r.status === 'with_agent' && (
        <>
          <button type="button" className="c-btn c-btn--cta" disabled={busy} onClick={() => act(() => api.insuranceQuoteShared(id))}>
            <Icon d={ICONS.check} /> Quote shared with customer
          </button>
          <button type="button" className="c-btn" disabled={busy} onClick={() => setPanel(panel === 'agent' ? null : 'agent')}>Change agent</button>
        </>
      )}
      {r.status === 'quote_shared' && <span className="tg-muted desk__wait">Waiting for the customer to upload their policy.</span>}
      {r.status === 'policy_uploaded' && (
        <>
          <button type="button" className="c-btn c-btn--cta" disabled={busy || !ticked} onClick={() => act(() => api.insuranceVerify(id, ticked))}
            title={ticked ? undefined : 'Tick the check above first'}>
            <Icon d={ICONS.insurance} /> Mark insured
          </button>
          <button type="button" className="c-btn" disabled={busy} onClick={() => setPanel(panel === 'reupload' ? null : 'reupload')}>Ask to re-upload</button>
        </>
      )}
      {r.status !== 'policy_uploaded' && (
        <button type="button" className="c-btn c-btn--bad sp__foot-end" disabled={busy} onClick={() => setPanel(panel === 'close' ? null : 'close')}>
          Close request
        </button>
      )}
    </>
  ) : undefined

  return (
    <SidePanel open onClose={onClose} width={600}
      eyebrow={`Insurance request · asked ${dateOnly(r.requestedAt)}`}
      title={r.modelLabel}
      subtitle={`Cover asked ${money(r.coverMinor)}`}
      badges={<>
        <span className={`c-chip2${tone ? ` c-chip2--${tone}` : ''}`}>{STATUS_LABEL[r.status]}</span>
        {open && r.overdue && <span className="c-chip2 c-chip2--bad"><Icon d={ICONS.clock} /> Overdue · reply by {dateOnly(r.replyBy)}</span>}
        {open && !r.overdue && r.replyBy && <span className="c-chip2"><Icon d={ICONS.clock} /> Reply by {dateOnly(r.replyBy)}</span>}
        {r.followUpDue && <span className="c-chip2 c-chip2--warn">Follow up today</span>}
      </>}
      footer={footer}>

      {err && <p className="ops__error" role="alert">{err}</p>}

      {/* The forms an action opens, right above the action bar. */}
      {panel === 'agent' && (
        <PanelSection tone="card" title={r.agentName ? 'Change agent' : 'Who has it?'}>
          <label className="desk__field"><span>Agent, for our reference only</span>
            <input className="tg-input" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="Agency and person, e.g. Shield Brokers – Ravi" autoFocus /></label>
          <div className="desk__form-acts">
            <button type="button" className="c-btn" onClick={() => setPanel(null)}>Cancel</button>
            <button type="button" className="c-btn c-btn--navy" disabled={busy || !agent.trim()}
              onClick={() => act(() => api.insuranceAgent(id, agent.trim()), () => setPanel(null))}>Save agent</button>
          </div>
        </PanelSection>
      )}
      {(panel === 'close' || panel === 'reupload') && (
        <PanelSection tone="card" title={panel === 'close' ? 'Close this request' : 'Ask for a new upload'}>
          <label className="desk__field"><span>{panel === 'close' ? 'Reason. The customer reads this.' : 'What to fix. The customer reads this.'}</span>
            <textarea className="tg-input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
              placeholder={panel === 'close' ? 'e.g. You decided not to buy the cover. Ask again any time.' : 'e.g. The serial number is missing from the schedule.'} /></label>
          <div className="desk__form-acts">
            <button type="button" className="c-btn" onClick={() => setPanel(null)}>Cancel</button>
            <button type="button" className={`c-btn ${panel === 'close' ? 'c-btn--bad' : 'c-btn--navy'}`} disabled={busy || !reason.trim()}
              onClick={() => act(() => panel === 'close' ? api.insuranceClose(id, reason.trim()) : api.insuranceReupload(id, reason.trim()),
                () => { setPanel(null); setReason('') })}>
              {panel === 'close' ? 'Close request' : 'Send back'}
            </button>
          </div>
        </PanelSection>
      )}

      <PanelSection tone="card" title="Customer">
        <div className="desk__person">
          <span className="c-av c-av--1 desk__av">{initials(r.ownerName)}</span>
          <div className="desk__person-text">
            <b>{r.ownerName ?? 'Customer'}</b>
            <span>{r.callTime ? `Best time to call: ${r.callTime}` : r.source === 'own' ? 'Own policy' : 'No call time given'}</span>
          </div>
        </div>
        <div className="desk__contact">
          {x.phone
            ? <a className="c-btn c-btn--navy" href={`tel:${x.phone}`}><Icon d={ICONS.phone} /> Call {x.phone}</a>
            : <span className="tg-muted">No phone on file</span>}
          {x.email && <a className="c-btn" href={`mailto:${x.email}`}>Email {x.email}</a>}
        </div>
      </PanelSection>

      <PanelSection tone="card" title="Item & cover">
        <FactGrid facts={[
          { label: 'Item', value: r.modelLabel },
          { label: 'Cover asked', value: money(r.coverMinor) },
          { label: 'Bought', value: <>{x.purchaseDate ? dateOnly(x.purchaseDate) : '—'}{x.paidMinor ? ` · ${money(x.paidMinor)}` : ''}</> },
          { label: 'New price today', value: x.newPriceMinor ? money(x.newPriceMinor) : '—' },
          {
            label: 'Serial', value: <>
              {serial ?? (x.serialLast4 ? `••••${x.serialLast4}` : x.serialReadable ? '—' : 'Not on file; see the invoice')}
              {!serial && x.serialReadable && (
                <button type="button" className="desk__link" onClick={async () => {
                  try { setSerial((await api.insuranceSerial(id)).serial) } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not show it') }
                }}>Show full (logged)</button>
              )}
            </>,
          },
          {
            label: 'Invoice', value: x.invoice?.kind === 'upload' && x.invoice.documentId
              ? <button type="button" className="c-btn c-btn--sm" onClick={() => openInsuranceDocument(x.invoice!.documentId!)}><Icon d={ICONS.audit} /> {x.invoice.label}</button>
              : x.invoice?.kind === 'trueglaz' && x.invoice.invoiceId
                ? <button type="button" className="c-btn c-btn--sm" onClick={() => openTrueglazInvoice(x.invoice!.invoiceId!)}><Icon d={ICONS.audit} /> {x.invoice.label}</button>
                : '—',
          },
          ...(r.agentName ? [{ label: 'Agent', value: r.agentName }] : []),
          ...(x.closedReason ? [{ label: 'Closed because', value: x.closedReason, wide: true }] : []),
          ...(x.reuploadReason ? [{ label: 'Sent back because', value: x.reuploadReason, wide: true }] : []),
        ]} />
        <p className="desk__consent">
          <Icon d={x.consentAt ? ICONS.check : ICONS.alert} />
          {x.termsVersion
            ? <>Terms accepted {dateTime(x.termsAcceptedAt)} · {x.consentAt ? 'consented to share details with the agent' : 'no consent to share yet'}</>
            : 'Own policy, so no quote and no terms to accept'}
        </p>
      </PanelSection>

      {sp && (
        <PanelSection tone="card" title="Policy uploaded" aside={sp.uploadedAt ? <span className="tg-muted desk__small">{dateTime(sp.uploadedAt)}</span> : undefined}>
          <FactGrid facts={[
            { label: 'Insurer', value: sp.insurerName },
            { label: 'Policy number', value: <span className="tg-mono">{sp.policyNo}</span> },
            { label: 'Document', value: sp.documentId ? <button type="button" className="c-btn c-btn--sm" onClick={() => openInsuranceDocument(sp.documentId!)}><Icon d={ICONS.audit} /> Open policy</button> : '—', wide: true },
          ]} />
          {r.status === 'policy_uploaded' && (
            <>
              <ul className="desk__checks">
                {x.checks.map((c) => (
                  <li key={c.label} className={c.ok === true ? 'ok' : c.ok === false ? 'bad' : 'look'}>
                    <span className="desk__check-ic" aria-hidden="true"><Icon d={c.ok === true ? ICONS.check : c.ok === false ? ICONS.alert : ICONS.help} /></span>
                    <span><b>{c.label}</b><small>{c.detail}</small></span>
                  </li>
                ))}
              </ul>
              <label className="desk__tick">
                <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} />
                I opened the policy: the name and serial match this customer and item.
              </label>
            </>
          )}
        </PanelSection>
      )}

      {open && (
        <PanelSection tone="card" title="Log a follow-up">
          <div className="desk__outcomes" role="radiogroup" aria-label="What happened">
            {OUTCOMES.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={outcome === o.value}
                className={`desk__outcome${outcome === o.value ? ' desk__outcome--on' : ''}`} onClick={() => setOutcome(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <textarea className="tg-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the team…" aria-label="Note" />
          <div className="desk__note-row">
            <label className="desk__date">Next follow-up <input className="tg-input" type="date" value={follow} onChange={(e) => setFollow(e.target.value)} /></label>
            <button type="button" className="c-btn c-btn--navy" disabled={busy || (!note.trim() && !outcome && !follow)}
              onClick={() => act(() => api.insuranceNote(id, { outcome: outcome || null, body: note.trim() || null, nextFollowUpOn: follow || null }),
                () => { setNote(''); setOutcome(''); setFollow('') })}>Save follow-up</button>
          </div>
        </PanelSection>
      )}

      <PanelSection title="History">
        <ol className="desk__tl">
          {x.notes.map((n, i) => (
            <li key={n.id} className={n.kind}>
              <i className={i === 0 ? 'desk__tl-now' : undefined}><Icon d={n.kind === 'event' ? ICONS.check : ICONS.history} /></i>
              <span>
                <b>{n.body}</b>
                <small>{n.authorName ? `${n.authorName} · ` : ''}{dateTime(n.createdAt)}</small>
              </span>
            </li>
          ))}
          {x.notes.length === 0 && <li className="tg-muted">Nothing logged yet.</li>}
        </ol>
      </PanelSection>
    </SidePanel>
  )
}
