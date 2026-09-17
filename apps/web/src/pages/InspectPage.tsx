import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, useApi, isStaff, useSession, type ChecklistItem } from '@trueglaz/core'
import { ErrorNote, Loading, SeverityBadge } from '../components/ui'
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

  const submitted = report.submittedAt != null
  const qcDone = report.qcState === 'confirmed' || report.qcState === 'overridden'
  const sameTechnician = report.technicianUserId === session?.userId

  async function saveAnswers() {
    setBusy(true); setError(null)
    try {
      await api.saveAnswers(report!.id, Object.entries(answers).map(([checklistItemCode, a]) => ({
        checklistItemCode, ...a,
      })))
      const s = await api.suggestedGrade(report!.id)
      setSuggested(s.suggestedGradeCode)
      if (!proposed && s.suggestedGradeCode) setProposed(s.suggestedGradeCode)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save')
    } finally { setBusy(false) }
  }

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
      nav('/ops')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not sign off')
    } finally { setBusy(false) }
  }

  return (
    <div className="ops">
      <header className="ops__card-head">
        <h1 className="ops__title">Inspecting {item.data.item.internalSku}</h1>
        <span className="tg-muted">seller declared {item.data.item.declaredGradeCode}</span>
      </header>

      {error && <p className="ops__error" role="alert">{error}</p>}

      <section className="tg-card ops__card">
        <h2 className="ops__subtitle">Checklist</h2>
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
                  onChange={(a) => setAnswers({ ...answers, [q.code]: a })}
                />
              ))}
            </div>
          </div>
        ))}
        {!submitted && (
          <div className="ops__actions">
            <button className="tg-button" disabled={busy} onClick={saveAnswers}>Save answers</button>
            {mandatoryMissing.length > 0 && (
              <span className="tg-muted ops__fineprint">
                {mandatoryMissing.length} mandatory question{mandatoryMissing.length === 1 ? '' : 's'} left
              </span>
            )}
          </div>
        )}
      </section>

      <section className="tg-card ops__card">
        <h2 className="ops__subtitle">Disclosed defects</h2>
        <p className="tg-muted ops__fineprint">
          This wording goes on the public listing. Write it the way you'd want it written for you.
        </p>
        {item.data.defects.length > 0 && (
          <ul className="ops__items">
            {item.data.defects.map((d) => (
              <li key={d.id}>
                <strong>{d.title}</strong>
                <SeverityBadge severity={d.severity} />
                <span className="tg-muted">{d.descriptionPublic}</span>
              </li>
            ))}
          </ul>
        )}
        {!submitted && (
          <div className="ops__defect-form">
            <input className="tg-input" placeholder="What is wrong" value={defect.title} onChange={(e) => setDefect({ ...defect, title: e.target.value })} />
            <select className="tg-select" value={defect.severity} onChange={(e) => setDefect({ ...defect, severity: e.target.value })} aria-label="Severity">
              <option value="cosmetic">Cosmetic</option>
              <option value="functional">Functional</option>
              <option value="optical">Optical</option>
            </select>
            <input className="tg-input" placeholder="How you'd describe it to a buyer" value={defect.descriptionPublic} onChange={(e) => setDefect({ ...defect, descriptionPublic: e.target.value })} />
            <button className="tg-button" disabled={busy || !defect.title || !defect.descriptionPublic} onClick={addDefect}>
              Disclose
            </button>
          </div>
        )}
      </section>

      <section className="tg-card ops__card">
        <h2 className="ops__subtitle">Grade</h2>
        {suggested && (
          <p className="ops__result">The rubric suggests <strong>{suggested}</strong> from the defects disclosed.</p>
        )}
        <div className="ops__grade-row">
          <select className="tg-select" value={proposed} onChange={(e) => setProposed(e.target.value)} disabled={submitted && qcDone} aria-label="Grade">
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
          <button
            className="tg-button tg-button--primary"
            disabled={busy || !proposed || mandatoryMissing.length > 0}
            onClick={submitReport}
          >
            Submit for QC
          </button>
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
