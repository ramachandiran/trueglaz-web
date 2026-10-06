import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ApiError, STATE_LABELS, type ReasonCode } from '@trueglaz/core'
import { runMove, type Planned } from './NextActions'
import { StateBadge } from './ui'
import './StateMenu.css'

/**
 * The status chip, as a control.
 *
 * Moving an item used to mean opening its record, reading the timeline and
 * pressing one of a row of buttons. On a list of sixty items that is the wrong
 * shape: the state is already on the row, and the question a staff member has
 * while looking at it is "move this one on". So the chip opens, the way a
 * ticket's status does, and the move happens from the list.
 *
 * Every move is confirmed, never fired from the menu directly. A state change
 * is logged against the item for good with the person's name on it, some of
 * them are not reversible, and a mis-click one row down should not be able to
 * quarantine somebody's lens. The dialog is also the only sensible place to put
 * the note, which the endpoint has always accepted and almost nobody has sent.
 */
export function StateMenu({
  itemId, sku, gear, currentState, moves, reasons, onDone,
}: {
  itemId: string
  sku: string
  gear: string
  currentState: string
  /** Already planned by the caller, so the rules live in one place. */
  moves: Planned[]
  reasons: ReasonCode[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const [chosen, setChosen] = useState<Planned | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const firstField = useRef<HTMLSelectElement | HTMLTextAreaElement>(null)
  const titleId = useId()

  // Forward moves first, corrections after a rule. Same order every row, so the
  // thing you press most is never in a different place on the next line.
  const onward = moves.filter((m) => !m.state.isReversal)
  const back = moves.filter((m) => m.state.isReversal)

  function place() {
    const r = trigger.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(12, Math.min(r.right - 280, window.innerWidth - 292))
    // Below unless there is no room, in which case above — a menu that opens
    // off the bottom of a long table is a menu nobody can use.
    setAt(window.innerHeight - r.bottom < 240
      ? { left, bottom: window.innerHeight - r.top + 6 }
      : { left, top: r.bottom + 6 })
  }

  function show() { place(); setOpen(true) }

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (menu.current?.contains(e.target as Node)) return
      if (trigger.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    // The menu is positioned against the viewport, so anything that moves the
    // row underneath it closes it rather than leaving it floating.
    const gone = () => setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', gone, true)
    window.addEventListener('resize', gone)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', gone, true)
      window.removeEventListener('resize', gone)
    }
  }, [open])

  useEffect(() => {
    if (!chosen) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) close() }
    document.addEventListener('keydown', key)
    firstField.current?.focus()
    return () => document.removeEventListener('keydown', key)
  }, [chosen, busy])

  function pick(m: Planned) {
    setOpen(false)
    setChosen(m)
    setReason('')
    setNote('')
    setError(null)
  }

  function close() {
    setChosen(null); setReason(''); setNote(''); setError(null)
    trigger.current?.focus()
  }

  async function confirm() {
    if (!chosen) return
    setBusy(true); setError(null)
    try {
      await runMove(itemId, currentState, chosen.state.toState, reason || null, note.trim() || null)
      close()
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That move did not go through')
    } finally {
      setBusy(false)
    }
  }

  const name = (m: Planned) => STATE_LABELS[m.state.toState] ?? m.state.toState

  if (moves.length === 0) {
    return (
      <span className="sm">
        <StateBadge state={currentState} />
        <span className="sm__end tg-muted">End of the line</span>
      </span>
    )
  }

  const needsReason = chosen?.state.requiresReason ?? false
  const needsNote = chosen?.state.requiresNote ?? false
  const shortNote = note.trim().length < 10

  return (
    <span className="sm">
      <button
        ref={trigger}
        type="button"
        className="sm__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Status ${STATE_LABELS[currentState] ?? currentState}. Change it.`}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <StateBadge state={currentState} />
        <span className="sm__caret" aria-hidden="true">▾</span>
      </button>

      {open && at && createPortal(
        <div
          ref={menu}
          className="sm__menu"
          role="menu"
          style={{ left: at.left, top: at.top, bottom: at.bottom }}
        >
          <p className="sm__head">Move this item to…</p>
          {onward.map((m) => <Row key={m.state.toState} m={m} name={name(m)} onPick={pick} />)}
          {back.length > 0 && <p className="sm__head sm__head--back">Put it back</p>}
          {back.map((m) => <Row key={m.state.toState} m={m} name={name(m)} onPick={pick} />)}
        </div>,
        document.body,
      )}

      {chosen && createPortal(
        <div className="sm__scrim" onMouseDown={() => !busy && close()}>
          <div
            className={`sm__dialog${chosen.state.isReversal ? ' sm__dialog--undo' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="sm__title" id={titleId}>
              Move {sku} to {name(chosen)}?
            </h2>
            <p className="sm__gear tg-muted">{gear}</p>

            <p className="sm__flow">
              <StateBadge state={currentState} />
              <span className="sm__arrow" aria-hidden="true">→</span>
              <StateBadge state={chosen.state.toState} />
            </p>

            {chosen.hint && <p className="sm__hint tg-muted">{chosen.hint}</p>}
            {chosen.state.isReversal && (
              <p className="sm__warn">
                This puts the item back a step. It stays on the record with your
                name and the time, so say what happened.
              </p>
            )}

            {chosen.state.requiresReason && (
              <label className="sm__field">
                <span className="sm__label">Reason</span>
                <select
                  ref={firstField as React.RefObject<HTMLSelectElement>}
                  className="tg-select"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Pick a reason…</option>
                  {reasons.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </label>
            )}

            <label className="sm__field">
              <span className="sm__label">
                Notes {needsNote ? <em>required</em> : <em>optional</em>}
              </span>
              <textarea
                ref={!chosen.state.requiresReason
                  ? (firstField as React.RefObject<HTMLTextAreaElement>)
                  : undefined}
                className="tg-input sm__note"
                rows={3}
                value={note}
                placeholder="What happened, in a sentence"
                onChange={(e) => setNote(e.target.value)}
              />
              <span className="sm__help tg-muted">
                {needsNote && shortNote
                  ? 'At least ten characters — the server asks for a real sentence.'
                  : 'Kept on the item’s record for good, with your name and the time.'}
              </span>
            </label>

            {error && <p className="sm__error" role="alert">{error}</p>}

            <div className="sm__buttons">
              <button type="button" className="tg-button" disabled={busy} onClick={close}>
                Cancel
              </button>
              <button
                type="button"
                className="tg-button tg-button--primary"
                /* The server demands ten characters when a note is required;
                   refusing here saves a round trip that comes back as a 409 the
                   person can do nothing useful with. */
                disabled={busy || (needsReason && !reason) || (needsNote && shortNote)}
                onClick={confirm}
              >
                {busy ? 'Moving…' : `Move to ${name(chosen)}`}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}

/** One line in the menu: a move, a link somewhere else, or a greyed reason why not. */
function Row({ m, name, onPick }: { m: Planned; name: string; onPick: (m: Planned) => void }) {
  if (m.mode === 'go') {
    return (
      <Link role="menuitem" className="sm__item" to={m.to!}>
        <span className="sm__item-name">{name}</span>
        <span className="sm__item-why tg-muted">{m.hint ?? 'Done on another screen'}</span>
        <span className="sm__item-go" aria-hidden="true">→</span>
      </Link>
    )
  }
  if (m.mode === 'act') {
    return (
      <button type="button" role="menuitem" className="sm__item" onClick={() => onPick(m)}>
        <span className="sm__item-name">{name}</span>
        {m.hint && <span className="sm__item-why tg-muted">{m.hint}</span>}
      </button>
    )
  }
  return (
    <span role="menuitem" aria-disabled="true" className="sm__item sm__item--off">
      <span className="sm__item-name">{name}</span>
      <span className="sm__item-why tg-muted">{m.note}</span>
    </span>
  )
}
