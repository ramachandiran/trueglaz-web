import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, money, STATE_LABELS, type ConsoleHit, type ConsoleSearch } from '@trueglaz/core'
import { Icon, ICONS } from './StaffShell'
import './CommandMenu.css'

type Option = { id: string; group: string; title: string; sub?: string | null; meta?: string | null; icon: string; to: string }

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * The console's command menu (TG-202): one box in the top bar that finds a
 * unit, an order, a person or a screen, wherever it lives.
 *
 * "/" or Ctrl/⌘ K puts the cursor in it. Typing lists matches by kind; arrows
 * move, Enter opens, Esc closes. It is an ARIA combobox with a listbox, so a
 * screen reader hears each option as the highlight moves. With nothing
 * highlighted, Enter still does what the box always did: searches Inventory.
 */
export function CommandMenu({ screens }: { screens: { label: string; to: string }[] }) {
  const nav = useNavigate()
  const { pathname, search } = useLocation()
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [res, setRes] = useState<ConsoleSearch | null>(null)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(-1)

  // Coming back to Inventory shows what it is filtered by.
  useEffect(() => {
    if (pathname === '/admin/inventory') setQ(new URLSearchParams(search).get('q') ?? '')
    setOpen(false)
  }, [pathname, search])

  // "/" or Ctrl/⌘ K from anywhere.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
      if ((e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])

  // Ask the server a moment after typing stops; a newer question wins.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setRes(null); setBusy(false); return }
    setBusy(true)
    let stale = false
    const t = setTimeout(() => {
      api.staffSearch(term).then((r) => { if (!stale) setRes(r) }).catch(() => { if (!stale) setRes(null) }).finally(() => { if (!stale) setBusy(false) })
    }, 180)
    return () => { stale = true; clearTimeout(t) }
  }, [q])

  // Close on a click elsewhere.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const options = useMemo<Option[]>(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const hit = (h: ConsoleHit): Option => h.kind === 'unit'
      ? { id: `u-${h.id}`, group: 'Units', title: h.title, sub: h.subtitle, meta: h.meta ? STATE_LABELS[h.meta] ?? h.meta : null, icon: ICONS.camera, to: `/items/${h.id}` }
      : h.kind === 'order'
        ? { id: `o-${h.id}`, group: 'Orders', title: h.title, sub: h.subtitle, meta: h.amountMinor != null ? money(h.amountMinor) : h.meta, icon: ICONS.bag, to: `/admin/fulfilment?q=${encodeURIComponent(h.title)}` }
        : { id: `p-${h.id}`, group: 'People', title: h.title, sub: h.subtitle, icon: ICONS.people, to: `/admin/people/${h.id}` }
    const screensHit = screens.filter((s) => s.label.toLowerCase().includes(term)).slice(0, 4)
      .map((s): Option => ({ id: `s-${s.to}`, group: 'Screens', title: s.label, icon: ICONS.arrow, to: s.to }))
    const all: Option[] = [
      ...screensHit,
      ...(res?.units ?? []).map(hit), ...(res?.orders ?? []).map(hit), ...(res?.people ?? []).map(hit),
    ]
    // Always offer the box's old behaviour last: search the whole Inventory.
    all.push({ id: 'inv', group: 'Search', title: `Search Inventory for “${q.trim()}”`, icon: ICONS.search, to: `/admin/inventory?q=${encodeURIComponent(q.trim())}` })
    return all
  }, [q, res, screens])

  useEffect(() => { setActive(-1) }, [options.length, q])

  function go(o: Option) {
    setOpen(false)
    input.current?.blur()
    nav(o.to)
  }
  function onKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const o = active >= 0 ? options[active] : options[options.length - 1]
      if (o) go(o)
      else nav('/admin/inventory')
    } else if (e.key === 'Escape') {
      if (open) { e.stopPropagation(); setOpen(false) } else input.current?.blur()
    }
  }

  const listId = 'cmd-list'
  const showList = open && q.trim().length > 0
  const groups = [...new Set(options.map((o) => o.group))]
  const nothing = !busy && res && q.trim().length >= 2 && res.units.length + res.orders.length + res.people.length === 0

  return (
    <div className="cmd" ref={box}>
      <div className="staff-search" role="search">
        <Icon d={ICONS.search} />
        <input ref={input} type="text" value={q} placeholder="Search units, orders, people…"
          role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `cmd-${options[active].id}` : undefined}
          aria-label="Search the console" aria-keyshortcuts={isMac ? 'Meta+K /' : 'Control+K /'}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
        {busy && <span className="cmd__spin" aria-hidden="true" />}
        <span className="staff-search__keys" aria-hidden="true"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd></span>
      </div>
      {showList && (
        <div className="cmd__pop">
          <ul id={listId} role="listbox" aria-label="Results" className="cmd__list">
            {groups.map((g) => (
              <li key={g} role="presentation">
                <div className="cmd__group" aria-hidden="true">{g}</div>
                <ul role="group" aria-label={g}>
                  {options.map((o, i) => o.group !== g ? null : (
                    <li key={o.id} id={`cmd-${o.id}`} role="option" aria-selected={i === active}
                      className={`cmd__opt${i === active ? ' cmd__opt--on' : ''}`}
                      onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); go(o) }}>
                      <span className="cmd__ic"><Icon d={o.icon} /></span>
                      <span className="cmd__text"><b>{o.title}</b>{o.sub && <small>{o.sub}</small>}</span>
                      {o.meta && <span className="cmd__meta">{o.meta}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {nothing && <p className="cmd__none">No unit, order or person matches “{q.trim()}”.</p>}
          {q.trim().length === 1 && <p className="cmd__none">Keep typing: two letters or more.</p>}
          <p className="cmd__help" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</p>
        </div>
      )}
      <span className="tg-visually-hidden" role="status" aria-live="polite">
        {showList && !busy && res ? `${res.units.length} units, ${res.orders.length} orders, ${res.people.length} people` : ''}
      </span>
    </div>
  )
}
