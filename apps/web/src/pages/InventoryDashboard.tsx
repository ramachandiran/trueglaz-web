import { useState } from 'react'
import { api, money, useApi, useSession, isStaff } from '@trueglaz/core'
import { Empty, ErrorNote, Loading } from '../components/ui'
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
  const [view, setView] = useState<View>('all')
  const [search, setSearch] = useState('')

  // Load all items based on current view/filter
  const allItems = useApi(() => api.itemQueue('ALL'), [])
  const pendingApproval = useApi(() => api.itemQueue('GRADED'), [])
  const listedItems = useApi(() => api.itemQueue('LISTED'), [])
  const gradedItems = useApi(() => api.itemQueue('GRADED'), [])
  const inInspection = useApi(() => api.itemQueue('IN_INSPECTION'), [])

  const staff = isStaff(session)

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
  const filtered = items.filter((item: any) =>
    item.internalSku?.toLowerCase().includes(search.toLowerCase()) ||
    item.modelFreeText?.toLowerCase().includes(search.toLowerCase()) ||
    item.brandId?.toLowerCase().includes(search.toLowerCase())
  )

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
        <FilterTab active={view === 'all'} onClick={() => setView('all')} label="All items" />
        {staff && <FilterTab active={view === 'pending-approval'} onClick={() => setView('pending-approval')} label="Pending approval" />}
        <FilterTab active={view === 'listed'} onClick={() => setView('listed')} label="Listed" />
        <FilterTab active={view === 'graded'} onClick={() => setView('graded')} label="Graded" />
        <FilterTab active={view === 'in-inspection'} onClick={() => setView('in-inspection')} label="In inspection" />
      </nav>

      {/* Search bar */}
      <div className="inv__search-box">
        <input
          type="text"
          className="tg-input inv__search"
          placeholder="Search by SKU, model, or brand…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search inventory"
        />
        <span className="inv__search-info tg-muted">
          {filtered.length} of {items.length} items
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
              {filtered.map((item: any) => (
                <tr key={item.id}>
                  <td className="inv__sku tg-mono">{item.internalSku}</td>
                  <td>{item.modelFreeText || '—'}</td>
                  <td>{item.brandId || '—'}</td>
                  <td>{item.declaredGradeCode || '—'}</td>
                  <td>
                    <span className={`inv__state inv__state--${item.state?.toLowerCase().replace(/_/g, '-') || 'unknown'}`}>
                      {item.state || 'Unknown'}
                    </span>
                  </td>
                  <td>{money(item.askingAmountMinor || 0)}</td>
                  <td>{money(item.floorAmountMinor || 0)}</td>
                  <td>
                    <button className="tg-button tg-button--secondary inv__action-btn" title="View item details">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
