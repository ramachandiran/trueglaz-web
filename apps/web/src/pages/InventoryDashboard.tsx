import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api, money, useApi, useSession, isStaff,
  type ConsignmentItem, type NextState,
} from '@trueglaz/core'
import { Empty, ErrorNote, Loading } from '../components/ui'
import { planMove, type Planned } from '../components/NextActions'
import { StateMenu } from '../components/StateMenu'
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
 * The table is deliberately four columns. Brand, model and SKU are one thing —
 * which item this is — and reading them as three columns made a staff member
 * scan sideways to answer a question they never asked. Asking and floor are one
 * thing too. There is no action column at all: the status chip is the control,
 * the way a ticket's status is, so the move out of a state is made where the
 * state is written rather than on a screen you have to go and find.
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

/** Where an assignment is still live work rather than a stale note. */
const BENCH_STATES = ['RECEIVED', 'IN_INSPECTION', 'RE_INSPECTION', 'RETURN_RECEIVED', 'INSPECTION_FAILED']

export function InventoryDashboard() {
  const { session } = useSession()
  const [view, setView] = useState('all')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
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

  const reasons = useApi(() => api.reasonCodes('item_transition'), [])
  // Who a unit can be handed to. Read by everyone on the floor so a technician
  // can see whose bench a row is on, not only the person doing the handing.
  const technicians = useApi(() => api.technicians(), [])
  const technicianName = (id?: string | null) =>
    (technicians.data ?? []).find((t) => t.id === id)?.displayName ?? null

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

  const handleSearchChange = (value: string) => { setSearch(value); setCurrentPage(1) }
  const handleViewChange = (next: string) => { setView(next); setCurrentPage(1) }

  /** The moves this person could make on this item, in rule order. */
  function movesFor(item: ConsignmentItem): Planned[] {
    return (nextByState.get(item.currentState) ?? [])
      .map((n) => planMove(n, item.currentState, item.id, session))
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
                <th className="inv__num">Price</th>
                <th className="inv__num">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/items/${item.id}`} className="inv__sku tg-mono">{item.internalSku}</Link>
                    <span className="inv__gear">
                      {[brandName((item as any).brandId), modelName(item)].filter(Boolean).join(' ') || '—'}
                    </span>
                    {/* Whose bench it is on. Only worth a line while it is work:
                        a sold item assigned to somebody last month is noise. */}
                    {item.assignedTechnicianUserId && BENCH_STATES.includes(item.currentState) && (
                      <span className="inv__bench">
                        on {technicianName(item.assignedTechnicianUserId) ?? 'a bench'}
                      </span>
                    )}
                  </td>
                  <td>{(item as any).assignedGradeCode ?? (item as any).declaredGradeCode ?? '—'}</td>
                  <td className="inv__num">
                    <span className="inv__price">{money((item as any).askingAmountMinor || 0)}</span>
                    <span className="inv__floor tg-muted">
                      floor {money((item as any).floorAmountMinor || 0)}
                    </span>
                  </td>
                  <td className="inv__num">
                    {/* The field is currentState; `state` was always undefined,
                        so every row read "Unknown". */}
                    <StateMenu
                      itemId={item.id}
                      sku={item.internalSku}
                      gear={[brandName((item as any).brandId), modelName(item)].filter(Boolean).join(' ') || item.internalSku}
                      currentState={item.currentState}
                      moves={movesFor(item)}
                      reasons={reasons.data ?? []}
                      technicians={technicians.data ?? []}
                      assignedTo={item.assignedTechnicianUserId}
                      canAssign={staff}
                      onDone={() => all.reload()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="inv__pagination">
            <button
              className="tg-button"
              disabled={validPage === 1}
              onClick={() => setCurrentPage(validPage - 1)}
            >
              ← Previous
            </button>
            <span className="inv__page-info">
              Page {validPage} of {totalPages || 1}
            </span>
            <button
              className="tg-button"
              disabled={validPage === totalPages}
              onClick={() => setCurrentPage(validPage + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
