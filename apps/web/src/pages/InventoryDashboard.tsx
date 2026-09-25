import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, money, useApi, useSession, isStaff } from '@trueglaz/core'
import { Empty, ErrorNote, Loading, StateBadge } from '../components/ui'
import './InventoryDashboard.css'

type View = 'all' | 'pending-approval' | 'listed' | 'graded' | 'in-inspection'

/**
 * Inventory database dashboard for ops staff.
 *
 * A complete view of all items in the system, filterable by status and searchable.
 * This is the primary interface for ops/staff login rather than the work queue view.
 */
export function InventoryDashboard() {
  const { session } = useSession()
  const nav = useNavigate()
  const [view, setView] = useState<View>('all')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const itemsPerPage = 10

  // Load all items based on current view/filter
  // No state at all means every state. 'ALL' was read as a state name, matched
  // nothing, and left the landing tab showing "0 of 0 items".
  const pendingApproval = useApi(() => api.itemQueue('AWAITING_SELLER_APPROVAL'), [])
  const listedItems = useApi(() => api.itemQueue('LISTED'), [])
  const gradedItems = useApi(() => api.itemQueue('GRADED'), [])
  const inInspection = useApi(() => api.itemQueue('IN_INSPECTION'), [])
  const received = useApi(() => api.itemQueue('RECEIVED'), [])
  const inTransit = useApi(() => api.itemQueue('IN_TRANSIT_INBOUND'), [])

  // Combine all items from different states for "All items" view
  const allItemsData = {
    loading: pendingApproval.loading || listedItems.loading || gradedItems.loading || inInspection.loading || received.loading || inTransit.loading,
    error: pendingApproval.error || listedItems.error || gradedItems.error || inInspection.error || received.error || inTransit.error,
    data: [
      ...(pendingApproval.data ?? []),
      ...(listedItems.data ?? []),
      ...(gradedItems.data ?? []),
      ...(inInspection.data ?? []),
      ...(received.data ?? []),
      ...(inTransit.data ?? []),
    ].filter((item, index, self) => self.findIndex(i => i.id === item.id) === index), // Remove duplicates
    reload: () => {
      pendingApproval.reload()
      listedItems.reload()
      gradedItems.reload()
      inInspection.reload()
      received.reload()
      inTransit.reload()
    },
  }
  const allItems = allItemsData

  const staff = isStaff(session)

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

  // Map views to their data source
  const stateMap: Record<View, ReturnType<typeof useApi<any>>> = {
    'all': allItems,
    'pending-approval': pendingApproval,
    'listed': listedItems,
    'graded': gradedItems,
    'in-inspection': inInspection,
  }

  const state = stateMap[view]
  const items = state.data ?? []

  // Filter by search term
  const filtered = items.filter((item: any) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [item.internalSku, item.serialNumber, modelName(item), brandName(item.brandId)]
      .some((v) => v?.toLowerCase().includes(q))
  })

  useEffect(() => {
    if (!state.loading && items.length > 0) {
      setLastUpdated(new Date())
    }
  }, [state.loading, items.length, view])

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const validPage = Math.min(Math.max(1, currentPage), totalPages || 1)
  const startIndex = (validPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filtered.slice(startIndex, endIndex)

  // Reset to page 1 when search or view changes
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const handleViewChange = (newView: View) => {
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

      {/* Filter tabs */}
      <nav className="inv__filters" aria-label="Inventory views">
        <FilterTab active={view === 'all'} onClick={() => handleViewChange('all')} label="All items" />
        {staff && <FilterTab active={view === 'pending-approval'} onClick={() => handleViewChange('pending-approval')} label="Pending approval" />}
        <FilterTab active={view === 'listed'} onClick={() => handleViewChange('listed')} label="Listed" />
        <FilterTab active={view === 'graded'} onClick={() => handleViewChange('graded')} label="Graded" />
        <FilterTab active={view === 'in-inspection'} onClick={() => handleViewChange('in-inspection')} label="In inspection" />
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
      {state.loading && <Loading label="Loading inventory" />}
      {state.error && <ErrorNote error={state.error} onRetry={state.reload} />}

      {!state.loading && filtered.length === 0 && (
        <Empty title={search ? 'No items found' : 'No items in this category'} />
      )}

      {!state.loading && filtered.length > 0 && (
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

function FilterTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={`inv__filter${active ? ' inv__filter--active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  )
}
