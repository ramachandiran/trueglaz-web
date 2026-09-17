import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@trueglaz/core'
import { useApi } from '@trueglaz/core'
import { Timeline } from '../components/Timeline'
import { ErrorNote, GradeBadge, Loading, SeverityBadge, StateBadge } from '../components/ui'
import { buildTimeline, progressOf, STATE_BLURBS, STATE_LABELS } from '@trueglaz/core'
import { dateTime, money } from '@trueglaz/core'
import './DetailPage.css'

export function ItemDetailPage() {
  const { id = '' } = useParams()
  const { data, error, loading, reload } = useApi((a) => api.item(a, id), [id])
  // The item carries a productModelId, not a name, so the catalogue supplies the
  // words a person would recognise.
  const models = useApi((a) => api.models(a), [])

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
      </section>

      <div className="detail__cols">
        <section className="tg-card detail__section">
          <h2 className="detail__section-title">What can happen next</h2>
          {nextLegalStates.length === 0 ? (
            <p className="tg-muted">This item has reached the end of its journey.</p>
          ) : (
            <ul className="detail__list">
              {nextLegalStates.map((n) => (
                <li key={n.toState} className="detail__next">
                  <div className="detail__next-head">
                    <strong>{STATE_LABELS[n.toState] ?? n.toState}</strong>
                    {n.requiresReason && <span className="tg-badge tg-badge--warn">needs a reason</span>}
                  </div>
                  {n.notes && <p className="tg-muted detail__next-note">{n.notes}</p>}
                  <p className="detail__roles tg-muted">
                    {n.allowedRoles.join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tg-card detail__section">
          <h2 className="detail__section-title">Disclosed defects</h2>
          {defects.length === 0 ? (
            <p className="tg-muted">The inspection found nothing to disclose.</p>
          ) : (
            <ul className="detail__list">
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
      </div>

      <section className="tg-card detail__section">
        <h2 className="detail__section-title">Inspection report</h2>
        <p className="detail__blurb tg-muted">
          What the rubric suggested, what the technician proposed, and what QC signed off —
          the audit trail against grade-shaving.
        </p>
        {inspections.length === 0 ? (
          <p className="tg-muted">Not inspected yet.</p>
        ) : (
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
