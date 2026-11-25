import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
  open, title, children, confirmLabel, busy = false, destructive = false, cancelLabel = 'Cancel', onConfirm, onCancel,
  confirmDisabled = false, error = null, wide = false,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  /** Deleting or removing: the confirm button is solid red with cream words. */
  destructive?: boolean
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  /** Hold the confirm button until the form is complete (TG-210). */
  confirmDisabled?: boolean
  /** What went wrong, shown above the buttons. */
  error?: string | null
  /** A form rather than a question: more room. */
  wide?: boolean
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
      className={`confirm tg-card${wide ? ' confirm--wide' : ''}`}
      aria-labelledby="confirm-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel() }}
    >
      <h2 id="confirm-title" className="confirm__title">{title}</h2>
      <div className="confirm__body">{children}</div>
      {error && <p className="confirm__error" role="alert">{error}</p>}
      <div className="confirm__actions">
        <button type="button" className="tg-button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button type="button" className={`tg-button ${destructive ? 'tg-button--danger' : 'tg-button--primary'}`}
          onClick={onConfirm} disabled={busy || confirmDisabled} aria-busy={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

export interface ConfirmAsk {
  title: string
  body: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
}

/**
 * The browser's own confirm(), but ours (TG-152): `await ask({...})` resolves
 * true or false, and `dialog` is rendered once in the component. The browser
 * popup could only say "OK", looked like a security warning, and could be
 * switched off for the page by a checkbox.
 */
export function useConfirm(): { ask: (a: ConfirmAsk) => Promise<boolean>; dialog: ReactNode } {
  const [pending, setPending] = useState<(ConfirmAsk & { resolve: (ok: boolean) => void }) | null>(null)
  const ask = useCallback((a: ConfirmAsk) => new Promise<boolean>((resolve) => setPending({ ...a, resolve })), [])
  const close = (ok: boolean) => { pending?.resolve(ok); setPending(null) }
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      title={pending?.title ?? ''}
      confirmLabel={pending?.confirmLabel ?? 'OK'}
      cancelLabel={pending?.cancelLabel}
      destructive={pending?.destructive}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    >
      {pending?.body}
    </ConfirmDialog>
  )
  return { ask, dialog }
}
