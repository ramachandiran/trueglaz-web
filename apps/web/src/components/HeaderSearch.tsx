import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * The search box in the header.
 *
 * It writes to the URL rather than to the catalogue's local state, which is
 * what lets a search be linked, bookmarked and walked back through with the
 * browser's own back button — and is why the box can live up here at all,
 * outside the page that renders the results.
 */
export function HeaderSearch() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [text, setText] = useState(params.get('q') ?? '')

  // Someone arriving on a shared link, or pressing back, should see the box
  // holding the terms the results are actually for.
  useEffect(() => { setText(params.get('q') ?? '') }, [params])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = text.trim()
    nav(q ? `/?q=${encodeURIComponent(q)}` : '/')
  }

  return (
    <form className="search" role="search" onSubmit={submit}>
      <input
        className="search__input"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search cameras and lenses"
        aria-label="Search gear"
      />
      <button className="search__go" type="submit" aria-label="Search">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="12.8" y1="12.8" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  )
}
