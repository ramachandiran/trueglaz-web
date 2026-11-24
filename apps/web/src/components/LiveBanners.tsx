import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LiveNotice } from '@trueglaz/core'
import { Icon, ICONS } from './StaffShell'
import './LiveBanners.css'

export type LiveBanner = {
  id: string
  /** work: something new to pick up. urgent: waiting on this person, stays until dismissed. info: for the record. */
  tone: 'work' | 'urgent' | 'info'
  icon: string
  area: string
  title: string
  body: string
  /** A link to the record, or (for the desktop-alerts offer) a button. */
  action?: { label: string; to?: string; onClick?: () => void }
  at: number
}

const AUTO_MS = 8000
const MAX_SHOWN = 3

/**
 * Banner notifications for the team (TG-208). New work slides in at the top
 * right (the bottom on a phone); ordinary banners leave by themselves after
 * eight seconds, paused while the pointer or focus is on them; urgent ones stay
 * until dismissed. More than three (one on a phone) collapse into "+n more".
 * Every banner is also in the bell.
 */
export function LiveBanners({ items, onDismiss, onOpen }: { items: LiveBanner[]; onDismiss: (id: string) => void; onOpen?: (id: string) => void }) {
  // A phone has room for one: the newest urgent one first, then the newest.
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const m = window.matchMedia('(max-width: 640px)')
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  const shown = items.slice(0, narrow ? 1 : MAX_SHOWN)
  const more = items.length - shown.length
  return (
    <div className="lb" role="region" aria-label="New notifications">
      {shown.map((b) => <Banner key={b.id} b={b} onDismiss={() => onDismiss(b.id)} onOpen={() => onOpen?.(b.id)} />)}
      {more > 0 && <Link to="/profile#notifications" className="lb__more">+{more} more in notifications</Link>}
    </div>
  )
}

function Banner({ b, onDismiss, onOpen }: { b: LiveBanner; onDismiss: () => void; onOpen: () => void }) {
  const [paused, setPaused] = useState(false)
  const left = useRef(AUTO_MS)
  useEffect(() => {
    if (b.tone === 'urgent' || paused) return
    const start = Date.now()
    const t = window.setTimeout(onDismiss, left.current)
    return () => { window.clearTimeout(t); left.current -= Date.now() - start }
  }, [paused, b.tone, onDismiss])
  return (
    <div className={`lb__card lb__card--${b.tone}${paused ? ' lb__card--paused' : ''}`} role={b.tone === 'urgent' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <span className="lb__ic"><Icon d={b.icon} /></span>
      <div className="lb__text">
        <div className="lb__meta"><span>{b.area}</span> · <span>{ago(b.at)}</span>{b.tone === 'urgent' && <span className="lb__flag">Needs you</span>}</div>
        <b className="lb__title">{b.title}</b>
        <p className="lb__body">{b.body}</p>
        {b.action && (
          <div className="lb__acts">
            {b.action.to
              ? <Link to={b.action.to} className={`c-btn c-btn--sm ${b.tone === 'info' ? 'c-btn--navy' : 'c-btn--cta'}`} onClick={() => { onOpen(); onDismiss() }}>{b.action.label}</Link>
              : <button type="button" className="c-btn c-btn--sm c-btn--navy" onClick={() => { b.action?.onClick?.(); onDismiss() }}>{b.action.label}</button>}
            <button type="button" className="c-btn c-btn--sm" onClick={onDismiss}>{b.action.to ? 'Later' : 'Not now'}</button>
          </div>
        )}
      </div>
      <button type="button" className="lb__x" aria-label={`Dismiss: ${b.title}`} onClick={onDismiss}><Icon d={ICONS.close} /></button>
      {b.tone !== 'urgent' && <span className="lb__timer" style={{ animationDuration: `${AUTO_MS}ms` }} aria-hidden="true" />}
    </div>
  )
}

function ago(at: number) {
  const s = Math.round((Date.now() - at) / 1000)
  return s < 45 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : 'earlier'
}

/**
 * What each kind of notification looks like as a banner. A function, not a
 * constant: this module and StaffShell import each other, so ICONS is not
 * there yet while this file is first being read.
 */
const kinds = (): Record<string, { tone: LiveBanner['tone']; icon: string; area: string; action: string }> => ({
  staff_return_requested: { tone: 'work', icon: ICONS.returns, area: 'Returns', action: 'Review return' },
  staff_cancel_requested: { tone: 'work', icon: ICONS.fulfilment, area: 'Fulfilment', action: 'Review request' },
  staff_order_paid: { tone: 'work', icon: ICONS.bag, area: 'Fulfilment', action: 'Open order' },
  staff_insurance_requested: { tone: 'info', icon: ICONS.insurance, area: 'Insurance desk', action: 'Open request' },
  staff_selling_requested: { tone: 'info', icon: ICONS.people, area: 'People', action: 'Review' },
  admin_payout_pending: { tone: 'urgent', icon: ICONS.money, area: 'Payouts', action: 'Review payout' },
  admin_return_escalated: { tone: 'urgent', icon: ICONS.alert, area: 'Returns', action: 'Decide' },
  tech_unit_assigned: { tone: 'work', icon: ICONS.wrench, area: 'My bench', action: 'Open unit' },
})

export function bannerFor(n: LiveNotice): LiveBanner {
  const k = kinds()[n.code] ?? { tone: 'info' as const, icon: ICONS.bell, area: 'Notification', action: 'Open' }
  return {
    id: n.id, tone: k.tone, icon: k.icon, area: k.area, title: n.title, body: n.body,
    action: n.link ? { label: k.action, to: n.link } : undefined, at: Date.parse(n.at) || Date.now(),
  }
}

/** Newest first, with anything urgent kept on top. */
export function addBanner(list: LiveBanner[], b: LiveBanner): LiveBanner[] {
  if (list.some((x) => x.id === b.id)) return list
  const next = [b, ...list]
  return [...next.filter((x) => x.tone === 'urgent'), ...next.filter((x) => x.tone !== 'urgent')].slice(0, 20)
}
