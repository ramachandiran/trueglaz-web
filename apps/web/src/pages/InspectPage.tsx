import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, dateTime, money, relative, STATE_LABELS, useApi, isStaff, useSession, type ChecklistItem, type MediaView } from '@trueglaz/core'
import { ErrorNote, Loading, SeverityBadge } from '../components/ui'
import { ModelPhoto } from '../components/ModelPhoto'
import { PhotoUpload } from '../components/PhotoUpload'
import { PageHead } from '../components/PageHead'
import { Icon, ICONS } from '../components/StaffShell'
import './OpsPage.css'

type Answer = { valueBoolean?: boolean | null; valueNumeric?: number | null; valueText?: string | null; valueOption?: string | null }

/**
 * The inspection bench: answer the checklist, disclose what's wrong, propose a
 * grade, then hand it to QC.
 *
 * QC has to be a different person — enforced by a database constraint, not by
 * this screen — so the sign-off panel says so rather than silently failing for
 * the technician who just filled the report in.
 */
export function InspectPage() {
  const { itemId = '' } = useParams()
  const nav = useNavigate()
  const { session } = useSession()

  const item = useApi(() => api.item(itemId), [itemId])
  const reports = useApi(() => api.itemInspections(itemId), [itemId])
  const grades = useApi(() => api.grades(), [])

  const report = reports.data?.[0] ?? null
  const templateId = report?.checklistTemplateId ?? null

  const questions = useApi(
    () => (templateId ? api.checklistItems(templateId) : Promise.resolve([] as ChecklistItem[])),
    [templateId],
  )

  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [defect, setDefect] = useState({ title: '', severity: 'cosmetic', descriptionPublic: '' })
  const [proposed, setProposed] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggested, setSuggested] = useState<string | null>(null)
  const media = useApi(() => api.itemMedia(itemId), [itemId])
  // The catalogue, for the model's name in the heading.
  const models = useApi(() => api.models(), [])

  // Autosave (TG-166): answers are saved a moment after the technician stops
  // changing them, so leaving or refreshing the page never loses a checklist.
  // `dirty` is set only by the person's own edits, never by loading what was
  // saved before, so opening a report does not write it straight back.
  const dirty = useRef(false)
  const [save, setSave] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; at?: Date }>({ state: 'idle' })

  // Pre-fill from whatever has already been answered, so a half-done report resumes.
  useEffect(() => {
    if (!report || !questions.data?.length) return
    api.readAnswers(report.id).then((saved) => {
      const byId = new Map(questions.data!.map((q) => [q.id, q.code]))
      const next: Record<string, Answer> = {}
      for (const a of saved) {
        const code = byId.get(a.checklistItemId)
        if (code) next[code] = {
          valueBoolean: a.valueBoolean, valueNumeric: a.valueNumeric,
          valueText: a.valueText, valueOption: a.valueOption,
        }
      }
      setAnswers(next)
    }).catch(() => { /* nothing saved yet */ })
  }, [report?.id, questions.data])

  // A report that has been proposed shows its grade (TG-164): the picker sat
  // empty above "QC confirmed — final grade TG-8".
  useEffect(() => {
    const g = report?.finalGradeCode ?? report?.proposedGradeCode
    if (g) { setProposed(g); return }
    // An open report starts from what the rubric suggests, not an empty picker.
    if (report && !report.submittedAt) {
      api.suggestedGrade(report.id).then((s) => {
        setSuggested(s.suggestedGradeCode)
        setProposed((p) => p || s.suggestedGradeCode || '')
      }).catch(() => { /* no suggestion yet */ })
    }
  }, [report?.id, report?.proposedGradeCode, report?.finalGradeCode])

  const persist = useCallback(async () => {
    if (!report) return
    dirty.current = false
    setSave({ state: 'saving' })
    try {
      await api.saveAnswers(report.id, Object.entries(answers).map(([checklistItemCode, a]) => ({ checklistItemCode, ...a })))
      setSave({ state: 'saved', at: new Date() })
      const s = await api.suggestedGrade(report.id)
      setSuggested(s.suggestedGradeCode)
      setProposed((p) => p || s.suggestedGradeCode || '')
    } catch {
      dirty.current = true
      setSave({ state: 'error' })
    }
  }, [report, answers])

  useEffect(() => {
    if (!dirty.current || !report || report.submittedAt) return
    const t = setTimeout(() => { void persist() }, 900)
    return () => clearTimeout(t)
  }, [answers, persist, report])

  // Leaving with an unsaved change asks first; the browser words the question.
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty.current || save.state === 'saving') { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [save.state])

  const sections = useMemo(() => {
    const by = new Map<string, ChecklistItem[]>()
    for (const q of questions.data ?? []) {
      by.set(q.section || 'General', [...(by.get(q.section || 'General') ?? []), q])
    }
    return [...by.entries()]
  }, [questions.data])

  const mandatoryMissing = useMemo(() => {
    if (!questions.data) return []
    return questions.data.filter((q) => q.isMandatory && answers[q.code] === undefined)
  }, [questions.data, answers])

  if (item.loading || reports.loading) return <Loading label="Loading inspection" />
  if (item.error) return <ErrorNote error={item.error} onRetry={item.reload} />
  if (!item.data) return null
  if (!report) return <ErrorNote error={new Error('No inspection has been started for this item')} />

  const required = (questions.data ?? []).filter((q) => q.isMandatory).length
  const submitted = report.submittedAt != null
  const qcDone = report.qcState === 'confirmed' || report.qcState === 'overridden'
  const sameTechnician = report.technicianUserId === session?.userId

  async function addDefect() {
    setBusy(true); setError(null)
    try {
      await api.addDefect(report!.id, defect)
      setDefect({ title: '', severity: 'cosmetic', descriptionPublic: '' })
      item.reload()
      const s = await api.suggestedGrade(report!.id)
      setSuggested(s.suggestedGradeCode)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add that defect')
    } finally { setBusy(false) }
  }

  async function submitReport() {
    setBusy(true); setError(null)
    try {
      await api.saveAnswers(report!.id, Object.entries(answers).map(([checklistItemCode, a]) => ({
        checklistItemCode, ...a,
      })))
      dirty.current = false
      await api.submitReport(report!.id, {
        proposedGradeCode: proposed,
        overrideReason: overrideReason || null,
      })
      reports.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit')
    } finally { setBusy(false) }
  }

  async function signOff(confirm: boolean, outcome: string) {
    setBusy(true); setError(null)
    try {
      await api.qc(report!.id, {
        confirm,
        finalGradeCode: confirm ? null : proposed,
        overrideReason: confirm ? null : (overrideReason || 'QC adjusted the grade'),
        outcome,
      })
      nav('/admin/operations')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not sign off')
    } finally { setBusy(false) }
  }

  const it = item.data.item
  const name = (models.data?.content ?? []).find((m) => m.id === it.productModelId)?.name || it.modelFreeText || it.internalSku
  const sellerShots = (media.data ?? []).filter((m: MediaView) => m.role !== 'defect')
  const defectShots = (media.data ?? []).filter((m: MediaView) => m.role === 'defect')
  const status = qcDone
    ? <span className="c-chip2 c-chip2--good">QC {report.qcState}</span>
    : submitted ? <span className="c-chip2 c-chip2--navy">Waiting on QC</span>
      : <span className="c-chip2 c-chip2--warn">On the bench</span>
  const asking = it.askingAmountMinor
  const history = [...item.data.history].sort((x, y) => Date.parse(y.occurredAt) - Date.parse(x.occurredAt)).slice(0, 6)

  return (
    <div className="c-stack insp">
      <PageHead
        crumbs={[{ label: 'Operations', to: '/admin/operations' }, { label: 'Inspection', to: '/admin/operations?tab=inspect' }, { label: name }]}
        title={name}
        badge={status}
        subtitle={<>{it.internalSku} · seller declared <b>{it.declaredGradeCode}</b>{report.startedAt ? ` · on the bench since ${dateTime(report.startedAt)}` : ''}</>}
        actions={!submitted ? <>
          <button type="button" className="c-btn" disabled={busy || save.state === 'saving'} onClick={() => { void persist() }}>
            {save.state === 'saving' ? 'Saving…' : 'Save now'}
          </button>
          <button type="button" className="c-btn c-btn--cta" disabled={busy || !proposed || mandatoryMissing.length > 0} onClick={submitReport}
            title={mandatoryMissing.length > 0 ? `${mandatoryMissing.length} required answers left` : !proposed ? 'Choose a grade first' : undefined}>
            <Icon d={ICONS.check} /> Submit for QC
          </button>
        </> : undefined}
      />

      {error && <p className="ops__error" role="alert">{error}</p>}

      {/* A finished report reads as finished (TG-164). */}
      {submitted && (
        <p className={`insp__state${qcDone ? ' insp__state--done' : ''}`} role="status">
          {qcDone
            ? <>QC {report.qcState} · final grade <strong>{report.finalGradeCode ?? '—'}</strong>. This report is closed; answers and defects are read-only.</>
            : <>Submitted for QC{report.submittedAt ? ` on ${dateTime(report.submittedAt)}` : ''} · proposed <strong>{report.proposedGradeCode}</strong>. Answers are locked.</>}
        </p>
      )}

      <div className="insp__cols">
        <div className="insp__main">
          <section className="c-card insp__card">
            <div className="c-card__head"><h2>Photos</h2><span className="c-card__note">{sellerShots.length} from the seller · {defectShots.length} of defects</span></div>
            <div className="insp__gallery">
              {/* What the model should look like, to compare the unit on the bench against. */}
              <figure className="insp__ref">
                <ModelPhoto modelId={it.productModelId} kind="gear" size="thumb" alt="Reference picture of this model" badge={false} />
                <figcaption className="c-chip2 c-chip2--navy">Reference</figcaption>
              </figure>
              {[...sellerShots, ...defectShots].slice(0, 7).map((m) => (
                <figure key={m.id} className="insp__shot">
                  <img src={m.sizes[400] ?? m.url} alt={m.role === 'defect' ? 'Defect photo' : 'Seller photo'} loading="lazy" />
                  <figcaption className={`c-chip2${m.role === 'defect' ? ' c-chip2--warn' : ''}`}>{m.role === 'defect' ? 'Defect' : 'Seller'}</figcaption>
                </figure>
              ))}
              {sellerShots.length + defectShots.length === 0 && <p className="c-empty insp__noshots">No photos yet. Defect photos are added under each defect below.</p>}
            </div>
          </section>

      <section className="c-card insp__card">
            <div className="c-card__head"><h2>Inspection checklist</h2><span className="c-chip2">{required - mandatoryMissing.length} of {required} required done</span></div>
            {questions.loading && <Loading label="Loading checklist" />}
            {/* Grouped the way a technician works through the item, not as one
                flat list of twenty questions. */}
            {sections.map(([section, qs]) => (
              <div key={section} className="ops__section">
                <h3 className="ops__section-title">{section}</h3>
                <div className="ops__questions">
                  {qs.map((q) => (
                    <Question
                      key={q.id}
                      q={q}
                      value={answers[q.code]}
                      disabled={submitted}
                      onChange={(a) => { dirty.current = true; setAnswers((prev) => ({ ...prev, [q.code]: a })) }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="c-card insp__card">
            <div className="c-card__head"><h2>Disclosed defects</h2>{item.data.defects.length > 0 && <span className="c-chip2 c-chip2--warn">{item.data.defects.length} disclosed</span>}</div>
            <p className="tg-muted ops__fineprint">
              This wording goes on the public listing. Write it the way you'd want it written for you.
            </p>
            {item.data.defects.length > 0 && (
              <ul className="insp__defects">
                {item.data.defects.map((d) => {
                  const shots = (media.data ?? []).filter((m: MediaView) => m.role === 'defect' && m.defectId === d.id)
                  return (
                    <li key={d.id} className="insp__defect">
                      <div className="insp__defect-head">
                        <strong>{d.title}</strong>
                        <SeverityBadge severity={d.severity} />
                      </div>
                      <p className="tg-muted insp__defect-text">{d.descriptionPublic}</p>
                      {/* The evidence behind the words (TG-167): up to five photos
                          each, until QC closes the report. */}
                      {qcDone ? (
                        shots.length > 0 ? (
                          <ul className="shots__grid" aria-label={`Photos of ${d.title}`}>
                            {shots.map((m) => <li key={m.id} className="shots__item"><img src={m.sizes[400] ?? m.url} alt={`${d.title}, photo`} loading="lazy" /></li>)}
                          </ul>
                        ) : <p className="tg-muted ops__fineprint">No photo of this defect.</p>
                      ) : media.loading ? null : (
                        <PhotoUpload
                          key={`${d.id}-${shots.length}`}
                          ownerType="item" ownerId={itemId} role="defect" defectId={d.id}
                          max={5} existing={shots}
                          hint={shots.length === 0 ? 'Add a photo of this defect: it goes on the listing with the words above. Up to 5, JPEG or PNG.' : undefined}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {!submitted && (
              <div className="ops__defect-form insp__defect-form">
                <label className="insp__field">
                  <span className="insp__label">What is wrong</span>
                  <input className="tg-input" value={defect.title} onChange={(e) => setDefect({ ...defect, title: e.target.value })} placeholder="e.g. Marks on the barrel" />
                </label>
                <label className="insp__field">
                  <span className="insp__label">Severity</span>
                  <select className="tg-select" value={defect.severity} onChange={(e) => setDefect({ ...defect, severity: e.target.value })}>
                    <option value="cosmetic">Cosmetic</option>
                    <option value="functional">Functional</option>
                    <option value="optical">Optical</option>
                  </select>
                </label>
                <label className="insp__field">
                  <span className="insp__label">How a buyer reads it</span>
                  <input className="tg-input" value={defect.descriptionPublic} onChange={(e) => setDefect({ ...defect, descriptionPublic: e.target.value })} placeholder="e.g. Visible handling marks; cosmetic only" />
                </label>
                <button className="tg-button" disabled={busy || !defect.title || !defect.descriptionPublic} onClick={addDefect}>
                  Disclose
                </button>
                <p className="tg-muted ops__fineprint insp__defect-note">Once disclosed, add its photos under it.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="insp__side">
          <section className="c-card insp__card">
            <div className="c-card__head"><h2>Summary</h2></div>
            <div className="insp__ref-card">
              <div><small>Item ID</small><b className="tg-mono">{it.internalSku}</b></div>
              <div className="insp__ref-right"><small>Last updated</small><span>{relative(it.updatedAt)}</span></div>
            </div>
            <dl className="insp__kv">
              <div><dt>Serial number</dt><dd className="tg-mono">{it.serialNumber ?? '—'}</dd></div>
              <div><dt>Declared grade</dt><dd><span className="c-chip2">{it.declaredGradeCode}</span></dd></div>
              <div><dt>Your grade</dt><dd>{proposed ? <span className="c-chip2 c-chip2--warn">{proposed}</span> : <span className="tg-muted">not chosen</span>}</dd></div>
              {suggested && <div><dt>Rubric suggests</dt><dd><span className="c-chip2 c-chip2--navy">{suggested}</span></dd></div>}
              <div><dt>Defects</dt><dd>{item.data.defects.length || 'None'}</dd></div>
            </dl>
            {asking != null && (
              <div className="insp__price"><small>Seller asks</small><b>{money(asking)}</b></div>
            )}
          </section>

          <section className="c-card insp__card">
            <div className="c-card__head"><h2>Grade</h2></div>
            {suggested && (
              <p className="ops__result">The rubric suggests <strong>{suggested}</strong> from the defects disclosed.</p>
            )}
            <div className="ops__grade-row">
              <select className="tg-select" value={proposed} onChange={(e) => setProposed(e.target.value)} disabled={submitted && (qcDone || sameTechnician || !isStaff(session))} aria-label="Grade">
                <option value="">Choose a grade</option>
                {(grades.data ?? []).filter((g) => g.isActive).sort((a, b) => b.rank - a.rank).map((g) => (
                  <option key={g.code} value={g.code}>{g.code} · {g.label}</option>
                ))}
              </select>
              {suggested && proposed && proposed !== suggested && (
                <input
                  className="tg-input"
                  placeholder="Why you differ from the rubric"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              )}
            </div>
    
            {!submitted ? (
              <p className="tg-muted ops__fineprint">Submit from the bar at the bottom of the page once every required answer is in.</p>
            ) : !qcDone ? (
              <div className="ops__qc">
                <p className="tg-muted ops__fineprint">
                  Proposed <strong>{report.proposedGradeCode}</strong>, waiting on QC.
                </p>
                {sameTechnician ? (
                  <p className="ops__warn">
                    You inspected this one, so you cannot sign it off. That separation is a
                    database constraint, not a preference.
                  </p>
                ) : !isStaff(session) ? (
                  <p className="tg-muted ops__fineprint">QC sign-off needs the Staff or Admin role.</p>
                ) : (
                  <div className="ops__actions">
                    <button className="tg-button tg-button--primary" disabled={busy} onClick={() => signOff(true, 'graded')}>
                      Confirm {report.proposedGradeCode}
                    </button>
                    <button className="tg-button" disabled={busy || !proposed} onClick={() => signOff(false, 'graded')}>
                      Override to {proposed || '…'}
                    </button>
                    <button className="tg-button ops__reject" disabled={busy} onClick={() => signOff(false, 'quarantined')}>
                      Quarantine
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="ops__result">QC {report.qcState} — final grade {report.finalGradeCode ?? '—'}.</p>
            )}
          </section>

          <section className="c-card insp__card">
            <div className="c-card__head"><h2>History</h2></div>
            <ol className="insp__tl">
              {history.map((h, i) => (
                <li key={h.id}>
                  <i className={i === 0 ? 'insp__tl-now' : undefined}><Icon d={i === 0 ? ICONS.wrench : ICONS.check} /></i>
                  <span><b>{STATE_LABELS[h.toState] ?? h.toState.replace(/_/g, ' ').toLowerCase()}</b>
                    <small>{h.actorRole ? `${h.actorRole} · ` : ''}{dateTime(h.occurredAt)}</small></span>
                </li>
              ))}
              {history.length === 0 && <li className="tg-muted">No history yet.</li>}
            </ol>
          </section>
        </aside>
      </div>

      {/* Always in view while the checklist is open (TG-166): how far along it
          is, whether it is saved, and the one action that ends the job. */}
      {!submitted && (
        <div className="insp__bar" role="region" aria-label="Inspection progress">
          <span className="insp__progress">
            <strong>{required - mandatoryMissing.length} of {required}</strong> required answered
          </span>
          <span className={`insp__save insp__save--${save.state}`} aria-live="polite">
            {save.state === 'saving' && 'Saving…'}
            {save.state === 'saved' && save.at && `Saved at ${save.at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`}
            {save.state === 'error' && <>Not saved. <button type="button" className="insp__retry" onClick={() => { void persist() }}>Try again</button></>}
            {save.state === 'idle' && 'Answers save as you go'}
          </span>
          <span className="insp__bar-end">
            {(mandatoryMissing.length > 0 || !proposed) && (
              <span className="tg-muted insp__why">
                {mandatoryMissing.length > 0 ? `${mandatoryMissing.length} required left` : 'Choose a grade'}
              </span>
            )}
            <button
              className="tg-button tg-button--primary"
              disabled={busy || !proposed || mandatoryMissing.length > 0}
              onClick={submitReport}
            >
              Submit for QC
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

function Question({
  q, value, disabled, onChange,
}: { q: ChecklistItem; value?: Answer; disabled: boolean; onChange: (a: Answer) => void }) {
  return (
    <label className="ops__question">
      <span className="ops__question-prompt">
        {q.label}
        {q.isMandatory && <span className="ops__required" aria-label="required"> *</span>}
        {q.affectsGrade && <span className="ops__affects" title="This answer feeds the suggested grade"> · grades</span>}
      </span>
      {q.answerType === 'boolean' ? (
        <select
          className="tg-select"
          disabled={disabled}
          value={value?.valueBoolean === undefined || value?.valueBoolean === null ? '' : String(value.valueBoolean)}
          onChange={(e) => onChange({ valueBoolean: e.target.value === '' ? null : e.target.value === 'true' })}
        >
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : q.answerType === 'numeric' ? (
        <span className="ops__numeric">
          <input
            className="tg-input" type="number" disabled={disabled}
            value={value?.valueNumeric ?? ''}
            onChange={(e) => onChange({ valueNumeric: e.target.value === '' ? null : Number(e.target.value) })}
          />
          {q.unit && <span className="ops__unit tg-muted">{q.unit}</span>}
        </span>
      ) : q.answerType === 'enum' ? (
        <select
          className="tg-select" disabled={disabled}
          value={value?.valueOption ?? ''}
          onChange={(e) => onChange({ valueOption: e.target.value || null })}
        >
          <option value="">—</option>
          {/* The stored value stays as it is; only the reading of it changes. */}
          {(q.options ?? []).map((o) => (
            <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
          ))}
        </select>
      ) : (
        <input
          className="tg-input" disabled={disabled}
          value={value?.valueText ?? ''}
          onChange={(e) => onChange({ valueText: e.target.value || null })}
        />
      )}

    </label>
  )
}
