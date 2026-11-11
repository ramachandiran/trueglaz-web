import { api, dateTime, money, orderEventTitle, orderEventTone, useApi } from '@trueglaz/core'
import './LineHistory.css'

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

/**
 * Everything that happened to one order line, oldest first (TG-91).
 *
 * The API decides what each reader may see: a buyer gets their part, staff get
 * every step with who took it and the staff-only details (courier cost,
 * remarks, internal notes), which this then shows when `staff` is set.
 */
export function LineHistory({ lineId, staff = false, refreshKey }: { lineId: string; staff?: boolean; refreshKey?: unknown }) {
  const h = useApi(() => api.lineHistory(lineId), [lineId, refreshKey])
  if (h.loading && !h.data) return <p className="tg-muted lh__empty">Loading history…</p>
  if (h.error) return <p className="tg-muted lh__empty">Could not load the history.</p>
  const events = h.data ?? []
  if (events.length === 0) return <p className="tg-muted lh__empty">Nothing recorded yet.</p>
  return (
    <ol className="lh" aria-label="History">
      {events.map((e, i) => {
        const d = e.data
        const insp = d.inspection as { serialMatches?: boolean; conditionOk?: boolean; accessoriesOk?: boolean; note?: string } | undefined
        return (
          <li key={i} className={`lh__step lh__step--${orderEventTone(e.kind)}`}>
            <span className="lh__dot" aria-hidden="true" />
            <div className="lh__body">
              <p className="lh__title">{orderEventTitle(e)}</p>
              <p className="lh__meta">
                {dateTime(e.at)}
                {staff && e.actorName && <> · {e.actorName}{e.actorRole ? ` (${e.actorRole})` : ''}</>}
              </p>
              {e.note && <p className="lh__note">“{e.note}”</p>}
              {staff && (
                <>
                  {typeof d.courierCost === 'number' && <p className="lh__staff">Courier cost {money(d.courierCost)}</p>}
                  {str(d.remarks) && <p className="lh__staff">Remarks: {String(d.remarks)}</p>}
                  {str(d.staffNote) && <p className="lh__staff">Internal note: {String(d.staffNote)}</p>}
                  {insp && (
                    <p className="lh__staff">
                      Serial {insp.serialMatches ? 'matches' : 'DOES NOT match'} · condition {insp.conditionOk ? 'as it left' : 'WORSE'} ·
                      accessories {insp.accessoriesOk ? 'complete' : 'MISSING'}{insp.note ? ` — ${insp.note}` : ''}
                    </p>
                  )}
                </>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
