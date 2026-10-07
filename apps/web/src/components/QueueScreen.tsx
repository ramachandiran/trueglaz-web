import { useEffect, useState, type ReactNode } from 'react'
import { Empty, ErrorNote, Loading } from './ui'
import './QueueScreen.css'

export interface QueueTab {
  key: string
  label: string
  count: number
}

/**
 * The chrome every ops screen wears: a title, counted tabs, a search box that
 * says how much it is hiding, a table, and pagination.
 *
 * It exists as one component rather than as two pages that resemble each other,
 * because the resemblance is the point. Inventory and Operations were built
 * months apart and drifted — one a paginated table with counted stage tabs, the
 * other a column of cards whose queues gave no hint of their size until you
 * clicked them. A staff member moving between the two had to relearn where
 * things were. Changing the shape here changes both.
 *
 * It owns the layout and nothing else. What a row is, what it says and what it
 * does belong to the screen: a submission, an item and a buyer's request have
 * nothing in common but the frame around them.
 */
export function QueueScreen({
  title, subtitle, tabs, active, onTab,
  search, onSearch, searchPlaceholder = 'Search…',
  shown, total, unit = 'items',
  loading, error, onRetry, emptyTitle, emptyHint,
  page, pages, onPage,
  actions, summary,
  children,
}: {
  title: string
  subtitle: string
  tabs: QueueTab[]
  active: string
  onTab: (key: string) => void
  search: string
  onSearch: (value: string) => void
  searchPlaceholder?: string
  shown: number
  total: number
  unit?: string
  loading: boolean
  error: Error | null
  onRetry: () => void
  emptyTitle: string
  emptyHint?: string
  page: number
  pages: number
  onPage: (page: number) => void
  /** Sits at the right of the title: the one thing to do with the whole screen, such as a download. */
  actions?: ReactNode
  /** Between the tabs and the search: figures for exactly what the tabs have selected. */
  summary?: ReactNode
  children: ReactNode
}) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    if (!loading && total > 0) setLastUpdated(new Date())
  }, [loading, total, active])

  return (
    <div className="q">
      <div className="q__header">
        <div>
          <h1 className="q__title">{title}</h1>
          <p className="tg-muted q__subtitle">{subtitle}</p>
        </div>
        {actions && <div className="q__actions">{actions}</div>}
      </div>

      {/* The counts are the point of a tab row on a work screen: an empty queue
          should read as empty before it is opened, not after. */}
      <nav className="q__filters" aria-label={`${title} views`}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`q__filter${active === t.key ? ' q__filter--active' : ''}`}
            onClick={() => onTab(t.key)}
            aria-pressed={active === t.key}
          >
            {t.label}
            <span className="q__filter-count">{t.count}</span>
          </button>
        ))}
      </nav>

      {summary}

      <div className="q__search-box">
        <input
          type="text"
          className="tg-input q__search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label={`Search ${title.toLowerCase()}`}
        />
        <span className="q__search-info tg-muted">
          {shown} of {total} {unit} • Last updated {lastUpdated.toLocaleTimeString()}
        </span>
      </div>

      {loading && <Loading label={`Loading ${title.toLowerCase()}`} />}
      {error && <ErrorNote error={error} onRetry={onRetry} />}

      {!loading && !error && shown === 0 && (
        <Empty title={search ? 'Nothing matches that' : emptyTitle} hint={search ? undefined : emptyHint} />
      )}

      {!loading && shown > 0 && (
        <div className="tg-card q__table-container">
          {children}

          <div className="q__pagination">
            <button className="tg-button" disabled={page === 1} onClick={() => onPage(page - 1)}>
              ← Previous
            </button>
            <span className="q__page-info">Page {page} of {pages || 1}</span>
            <button className="tg-button" disabled={page === pages} onClick={() => onPage(page + 1)}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
