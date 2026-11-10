import { useRef, useState } from 'react'
import {
  api, ApiError, money, dateOnly, useApi, dayName, coverBasisText, insuranceOwnerStatus, insuranceStep,
  INSURANCE_STEPS, CALL_TIMES,
  type VaultItem, type InsuranceDocument, type InsuranceTerms, type CallTime,
} from '@trueglaz/core'
import { ErrorNote, Loading } from './ui'

/**
 * Insurance on a vault card, as a quote referral: TrueGlaz is not the insurer
 * or an agent. The owner reads the terms, sends the invoice, a licensed agent
 * calls them, and they add the policy they bought for us to check and keep.
 */

const ACCEPT = 'application/pdf,image/jpeg,image/png'
const MAX_BYTES = 10 * 1024 * 1024

/** Open a private document (invoice or policy) in a new tab via a short-lived link. */
export async function openInsuranceDocument(docId: string) {
  // Opened first, filled after: a tab opened after an await is a popup to the browser.
  const tab = window.open('', '_blank')
  try {
    const { url } = await api.insuranceDocumentLink(docId)
    if (tab) tab.location.href = url
    else window.location.href = url
  } catch (e) {
    tab?.close()
    window.alert(e instanceof ApiError ? e.message : 'Could not open that document')
  }
}

/** The insurance part of a gear card: one clear state and the next thing to do. */
export function CoverStrip({ item, onQuote, onAddPolicy, onClaimHelp, onChanged }: {
  item: VaultItem; onQuote: () => void; onAddPolicy: () => void; onClaimHelp: () => void; onChanged: () => void
}) {
  const r = item.insuranceRequest
  const p = item.policy
  const [busy, setBusy] = useState(false)

  async function withdraw() {
    if (!window.confirm('Withdraw your insurance quote request?')) return
    setBusy(true)
    try { await api.withdrawInsurance(item.id); onChanged() }
    catch (e) { window.alert(e instanceof ApiError ? e.message : 'Could not withdraw') }
    finally { setBusy(false) }
  }

  if (r) {
    const s = insuranceOwnerStatus(r)
    const step = insuranceStep(r.status)
    return (
      <div className="cover">
        <div className="cover__top">
          <span className={`cover__badge cover__badge--${s.tone}`}>{s.label}</span>
          {s.hint && <span className="cover__hint">{s.hint}</span>}
        </div>
        {r.source === 'quote' && (
          <ol className="cover__track" aria-label="Insurance progress">
            {INSURANCE_STEPS.map((label, i) => (
              <li key={label} className={`${i <= step ? 'is-done' : ''}${i === step ? ' is-now' : ''}`}>
                <span className="cover__dot" aria-hidden="true" />{label}
              </li>
            ))}
          </ol>
        )}
        <div className="cover__acts">
          {r.status === 'requested' || r.status === 'with_agent' ? (
            <>
              <button className="tg-button tg-button--small" disabled>✓ Submitted for quote</button>
              <button className="tg-button tg-button--small tg-button--ghost" onClick={onAddPolicy}>Add policy</button>
              <button className="cover__link" disabled={busy} onClick={withdraw}>Withdraw</button>
            </>
          ) : r.status === 'quote_shared' ? (
            <>
              <button className="tg-button tg-button--small tg-button--primary" onClick={onAddPolicy}>
                {r.reuploadReason ? 'Upload policy again' : 'Add your policy'}
              </button>
              {!r.reuploadReason && <button className="cover__link" disabled={busy} onClick={withdraw}>Not buying it</button>}
            </>
          ) : (
            <button className="tg-button tg-button--small" disabled>Policy sent for checking</button>
          )}
        </div>
      </div>
    )
  }

  if (p) {
    const renewSoon = new Date(p.expiresOn).getTime() - Date.now() < 60 * 864e5
    return (
      <div className="cover">
        <div className="cover__top">
          <span className="cover__badge cover__badge--good">✓ Insured</span>
          <span className="cover__hint">{p.insurerName ?? 'Insurer'} · {money(p.sumInsuredMinor)} · until {dateOnly(p.expiresOn)}</span>
        </div>
        <div className="cover__acts">
          {p.documentId && <button className="cover__link" onClick={() => openInsuranceDocument(p.documentId!)}>Policy document</button>}
          <button className="cover__link" onClick={onClaimHelp}>How to claim</button>
          {renewSoon && <button className="tg-button tg-button--small tg-button--primary" onClick={onAddPolicy}>Add renewed policy</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="cover cover--empty">
      <button className="tg-button tg-button--small tg-button--primary" onClick={onQuote}>Get insurance quote</button>
      <button className="cover__link" onClick={onAddPolicy}>Already insured? Add your policy</button>
    </div>
  )
}

// -- the quote request ------------------------------------------------------------

export function QuoteModal({ item, onClose, onDone }: { item: VaultItem; onClose: () => void; onDone: () => void }) {
  const start = useApi(() => api.insuranceStart(item.id), [item.id])
  const [step, setStep] = useState<1 | 2>(1)
  const [accepted, setAccepted] = useState(false)
  const [consent, setConsent] = useState(false)
  const [invoice, setInvoice] = useState<InsuranceDocument | null>(null)
  const [cover, setCover] = useState<string | null>(null)
  const [callTime, setCallTime] = useState<CallTime | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const s = start.data
  const coverValue = cover ?? (s?.coverSuggestionMinor ? String(Math.round(s.coverSuggestionMinor / 100)) : '')
  const coverMinor = Math.round((parseFloat(coverValue.replace(/,/g, '')) || 0) * 100)
  const hasInvoice = !!invoice || !!s?.trueglazInvoice
  const blocker = !s ? null
    : !s.hasSerial ? 'Add the serial number to this item first (Edit in your vault) — insurers put it on the policy.'
    : !s.phoneHint ? 'Add your phone number in Profile so the agent can call you.'
    : null
  const canSend = !!s && !blocker && hasInvoice && coverMinor > 0 && !!callTime && consent && !busy

  async function send() {
    if (!s || !callTime) return
    setBusy(true); setErr(null)
    try {
      const r = await api.requestInsuranceQuote(item.id, {
        invoiceDocumentId: invoice?.id ?? null, coverMinor, callTime,
        termsVersion: s.terms.version, acceptedTerms: accepted, consentToShare: consent,
      })
      setDone(r.replyBy ? dayName(r.replyBy) : '')
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not send the request') }
    finally { setBusy(false) }
  }

  if (done !== null) {
    return (
      <Modal title="Quote requested" onClose={onDone}>
        <p className="vault__hint"><strong>A licensed insurance agent will call you{done ? ` by ${done}` : ''} with a price.</strong></p>
        <p className="vault__hint">You pay them directly — TrueGlaz takes no payment. Once you buy, add the policy to this item so we can keep it with your gear.</p>
        <div className="vault__modal-actions"><button className="tg-button tg-button--primary" onClick={onDone}>Done</button></div>
      </Modal>
    )
  }

  return (
    <Modal title={`Get a quote for ${item.modelLabel}`} kicker={`Insurance quote · step ${step} of 2`} wide onClose={onClose}>
      <div className="ins-steps" aria-hidden="true"><i className="on" /><i className={step === 2 ? 'on' : ''} /></div>
      {start.loading && <Loading label="Loading the terms" />}
      {start.error && <ErrorNote error={start.error} />}
      {s && step === 1 && (
        <>
          <TermsBlock terms={s.terms} replyBy={dayName(s.replyBy)} />
          <label className="vault__consent">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            {s.terms.acceptance}
          </label>
          <div className="vault__modal-actions">
            <button className="tg-button" onClick={onClose}>Cancel</button>
            <button className="tg-button tg-button--primary" disabled={!accepted} onClick={() => setStep(2)}>Continue</button>
          </div>
        </>
      )}
      {s && step === 2 && (
        <>
          {blocker && <p className="ins-warn" role="alert">{blocker}</p>}
          <div className="ins-cols">
            <div>
              <div className="ins-lbl">Purchase invoice <span className="ins-req">Required</span></div>
              {s.trueglazInvoice && !invoice ? (
                <div className="ins-file ins-file--ok">
                  <span className="ins-file__ic" aria-hidden="true">✓</span>
                  <span className="ins-file__name"><b>TrueGlaz invoice {s.trueglazInvoice.number}</b><small>Attached for you — bought on TrueGlaz</small></span>
                </div>
              ) : (
                <FilePick itemId={item.id} kind="invoice" doc={invoice} onDoc={setInvoice} />
              )}
              <p className="vault__hint">PDF or photo. It should show the seller, date, price and serial number.</p>

              <label className="vault__field" style={{ marginTop: 12 }}>
                <span>{coverBasisText(s.coverBasis)} (₹)</span>
                <input className="tg-input" inputMode="numeric" value={coverValue}
                  onChange={(e) => setCover(e.target.value.replace(/[^\d.,]/g, ''))} />
              </label>
              <p className="vault__hint">Insurers pay in full only if you insure at the price of a new one. Your agent confirms it.</p>

              <div className="ins-lbl">Best time to call</div>
              <div className="ins-chips" role="radiogroup" aria-label="Best time to call">
                {CALL_TIMES.map((c) => (
                  <button key={c.value} type="button" role="radio" aria-checked={callTime === c.value}
                    className={`ins-chip${callTime === c.value ? ' on' : ''}`} onClick={() => setCallTime(c.value)}>{c.label}</button>
                ))}
              </div>
              {s.phoneHint && <p className="vault__hint">The agent calls {s.phoneHint} (your profile number).</p>}
            </div>
            <div>
              <div className="ins-lbl">What happens next</div>
              <div className="ins-next">
                A licensed agent calls you by <b>{dayName(s.replyBy)}</b> with a price. You pay them directly, then add the policy to this item.
              </div>
              <div className="ins-lbl">Key terms you accepted</div>
              <TermsPoints terms={s.terms} compact />
              <a className="ins-link" href={s.terms.wordingUrl} target="_blank" rel="noreferrer">Full policy wording (PDF)</a>
            </div>
          </div>
          <label className="vault__consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {s.terms.consent}
          </label>
          {err && <p className="ops__error" role="alert">{err}</p>}
          <div className="vault__modal-actions">
            <button className="tg-button" onClick={() => setStep(1)}>Back</button>
            <button className="tg-button tg-button--primary" disabled={!canSend} onClick={send}>{busy ? 'Sending…' : 'Request quote'}</button>
          </div>
          <p className="vault__fineprint" style={{ textAlign: 'right' }}>No payment now. You pay the insurer directly.</p>
        </>
      )}
    </Modal>
  )
}

function TermsBlock({ terms, replyBy }: { terms: InsuranceTerms; replyBy: string }) {
  return (
    <>
      <div className="ins-lbl">How it works</div>
      <ol className="ins-how">
        {terms.howItWorks.map((t, i) => <li key={i}>{i === 1 ? t.replace('within 3 working days', `by ${replyBy}`) : t}</li>)}
      </ol>
      <div className="ins-lbl">Key terms · {terms.title}</div>
      <TermsPoints terms={terms} />
      <a className="ins-link" href={terms.wordingUrl} target="_blank" rel="noreferrer">Read the full policy wording (PDF) — {terms.insurer}</a>
    </>
  )
}

function TermsPoints({ terms, compact = false }: { terms: InsuranceTerms; compact?: boolean }) {
  return (
    <ul className={`ins-terms${compact ? ' ins-terms--compact' : ''}`}>
      {terms.points.map((p, i) => (
        <li key={i} className={`ins-terms__${p.kind}`}>
          <span aria-hidden="true">{p.kind === 'covered' ? '✓' : p.kind === 'excluded' ? '✕' : '!'}</span>
          <span><span className="sr-only">{p.kind === 'covered' ? 'Covered: ' : p.kind === 'excluded' ? 'Not covered: ' : 'Rule: '}</span>{p.text}</span>
        </li>
      ))}
    </ul>
  )
}

// -- the policy upload -----------------------------------------------------------

export function AddPolicyModal({ item, onClose, onDone }: { item: VaultItem; onClose: () => void; onDone: () => void }) {
  const reason = item.insuranceRequest?.reuploadReason
  const [doc, setDoc] = useState<InsuranceDocument | null>(null)
  const [insurer, setInsurer] = useState(item.insuranceRequest?.submittedPolicy?.insurerName ?? '')
  const [no, setNo] = useState(item.insuranceRequest?.submittedPolicy?.policyNo ?? '')
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')
  const [cover, setCover] = useState(item.insuranceRequest?.coverMinor ? String(Math.round(item.insuranceRequest.coverMinor / 100)) : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const coverMinor = Math.round((parseFloat(cover.replace(/,/g, '')) || 0) * 100)
  const can = !!doc && insurer.trim() && no.trim() && starts && ends && coverMinor > 0 && !busy

  // A one-year policy is the norm: fill the end date when the start is picked.
  function pickStart(v: string) {
    setStarts(v)
    if (v && !ends) {
      const d = new Date(v); d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1)
      setEnds(d.toISOString().slice(0, 10))
    }
  }

  async function save() {
    if (!doc) return
    setBusy(true); setErr(null)
    try {
      await api.addInsurancePolicy(item.id, {
        policyDocumentId: doc.id, insurerName: insurer.trim(), policyNo: no.trim(),
        startsOn: starts, endsOn: ends, sumInsuredMinor: coverMinor,
      })
      setDone(true)
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not add the policy') }
    finally { setBusy(false) }
  }

  if (done) {
    return (
      <Modal title="Policy sent for checking" onClose={onDone}>
        <p className="vault__hint"><strong>We check it matches your {item.modelLabel} within a working day.</strong></p>
        <p className="vault__hint">Then it shows as insured, and we remind you 30 days before it ends.</p>
        <div className="vault__modal-actions"><button className="tg-button tg-button--primary" onClick={onDone}>Done</button></div>
      </Modal>
    )
  }

  return (
    <Modal title="Add your policy" kicker={item.modelLabel} onClose={onClose}>
      {reason && <p className="ins-warn" role="alert"><b>We need it again:</b> {reason}</p>}
      <p className="vault__hint">Upload the policy the insurer sent you, then copy these details from it.</p>
      <div className="ins-lbl">Policy document <span className="ins-req">Required</span></div>
      <FilePick itemId={item.id} kind="policy" doc={doc} onDoc={setDoc} />
      <label className="vault__field"><span>Insurer</span>
        <input className="tg-input" value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder="e.g. New India Assurance" /></label>
      <label className="vault__field"><span>Policy number</span>
        <input className="tg-input" value={no} onChange={(e) => setNo(e.target.value)} /></label>
      <div className="vault__grid2">
        <label className="vault__field"><span>Starts</span>
          <input className="tg-input" type="date" value={starts} onChange={(e) => pickStart(e.target.value)} /></label>
        <label className="vault__field"><span>Ends</span>
          <input className="tg-input" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /></label>
      </div>
      <label className="vault__field"><span>Cover amount on the policy (₹)</span>
        <input className="tg-input" inputMode="numeric" value={cover} onChange={(e) => setCover(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
      {err && <p className="ops__error" role="alert">{err}</p>}
      <div className="vault__modal-actions">
        <button className="tg-button" onClick={onClose}>Cancel</button>
        <button className="tg-button tg-button--primary" disabled={!can} onClick={save}>{busy ? 'Saving…' : 'Add policy'}</button>
      </div>
    </Modal>
  )
}

export function ClaimHelpModal({ onClose }: { onClose: () => void }) {
  const terms = useApi(() => api.insuranceTerms(), [])
  return (
    <Modal title="How to claim" onClose={onClose}>
      {terms.loading && <Loading />}
      {terms.data && (
        <>
          <ol className="ins-how">{terms.data.claimSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <p className="vault__hint">Your claim is with the insurer, not TrueGlaz. Your policy, invoice and vault record are here whenever you need them.</p>
        </>
      )}
      <div className="vault__modal-actions"><button className="tg-button tg-button--primary" onClick={onClose}>Got it</button></div>
    </Modal>
  )
}

/** Pick a PDF or photo and upload it straight away. */
function FilePick({ itemId, kind, doc, onDoc }: {
  itemId: string; kind: 'invoice' | 'policy'; doc: InsuranceDocument | null; onDoc: (d: InsuranceDocument | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    setErr(null)
    const type = f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : /\.png$/i.test(f.name) ? 'image/png' : 'image/jpeg')
    if (!ACCEPT.split(',').includes(type)) { setErr('Choose a PDF, JPG or PNG'); return }
    if (f.size > MAX_BYTES) { setErr('That file is over 10 MB'); return }
    setBusy(true)
    try { onDoc(await api.uploadInsuranceDocument(itemId, kind, f, type, f.name)) }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'The upload did not go through') }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }

  return (
    <>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0])} />
      {doc ? (
        <div className="ins-file ins-file--ok">
          <span className="ins-file__ic" aria-hidden="true">✓</span>
          <span className="ins-file__name"><b>{doc.fileName ?? (kind === 'invoice' ? 'Invoice' : 'Policy')}</b><small>{doc.bytes < 1024 * 1024 ? `${Math.max(1, Math.round(doc.bytes / 1024))} KB` : `${(doc.bytes / 1024 / 1024).toFixed(1)} MB`} · uploaded</small></span>
          <button type="button" className="cover__link" onClick={() => input.current?.click()}>Change</button>
        </div>
      ) : (
        <button type="button" className="ins-file" disabled={busy} onClick={() => input.current?.click()}>
          <span className="ins-file__ic" aria-hidden="true">↑</span>
          <span className="ins-file__name"><b>{busy ? 'Uploading…' : kind === 'invoice' ? 'Upload purchase invoice' : 'Upload policy document'}</b><small>PDF, JPG or PNG · up to 10 MB</small></span>
        </button>
      )}
      {err && <p className="ops__error" role="alert">{err}</p>}
    </>
  )
}

export function Modal({ title, kicker, wide = false, onClose, children }: {
  title: string; kicker?: string; wide?: boolean; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="vault__overlay" onClick={onClose}>
      <div className={`vault__modal${wide ? ' vault__modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="vault__modal-head">
          <div>
            {kicker && <div className="ins-kicker">{kicker}</div>}
            <h2>{title}</h2>
          </div>
          <button className="vault__x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
