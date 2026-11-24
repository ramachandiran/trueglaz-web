import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon, ICONS } from './StaffShell'
import './SidePanel.css'

/**
 * A record opened over its list (TG-200): slides in from the right, the list
 * stays where it was underneath.
 *
 * It behaves as a dialog because it is one: focus moves in and comes back to
 * whatever opened it, Tab stays inside, Esc / the X / a click on the dimmed
 * page close it, and the page behind does not scroll. On a phone it is the
 * whole screen. With Reduce motion on it appears without sliding.
 */
export function SidePanel({ open, onClose, eyebrow, title, subtitle, badges, footer, children, width = 560 }: {
  open: boolean
  onClose: () => void
  /** A small line over the title: the record's kind or reference. */
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  /** Stays at the bottom while the body scrolls: the record's actions. */
  footer?: ReactNode
  children: ReactNode
  width?: number
}) {
  const titleId = useId()
  const box = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus the panel itself so a screen reader starts at its title, not at the X.
    requestAnimationFrame(() => box.current?.focus())
    const key = (e: KeyboardEvent) => {
      // A dialog opened from the panel (Dispatch, a video) owns the keys until it closes.
      if (document.querySelector('dialog[open]')) return
      if (e.key === 'Escape') { e.stopPropagation(); close.current() }
      if (e.key === 'Tab' && box.current) {
        const f = [...box.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
          .filter((el) => el.offsetParent !== null)
        if (f.length === 0) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('keydown', key, true)
      document.body.style.overflow = prevOverflow
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="sp">
      <div className="sp__scrim" onClick={() => close.current()} aria-hidden="true" />
      <div ref={box} className="sp__panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={{ ['--sp-w' as string]: `${width}px` }}>
        <header className="sp__head">
          <div className="sp__head-text">
            {eyebrow && <div className="sp__eyebrow">{eyebrow}</div>}
            <h2 id={titleId} className="sp__title">{title}</h2>
            {subtitle && <p className="sp__sub">{subtitle}</p>}
            {badges && <div className="sp__badges">{badges}</div>}
          </div>
          <button type="button" className="sp__close" aria-label="Close" onClick={() => close.current()}>
            <Icon d={ICONS.close} />
          </button>
        </header>
        <div className="sp__body">{children}</div>
        {footer && <footer className="sp__foot">{footer}</footer>}
      </div>
    </div>,
    document.querySelector('.staff-shell') ?? document.body,
  )
}

/** A titled block inside a panel. */
export function PanelSection({ title, aside, children, tone }: { title?: string; aside?: ReactNode; children: ReactNode; tone?: 'plain' | 'card' }) {
  return (
    <section className={`sp__sec${tone === 'card' ? ' sp__sec--card' : ''}`}>
      {(title || aside) && <div className="sp__sec-head">{title && <h3>{title}</h3>}{aside}</div>}
      {children}
    </section>
  )
}

/** Label / value pairs, two columns where there is room. */
export function FactGrid({ facts }: { facts: { label: string; value: ReactNode; wide?: boolean }[] }) {
  return (
    <dl className="sp__facts">
      {facts.map((f) => (
        <div key={f.label} className={f.wide ? 'sp__fact sp__fact--wide' : 'sp__fact'}>
          <dt>{f.label}</dt><dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}
