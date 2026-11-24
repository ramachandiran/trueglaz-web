import { type ReactNode } from 'react'
import { Empty, ErrorNote, Loading } from './ui'
import { PageHead } from './PageHead'
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
 * In the console (TG-126) the title sits in the top bar; search, tabs and the
 * screen's action share one toolbar inside the card, the way the admin template
 * lays a list out, and a filter a widget sent you here with is shown, counted
 * and clearable above the table.
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
  actions, summary, filter, perPage = 25,
  crumbs, headActions,
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
  /** Sits at the right of the toolbar: the one thing to do with the whole screen, such as a download. */
  actions?: ReactNode
  /** Above the list: figures for exactly what the tabs have selected. */
  summary?: ReactNode
  /** A filter a Control room widget opened this screen with: named, and one click to clear. */
  filter?: { label: string; onClear: () => void } | null
  perPage?: number
  /** Where this screen sits, for the breadcrumb over its heading. */
  crumbs?: { label: string; to?: string }[]
  /** Buttons at the right of the heading (TG-198): Export, Assign… */
  headActions?: ReactNode
  children: ReactNode
}) {
  const from = shown === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(shown, page * perPage)

  return (
    <div className="q">
      <PageHead title={title} subtitle={subtitle} crumbs={crumbs} actions={headActions} />
      {summary}

      <section className="q__card c-tcard" aria-label={title}>
        <div className="q__toolbar c-tbar">
          {/* The counts are the point of a tab row on a work screen: an empty
              queue should read as empty before it is opened, not after. */}
          <nav className="c-tabs" aria-label={`${title} views`}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`c-tabs__tab${active === t.key ? ' c-tabs__tab--on' : ''}`}
                onClick={() => onTab(t.key)}
                aria-pressed={active === t.key}
              >
                {t.label}
                <span className="c-tabs__n">{t.count}</span>
              </button>
            ))}
          </nav>
          <label className="c-tbar__search q__search-box">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5" /></svg>
            <input
              type="search"
              className="q__search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label={`Search ${title.toLowerCase()}`}
            />
          </label>
          {actions && <div className="q__actions">{actions}</div>}
        </div>

        {filter && (
          <div className="c-filter q__active" role="status">
            <span>Showing <b>{filter.label}</b> · {total} {unit}</span>
            <button type="button" onClick={filter.onClear}>Clear filter</button>
          </div>
        )}

        {loading && <Loading label={`Loading ${title.toLowerCase()}`} />}
        {error && <ErrorNote error={error} onRetry={onRetry} />}

        {!loading && !error && shown === 0 && (
          <Empty title={search ? 'Nothing matches that' : emptyTitle} hint={search ? undefined : emptyHint} />
        )}

        {!loading && shown > 0 && (
          <>
            <div className="q__table-container">{children}</div>
            <div className="q__pagination">
              <span className="q__page-info">
                Showing <b>{from}</b> to <b>{to}</b> of <b>{shown}</b> {unit}
                {shown !== total && <span className="tg-muted"> (of {total} in this view)</span>}
              </span>
              {pages > 1 && (
                <div className="q__pages">
                  <button type="button" className="q__page q__page--word" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
                  {pageList(page, pages).map((n, i) => n === 0
                    ? <span key={`gap${i}`} className="q__page q__page--gap">…</span>
                    : <button key={n} type="button" className={`q__page${n === page ? ' q__page--on' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>)}
                  <button type="button" className="q__page q__page--word" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/** Page numbers with the ends and the neighbours; 0 marks a gap. */
function pageList(page: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))
  const out: number[] = []
  let last = 0
  for (const n of [...keep].sort((a, b) => a - b)) { if (n - last > 1) out.push(0); out.push(n); last = n }
  return out
}
