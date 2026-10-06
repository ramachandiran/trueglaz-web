import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api, ApiError, money, useApi, useSession, isStaff, STATE_LABELS,
  type ConsignmentItem, type NextState,
} from '@trueglaz/core'
import { Empty, ErrorNote, Loading, StateBadge } from '../components/ui'
import { NextActions, isForward, planMove, runMove, type Planned } from '../components/NextActions'
import './InventoryDashboard.css'

/**
 * Inventory database dashboard for ops staff.
 *
 * A complete view of all items in the system, filterable by stage and searchable.
 * This is the primary interface for ops/staff login rather than the work queue view.
 *
 * It reads the whole inventory in ONE call and groups it here, rather than asking
 * for a handful of states and stitching the answers together. The old version did
 * the latter, and the consequence was the bug this page exists to avoid: an item a
 * seller had just submitted was in none of the six states it asked for, so it
 * appeared nowhere — not even under "All items". Forty-one of fifty-eight items
 * were invisible on a screen whose subtitle promises all of them. Grouping a
 * single unfiltered list cannot develop that kind of hole, because a state nobody
 * thought of still arrives in the list.
 *
 * The table is deliberately five columns. Brand, model and SKU are one thing —
 * which item this is — and reading them as three columns made a staff member
 * scan sideways to answer a question they never asked. Asking and floor are one
 * thing too. What was left over is the column that matters: the move out of the
 * state it is in, which until now meant opening the item to find out there was
 * nothing to do.
 */

/** The lifecycle, in the order an item walks it. `null` means every state. */
const STAGES: Array<{ key: string; label: string; states: string[] | null; staffOnly?: boolean }> = [
  { key: 'all', label: 'All items', states: null },
  // The stage the seller is looking at while they wait for a courier, and the
  // one a QC user goes hunting for after a submission lands.
  { key: 'intake', label: 'Awaiting intake', states: ['SUBMITTED', 'PRE_APPROVED', 'IN_TRANSIT_INBOUND'] },
  { key: 'inspection', label: 'Inspection', states: ['RECEIVED', 'IN_INSPECTION', 'RE_INSPECTION', 'RETURN_RECEIVED', 'INSPECTION_FAILED', 'QUARANTINED'] },
  { key: 'pricing', label: 'Pricing', states: ['GRADED', 'PRICE_PROPOSED', 'AWAITING_SELLER_APPROVAL', 'SELLER_DECLINED'], staffOnly: true },
  { key: 'listed', label: 'Listed', states: ['LISTED', 'RELISTED', 'RESERVED', 'UNSOLD_REVIEW'] },
  { key: 'sold', label: 'Sold', states: ['SOLD', 'DISPATCHED', 'DELIVERED', 'ACCEPTED'] },
  { key: 'returns', label: 'Returns', states: ['RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURN_REJECTED', 'RETURN_TO_SELLER', 'RETURNED'] },
  { key: 'closed', label: 'Closed', states: ['DRAFT', 'EXPIRED', 'REJECTED_PRE_INTAKE', 'ARCHIVED'] },
]

export function InventoryDashboard() {
  const { session } = useSession()
  const [view, setView] = useState('all')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const itemsPerPage = 10
  const staff = isStaff(session)

  // No state parameter means every state, which is what this screen is for.
  const all = useApi(() => api.itemQueue(), [])
  const rows = all.data ?? []

  // The whole rule table, once. Asking each row what it may do next would be
  // sixty calls to render ten lines, and the rules are the same seed data for
  // every item in a state — they belong to the state, not to the item.
  const rules = useApi(() => api.transitionRules(), [])
  const nextByState = useMemo(() => {
    const m = new Map<string, NextState[]>()
    for (const r of rules.data ?? []) {
      m.set(r.fromState, [...(m.get(r.fromState) ?? []), {
        toState: r.toState,
        allowedRoles: r.allowedRoles,
        requiresReason: r.requiresReason,
        requiresNote: r.requiresNote,
        isReversal: r.isReversal,
        notes: r.notes,
      }])
    }
    return m
  }, [rules.data])

  // The queue returns a consignment_item as stored, which holds ids rather than
  // names — so Brand printed a raw uuid and Model an em dash for anything
  // linked to the catalogue. Both are looked up here.
  const brands = useApi(() => api.brands(), [])
  const models = useApi(() => api.models(), [])
  const brandName = (id?: string | null) =>
    (brands.data ?? []).find((b) => b.id === id)?.name ?? null
  const modelName = (item: ConsignmentItem) =>
    (models.data?.content ?? []).find((m) => m.id === (item as any).productModelId)?.name
      ?? (item as any).modelFreeText
      ?? null

  const tabs = STAGES.filter((s) => staff || !s.staffOnly)

  // Anything the groups above do not name would otherwise be reachable only
  // under "All items", so it gets a tab of its own instead of going quiet.
  const named = useMemo(() => new Set(STAGES.flatMap((s) => s.states ?? [])), [])
  const strays = useMemo(
    () => [...new Set(rows.filter((i) => !named.has(i.currentState)).map((i) => i.currentState))].sort(),
    [rows, named],
  )
  const shown = strays.length > 0
    ? [...tabs, { key: 'other', label: 'Other', states: strays, staffOnly: false }]
    : tabs

  const stage = shown.find((s) => s.key === view) ?? shown[0]
  const items = stage.states === null
    ? rows
    : rows.filter((i) => stage.states!.includes(i.currentState))

  const countFor = (states: string[] | null) =>
    states === null ? rows.length : rows.filter((i) => states.includes(i.currentState)).length

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [item.internalSku, (item as any).serialNumber, modelName(item), brandName((item as any).brandId)]
      .some((v) => v?.toLowerCase().includes(q))
  })

  useEffect(() => {
    if (!all.loading && rows.length > 0) setLastUpdated(new Date())
  }, [all.loading, rows.length])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const validPage = Math.min(Math.max(1, currentPage), totalPages || 1)
  const startIndex = (validPage - 1) * itemsPerPage
  const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage)

  const handleSearchChange = (value: string) => { setSearch(value); setCurrentPage(1); setOpen(null) }
  const handleViewChange = (next: string) => { setView(next); setCurrentPage(1); setOpen(null) }

  /** The moves this person could make on this item, best first. */
  function movesFor(item: ConsignmentItem): Planned[] {
    return (nextByState.get(item.currentState) ?? [])
      .map((n) => planMove(n, item.currentState, item.id, session))
  }

  /**
   * What the row offers, in one place.
   *
   * Carrying on is the move somebody came here to make; failing, quarantining
   * and putting an item back are not, and they sit one click away in the
   * drawer. A move wanting a reason or a note is not a one-click move either —
   * it opens the drawer, where there is room to say why.
   *
   * When nothing carries the item forward the drawer becomes the call to
   * action, because the row saying "nothing to do" beside a button holding two
   * legal moves is a lie the staff member finds out by clicking anyway.
   */
  function offerFor(item: ConsignmentItem) {
    const moves = movesFor(item)
    const actionable = moves.filter((p) => p.mode !== 'note')
    return {
      moves,
      actionable,
      primary: actionable.find((p) => isForward(p.state)) ?? null,
    }
  }

  async function quickMove(item: ConsignmentItem, p: Planned) {
    setBusy(item.id)
    setRowError((e) => ({ ...e, [item.id]: '' }))
    try {
      await runMove(item.id, item.currentState, p.state.toState, null, null)
      all.reload()
    } catch (e) {
      setRowError((prev) => ({
        ...prev,
        [item.id]: e instanceof ApiError ? e.message : 'That move did not go through',
      }))
      setOpen(item.id)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="inv">
      <div className="inv__header">
        <div>
          <h1 className="inv__title">Inventory Database</h1>
          <p className="tg-muted inv__subtitle">View and manage all items in the system</p>
        </div>
      </div>

      {/* Stage tabs */}
      <nav className="inv__filters" aria-label="Inventory views">
        {shown.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`inv__filter${stage.key === s.key ? ' inv__filter--active' : ''}`}
            onClick={() => handleViewChange(s.key)}
            aria-pressed={stage.key === s.key}
          >
            {s.label}
            <span className="inv__filter-count">{countFor(s.states)}</span>
          </button>
        ))}
      </nav>

      {/* Search bar */}
      <div className="inv__search-box">
        <input
          type="text"
          className="tg-input inv__search"
          placeholder="Search by SKU, serial, model or brand…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label="Search inventory"
        />
        <span className="inv__search-info tg-muted">
          {filtered.length} of {items.length} items • Last updated {lastUpdated.toLocaleTimeString()}
        </span>
      </div>

      {all.loading && <Loading label="Loading inventory" />}
      {all.error && <ErrorNote error={all.error} onRetry={all.reload} />}

      {!all.loading && !all.error && filtered.length === 0 && (
        <Empty title={search ? 'No items found' : 'No items at this stage'} />
      )}

      {!all.loading && filtered.length > 0 && (
        <div className="tg-card inv__table-container">
          <table className="inv__table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Grade</th>
                <th>Status</th>
                <th className="inv__num">Price</th>
                <th>Next step</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const { moves, actionable, primary } = offerFor(item)
                const expanded = open === item.id
                const working = busy === item.id
                return [
                  <tr key={item.id} className={expanded ? 'inv__row inv__row--open' : 'inv__row'}>
                    <td>
                      <Link to={`/items/${item.id}`} className="inv__sku tg-mono">{item.internalSku}</Link>
                      <span className="inv__gear">
                        {[brandName((item as any).brandId), modelName(item)].filter(Boolean).join(' ') || '—'}
                      </span>
                    </td>
                    <td>{(item as any).assignedGradeCode ?? (item as any).declaredGradeCode ?? '—'}</td>
                    <td>
                      {/* The field is currentState; `state` was always undefined,
                          so every row read "Unknown". */}
                      <StateBadge state={item.currentState} />
                    </td>
                    <td className="inv__num">
                      <span className="inv__price">{money((item as any).askingAmountMinor || 0)}</span>
                      <span className="inv__floor tg-muted">
                        floor {money((item as any).floorAmountMinor || 0)}
                      </span>
                    </td>
                    <td>
                      <div className="inv__next">
                        {primary && primary.mode === 'go' && (
                          <Link to={primary.to!} className="tg-button tg-button--primary inv__go" title={primary.hint}>
                            {primary.label} <span aria-hidden="true">→</span>
                          </Link>
                        )}
                        {primary && primary.mode === 'act' && (
                          <button
                            type="button"
                            className="tg-button tg-button--primary inv__go"
                            title={primary.hint}
                            disabled={working}
                            onClick={() =>
                              primary.state.requiresReason || primary.state.requiresNote
                                ? setOpen(expanded ? null : item.id)
                                : quickMove(item, primary)
                            }
                          >
                            {working ? 'Working…' : primary.label}
                          </button>
                        )}
                        {!primary && actionable.length === 0 && (
                          <span className="tg-muted inv__nothing">
                            {moves.length === 0 ? 'End of the line' : 'Waiting on others'}
                          </span>
                        )}
                        {moves.length > 0 && (
                          <button
                            type="button"
                            /* Promoted when it is the only way on: a quiet pill
                               beside the words "waiting on others" reads as
                               decoration, and gets ignored. */
                            className={!primary && actionable.length > 0
                              ? 'inv__more inv__more--cta'
                              : 'inv__more'}
                            aria-expanded={expanded}
                            onClick={() => setOpen(expanded ? null : item.id)}
                          >
                            {expanded ? 'Close'
                              : !primary && actionable.length > 0
                                ? `${actionable.length} move${actionable.length === 1 ? '' : 's'} →`
                                : 'Options'}
                          </button>
                        )}
                      </div>
                      {rowError[item.id] && (
                        <p className="inv__row-error" role="alert">{rowError[item.id]}</p>
                      )}
                    </td>
                  </tr>,

                  expanded && (
                    <tr key={`${item.id}-open`} className="inv__drawer-row">
                      <td colSpan={5}>
                        <div className="inv__drawer">
                          <div className="inv__drawer-head">
                            <strong>{STATE_LABELS[item.currentState] ?? item.currentState}</strong>
                            <span className="tg-muted"> — where it can go from here</span>
                            <Link to={`/items/${item.id}`} className="inv__record">
                              Open the full record →
                            </Link>
                          </div>
                          <NextActions
                            itemId={item.id}
                            currentState={item.currentState}
                            nextLegalStates={nextByState.get(item.currentState) ?? []}
                            onDone={() => { all.reload(); setOpen(null) }}
                          />
                        </div>
                      </td>
                    </tr>
                  ),
                ]
              })}
            </tbody>
          </table>

          <div className="inv__pagination">
            <button
              className="tg-button"
              disabled={validPage === 1}
              onClick={() => { setCurrentPage(validPage - 1); setOpen(null) }}
            >
              ← Previous
            </button>
            <span className="inv__page-info">
              Page {validPage} of {totalPages || 1}
            </span>
            <button
              className="tg-button"
              disabled={validPage === totalPages}
              onClick={() => { setCurrentPage(validPage + 1); setOpen(null) }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
