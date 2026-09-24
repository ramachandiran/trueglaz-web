import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@trueglaz/core'
import { useApi } from '@trueglaz/core'
import { InspectionReport } from '../components/InspectionReport'
import { NextActions } from '../components/NextActions'
import { Timeline } from '../components/Timeline'
import { ErrorNote, GradeBadge, Loading, SeverityBadge, StateBadge } from '../components/ui'
import { buildTimeline, progressOf, STATE_BLURBS, STATE_LABELS } from '@trueglaz/core'
import { dateTime, money } from '@trueglaz/core'
import './DetailPage.css'

export function ItemDetailPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { data, error, loading, reload } = useApi(() => api.item(id), [id])
  // The item carries a productModelId, not a name, so the catalogue supplies the
  // words a person would recognise.
  const models = useApi(() => api.models(), [])
  // The recorded answers, joined to their questions by the API. Null until a
  // technician has opened a checklist.
  const report = useApi(() => api.itemReport(id), [id])

  const steps = useMemo(
    () => (data ? buildTimeline(data.history, data.item.currentState, data.nextLegalStates) : []),
    [data],
  )

  const modelName = useMemo(() => {
    if (!data?.item.productModelId) return null
    return models.data?.content.find((m) => m.id === data.item.productModelId)?.name ?? null
  }, [data, models.data])

  if (loading) return <Loading label="Loading item" />
  if (error) return <ErrorNote error={error} onRetry={reload} />
  if (!data) return null

  const { item, history, nextLegalStates, defects, inspections, listings, currentBinCode } = data
  const progress = progressOf(steps)

  return (
    <article className="detail">
      <div className="detail__back-row">
        <button className="detail__back" onClick={() => nav(-1)} title="Go back">
          ← Back
        </button>
      </div>

      <header className="detail__head">
        <div>
          <p className="detail__eyebrow tg-mono tg-muted">{item.internalSku}</p>
          <h1 className="detail__title">
            {modelName ?? item.modelFreeText ?? 'Consigned item'}
          </h1>
          <div className="detail__badges">
            <StateBadge state={item.currentState} />
            {item.assignedGradeCode && <GradeBadge code={item.assignedGradeCode} />}
            {currentBinCode && <span className="tg-badge">Bin {currentBinCode}</span>}
          </div>
        </div>
        <div className="detail__figures">
          <Figure label="Asking" value={money(item.askingAmountMinor)} />
          {item.floorAmountMinor != null && (
            <Figure label="Floor" value={money(item.floorAmountMinor)} />
          )}
          <Figure label="Declared" value={item.declaredGradeCode} />
        </div>
      </header>

      {/* The requirement: completed and upcoming states on one line. */}
      <section className="tg-card detail__section">
        <div className="detail__section-head">
          <h2 className="detail__section-title">Lifecycle</h2>
          <span className="tg-muted detail__progress">
            {progress.done} of {progress.total} stages
          </span>
        </div>
        <p className="detail__blurb tg-muted">
          {STATE_BLURBS[item.currentState] ?? `Currently ${STATE_LABELS[item.currentState] ?? item.currentState}.`}
        </p>
        <Timeline steps={steps} orientation="horizontal" />

        {/* The move out of the current state is the only question anyone has
            while looking at the line, so the buttons live on it. */}
        <NextActions
          itemId={id}
          currentState={item.currentState}
          nextLegalStates={nextLegalStates}
          onDone={() => { reload(); report.reload() }}
        />
      </section>

      <section className="tg-card detail__section">
        <h2 className="detail__section-title">Disclosed defects</h2>
        {defects.length === 0 ? (
          <p className="tg-muted">The inspection found nothing to disclose.</p>
        ) : (
          <ul className="detail__list detail__list--grid">
            {defects.map((d) => (
              <li key={d.id} className="detail__defect">
                <div className="detail__defect-head">
                  <strong>{d.title}</strong>
                  <SeverityBadge severity={d.severity} />
                </div>
                <p className="tg-muted detail__defect-body">{d.descriptionPublic}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tg-card detail__section">
        <h2 className="detail__section-title">Inspection report</h2>
        <p className="detail__blurb tg-muted">
          Every check the technician recorded, in the sections they worked through.
          This is what the grade is an argument about.
        </p>

        {report.loading && <Loading label="Loading the report" />}
        {report.data
          ? <InspectionReport report={report.data} audience="internal" />
          : !report.loading && <p className="tg-muted">Not inspected yet.</p>}

        {inspections.length > 1 && (
          <>
            <h3 className="detail__subheading">Every report on this item</h3>
            <table className="detail__table">
              <thead>
                <tr>
                  <th>Purpose</th><th>Rubric</th><th>Proposed</th><th>Final</th><th>QC</th><th>Outcome</th><th>When</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((r) => (
                  <tr key={r.id}>
                    <td>{r.purpose}</td>
                    <td>{r.suggestedGradeCode ?? '—'}</td>
                    <td>{r.proposedGradeCode ?? '—'}</td>
                    <td>{r.finalGradeCode ?? '—'}</td>
                    <td>{r.qcState}</td>
                    <td>{r.outcome ?? '—'}</td>
                    <td className="tg-muted">{dateTime(r.submittedAt ?? r.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <div className="detail__cols">
        <section className="tg-card detail__section">
          <h2 className="detail__section-title">Listings</h2>
          {listings.length === 0 ? (
            <p className="tg-muted">Never listed.</p>
          ) : (
            <ul className="detail__list">
              {listings.map((l) => (
                <li key={l.id} className="detail__listing">
                  <Link to={`/listings/${l.id}`}>{l.title}</Link>
                  <span className="tg-muted">
                    {money(l.priceMinor, l.currency)} · {l.state}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tg-card detail__section">
          <h2 className="detail__section-title">Full history</h2>
          <p className="tg-muted detail__blurb">
            Append-only. The current state is only a cache of this.
          </p>
          <ul className="detail__history">
            {[...history].reverse().map((h) => (
              <li key={h.id} className="detail__history-row">
                <span className="detail__history-move">
                  {h.fromState ? `${h.fromState} → ` : ''}<strong>{h.toState}</strong>
                </span>
                <span className="tg-muted detail__history-meta">
                  {h.actorRole ?? 'System'} · {dateTime(h.occurredAt)}
                  {h.reasonCode ? ` · ${h.reasonCode}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail__figure">
      <span className="detail__figure-label tg-muted">{label}</span>
      <span className="detail__figure-value">{value}</span>
    </div>
  )
}
