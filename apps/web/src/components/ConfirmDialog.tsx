import { useEffect, useRef, type ReactNode } from 'react'
import './ConfirmDialog.css'

/**
 * A confirmation that names what is about to happen.
 *
 * Built on the native <dialog> opened with showModal(): the browser traps
 * focus inside it, Esc closes it, the rest of the page is inert, and focus goes
 * back to the button that opened it on close. The title names the thing, the
 * body states the consequence, and the confirm button is a verb, never "OK".
 */
export function ConfirmDialog({
  open, title, children, confirmLabel, busy = false, onConfirm, onCancel,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="confirm tg-card"
      aria-labelledby="confirm-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel() }}
    >
      <h2 id="confirm-title" className="confirm__title">{title}</h2>
      <div className="confirm__body">{children}</div>
      <div className="confirm__actions">
        <button type="button" className="tg-button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="tg-button tg-button--primary" onClick={onConfirm} disabled={busy} aria-busy={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
