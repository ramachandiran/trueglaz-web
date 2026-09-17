import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@trueglaz/core'
import { useApi } from '@trueglaz/core'
import { Empty, ErrorNote, Loading, StateBadge } from '../components/ui'
import { HAPPY_PATH, STATE_LABELS } from '@trueglaz/core'
import { dateTime, money } from '@trueglaz/core'
import './ItemsPage.css'

/**
 * Tracking view: every unit by lifecycle stage. This is the "what happened to my
 * lens" entry point — pick a stage on the left, open an item for its timeline.
 */
export function ItemsPage() {
  const [state, setState] = useState<string | null>(null)
  const { data, error, loading, reload } = useApi((a) => api.items(a), [])

  const byState = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of data ?? []) counts.set(i.currentState, (counts.get(i.currentState) ?? 0) + 1)
    return counts
  }, [data])

  const visible = useMemo(
    () => (data ?? []).filter((i) => !state || i.currentState === state),
    [data, state],
  )

  // Stages that exist in the data but are off the happy path still need a row.
  const stages = useMemo(() => {
    const extra = [...byState.keys()].filter((s) => !HAPPY_PATH.includes(s as never))
    return [...HAPPY_PATH, ...extra.sort()]
  }, [byState])

  return (
    <div className="items">
      <aside className="items__rail tg-card" aria-label="Filter by stage">
        <h2 className="items__rail-title">Stage</h2>
        <button
          type="button"
          className={`items__stage${state === null ? ' items__stage--active' : ''}`}
          onClick={() => setState(null)}
        >
          <span>All items</span>
          <span className="items__stage-count">{data?.length ?? 0}</span>
        </button>
        {stages.map((s) => {
          const count = byState.get(s) ?? 0
          return (
            <button
              key={s}
              type="button"
              disabled={count === 0}
              className={`items__stage${state === s ? ' items__stage--active' : ''}`}
              onClick={() => setState(s)}
            >
              <span>{STATE_LABELS[s] ?? s}</span>
              <span className="items__stage-count">{count}</span>
            </button>
          )
        })}
      </aside>

      <section className="items__main" aria-label="Items">
        {loading && <Loading label="Loading items" />}
        {error && <ErrorNote error={error} onRetry={reload} />}
        {!loading && !error && visible.length === 0 && (
          <Empty title="No items in this stage" />
        )}

        {visible.length > 0 && (
          <div className="items__list">
            {visible.map((i) => (
              <Link key={i.id} to={`/items/${i.id}`} className="items__row tg-card">
                <div className="items__row-main">
                  <span className="tg-mono items__sku">{i.internalSku}</span>
                  <StateBadge state={i.currentState} />
                </div>
                <div className="items__row-meta tg-muted">
                  <span>Declared {i.declaredGradeCode}</span>
                  {i.assignedGradeCode && <span>Graded {i.assignedGradeCode}</span>}
                  <span>Asking {money(i.askingAmountMinor)}</span>
                  <span>{dateTime(i.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
