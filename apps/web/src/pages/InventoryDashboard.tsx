import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, money, useApi, useSession, isStaff } from '@trueglaz/core'
import { Empty, ErrorNote, Loading, StateBadge } from '../components/ui'
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
  const nav = useNavigate()
  const [view, setView] = useState('all')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const itemsPerPage = 10
  const staff = isStaff(session)

  // No state parameter means every state, which is what this screen is for.
  const all = useApi(() => api.itemQueue(), [])
  const rows = all.data ?? []

  // The queue returns a consignment_item as stored, which holds ids rather than
  // names — so Brand printed a raw uuid and Model an em dash for anything
  // linked to the catalogue. Both are looked up here.
  const brands = useApi(() => api.brands(), [])
  const models = useApi(() => api.models(), [])
  const brandName = (id?: string | null) =>
    (brands.data ?? []).find((b) => b.id === id)?.name ?? null
  const modelName = (item: any) =>
    (models.data?.content ?? []).find((m: any) => m.id === item.productModelId)?.name
      ?? item.modelFreeText
      ?? null

  const tabs = STAGES.filter((s) => staff || !s.staffOnly)

  // Anything the groups above do not name would otherwise be reachable only
  // under "All items", so it gets a tab of its own instead of going quiet.
  const named = useMemo(
    () => new Set(STAGES.flatMap((s) => s.states ?? [])),
    [],
  )
  const strays = useMemo(
    () => [...new Set(rows.filter((i: any) => !named.has(i.currentState)).map((i: any) => i.currentState))].sort(),
    [rows, named],
  )
  const shown = strays.length > 0
    ? [...tabs, { key: 'other', label: 'Other', states: strays, staffOnly: false }]
    : tabs

  const stage = shown.find((s) => s.key === view) ?? shown[0]
  const items = stage.states === null
    ? rows
    : rows.filter((i: any) => stage.states!.includes(i.currentState))

  const countFor = (states: string[] | null) =>
    states === null ? rows.length : rows.filter((i: any) => states.includes(i.currentState)).length

  // Filter by search term
  const filtered = items.filter((item: any) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [item.internalSku, item.serialNumber, modelName(item), brandName(item.brandId)]
      .some((v) => v?.toLowerCase().includes(q))
  })

  useEffect(() => {
    if (!all.loading && rows.length > 0) setLastUpdated(new Date())
  }, [all.loading, rows.length])

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const validPage = Math.min(Math.max(1, currentPage), totalPages || 1)
  const startIndex = (validPage - 1) * itemsPerPage
  const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage)

  // Reset to page 1 when search or view changes
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const handleViewChange = (newView: string) => {
    setView(newView)
    setCurrentPage(1)
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

      {/* Items table */}
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
                <th>SKU</th>
                <th>Model</th>
                <th>Brand</th>
                <th>Grade</th>
                <th>Status</th>
                <th>Asking</th>
                <th>Floor</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item: any) => (
                <tr key={item.id}>
                  <td className="inv__sku tg-mono">{item.internalSku}</td>
                  <td>{modelName(item) ?? '—'}</td>
                  <td>{brandName(item.brandId) ?? '—'}</td>
                  <td>{item.assignedGradeCode ?? item.declaredGradeCode ?? '—'}</td>
                  <td>
                    {/* The field is currentState; `state` was always undefined,
                        so every row read "Unknown". */}
                    <StateBadge state={item.currentState} />
                  </td>
                  <td>{money(item.askingAmountMinor || 0)}</td>
                  <td>{money(item.floorAmountMinor || 0)}</td>
                  <td>
                    <button
                      className="tg-button tg-button--secondary inv__action-btn"
                      title="View item details"
                      onClick={() => nav(`/items/${item.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination controls */}
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
