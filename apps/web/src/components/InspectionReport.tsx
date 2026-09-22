import type { RenderedReport, ReportAnswer } from '@trueglaz/core'
import { dateTime } from '@trueglaz/core'
import { GradeBadge } from './ui'
import './InspectionReport.css'

/**
 * The condition report as a person reads it.
 *
 * On a used-gear marketplace this is the product: a buyer is paying for someone
 * else's judgement about a camera they cannot hold, so every recorded answer is
 * shown — shutter count, year of manufacture, warranty, whether the serial was
 * verified — grouped into the sections the technician worked through, not
 * summarised into a single letter grade.
 *
 * `audience` decides how much of the grading argument is on show. A buyer gets
 * the signed-off facts; the seller and ops also get what the rubric suggested
 * against what QC settled on, which is the audit trail against grade-shaving.
 */
export function InspectionReport({
  report,
  audience = 'internal',
}: {
  report: RenderedReport
  audience?: 'buyer' | 'internal'
}) {
  const grade = report.finalGradeCode ?? report.proposedGradeCode
  const shutter = report.verifiedShutterCount

  return (
    <div className="report">
      <div className="report__head">
        <div className="report__head-grade">
          {grade && (
            <div className="report__head-badge">
              <GradeBadge code={grade} />
            </div>
          )}
          <span className="report__summary">
            {report.answeredCount} of {report.questionCount} checks recorded
            {report.templateVersion != null && ` · checklist v${report.templateVersion}`}
          </span>
        </div>
        <div className="report__head-meta tg-muted">
          {report.qcState === 'confirmed' ? (
            <span className="tg-badge tg-badge--good">QC confirmed {dateTime(report.qcAt)}</span>
          ) : report.qcState === 'overridden' ? (
            <span className="tg-badge tg-badge--accent">QC overrode the technician {dateTime(report.qcAt)}</span>
          ) : (
            <span className="tg-badge tg-badge--warn">Waiting on QC</span>
          )}
        </div>
      </div>

      {shutter != null && (
        <p className="report__headline">
          Shutter count verified at <strong>{shutter.toLocaleString()}</strong> actuations.
        </p>
      )}

      {audience === 'internal' && (
        <p className="tg-muted report__audit">
          Rubric suggested <strong>{report.suggestedGradeCode ?? '—'}</strong> ·
          technician proposed <strong>{report.proposedGradeCode ?? '—'}</strong> ·
          QC settled on <strong>{report.finalGradeCode ?? '—'}</strong>
          {report.submittedAt && ` · submitted ${dateTime(report.submittedAt)}`}
        </p>
      )}

      {report.sections.length === 0 ? (
        <p className="tg-muted">The checklist was opened but nothing has been recorded yet.</p>
      ) : (
        report.sections.map((s) => (
          <section key={s.section} className="report__section">
            <h3 className="report__section-title">{s.section}</h3>
            <div className="report__rows">
              {s.answers.map((a) => (
                <div key={a.code} className="report__row">
                  <div className="report__label">
                    <span>{a.label}</span>
                    {a.affectsGrade && (
                      <span className="report__affects" title="This answer feeds the grade">grades</span>
                    )}
                  </div>
                  <div className={`report__value${a.answerType === 'text' ? ' report__value--prose' : ''}${valueTone(a)}`}>
                    {displayOf(a) ?? <span className="tg-muted">not recorded</span>}
                    {a.displayValue && a.unit && <span className="report__unit"> {a.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

/**
 * A shutter count is read as a quantity, so it gets separators; a year is read
 * as a name and must not. Four figures is the line between them.
 */
function displayOf(a: ReportAnswer): string | null {
  if (a.answerType === 'numeric' && a.valueNumeric != null && Math.abs(a.valueNumeric) >= 10000) {
    return a.valueNumeric.toLocaleString()
  }
  return a.displayValue
}

/**
 * A yes/no reads faster with a colour behind it — but which way it points is the
 * checklist's to say, not ours. "Fungus in the optical path: yes" is bad news
 * and "stabiliser works: yes" is good, so the colour follows the question's own
 * desirable answer and stays neutral when the checklist does not say.
 */
function valueTone(a: ReportAnswer): string {
  if (a.answerType !== 'boolean' || a.valueBoolean == null || a.desirableBoolean == null) return ''
  return a.valueBoolean === a.desirableBoolean ? ' report__value--yes' : ' report__value--no'
}
