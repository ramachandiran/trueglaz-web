import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api, ApiError, isAdmin, isOps, isStaff, isTechnician, STATE_LABELS, useApi, useSession,
  type NextState, type Session,
} from '@trueglaz/core'
import './NextActions.css'

type Target =
  /** A button here makes the whole move. */
  | { kind: 'do'; run: (itemId: string, reasonCode: string | null) => Promise<unknown> }
  /** The move belongs to a dedicated screen — send them there rather than fake it. */
  | { kind: 'go'; to: (itemId: string) => string }
  /** Nobody presses this; it follows from something else happening. */
  | { kind: 'automatic'; because: string }
  /** Legal, but no screen here makes it safely — say so rather than offer a button. */
  | { kind: 'elsewhere'; where: string }

interface Recipe {
  label: string
  hint?: string
  target: Target
  /** Where to go when the one-click version cannot do it — a price that needs overriding. */
  fallback?: { label: string; to: string }
}

/**
 * How each legal move is actually made, keyed by `FROM>TO`.
 *
 * The transition rules say a move is legal and who may make it; they do not say
 * how, and the same destination is different work depending on where the item
 * starts. LISTED reached by pricing an item creates the catalogue row; LISTED
 * reached by cancelling a paid order owes the buyer a refund. So the key is the
 * pair, not the destination.
 *
 * Anything with a dedicated endpoint routes to the screen that owns it, because
 * the raw transition would move the state and skip the bookkeeping — an item in
 * LISTED with no listing row is invisible in the catalogue and unbuyable.
 */
const RECIPES: Record<string, Recipe> = {
  'DRAFT>SUBMITTED': {
    label: 'Finish the submission',
    hint: 'The seller sends it from their own submission.',
    target: { kind: 'go', to: () => '/sell/manage' },
  },
  'SUBMITTED>PRE_APPROVED': {
    label: 'Pre-approve and issue a label',
    hint: 'Issues the inbound label and starts the ship-by clock.',
    target: { kind: 'go', to: () => '/ops' },
  },
  'SUBMITTED>REJECTED_PRE_INTAKE': {
    label: 'Reject before intake',
    hint: 'Needs a templated reason, which the seller is shown.',
    target: { kind: 'go', to: () => '/ops' },
  },
  'IN_TRANSIT_INBOUND>RECEIVED': {
    label: 'Log the intake',
    hint: 'Records what actually arrived and assigns a storage bin.',
    target: { kind: 'go', to: () => '/ops' },
  },
  'RECEIVED>IN_INSPECTION': {
    label: 'Start the inspection',
    hint: 'Opens the checklist and pins the version used.',
    target: { kind: 'go', to: (id) => `/ops/inspect/${id}` },
  },
  'IN_INSPECTION>GRADED': {
    label: 'Finish grading',
    hint: 'Submit the report, then a second pair of eyes signs it off.',
    target: { kind: 'go', to: (id) => `/ops/inspect/${id}` },
  },
  'IN_INSPECTION>INSPECTION_FAILED': {
    label: 'Fail the inspection',
    hint: 'Recorded as the QC outcome on the report, not as a bare state change.',
    target: { kind: 'go', to: (id) => `/ops/inspect/${id}` },
  },
  'IN_INSPECTION>QUARANTINED': {
    label: 'Quarantine',
    hint: 'Recorded as the QC outcome. The only way out afterwards is an admin archiving it.',
    target: { kind: 'go', to: (id) => `/ops/inspect/${id}` },
  },
  'GRADED>PRICE_PROPOSED': {
    label: 'Propose a price',
    hint: 'Uses the guided price, and takes the fee snapshot the payout is computed from.',
    target: { kind: 'do', run: (id) => api.propose(id, {}) },
    // Guided pricing needs a reference price for this model and grade. When
    // there is none the only way through is a staff amount with a reason, and
    // the pricing queue is the screen with that form.
    fallback: { label: 'Price it by hand in the queue', to: '/ops' },
  },
  'PRICE_PROPOSED>LISTED': {
    label: 'Price and list',
    hint: 'Listing happens as part of pricing — it is what creates the catalogue row.',
    target: { kind: 'do', run: (id) => api.propose(id, {}) },
  },
  'AWAITING_SELLER_APPROVAL>LISTED': {
    label: 'The seller accepts the price',
    hint: 'Only the seller can accept, from their own Selling page.',
    target: { kind: 'go', to: () => '/sell/manage' },
  },
  'AWAITING_SELLER_APPROVAL>SELLER_DECLINED': {
    label: 'The seller declines',
    hint: 'Only the seller can decline, from their own Selling page.',
    target: { kind: 'go', to: () => '/sell/manage' },
  },
  'SOLD>DISPATCHED': {
    label: 'Pack and dispatch',
    hint: 'Dispatch is recorded against the order line, in fulfilment.',
    target: { kind: 'go', to: () => '/fulfilment' },
  },
  'DISPATCHED>DELIVERED': {
    label: 'Mark delivered',
    hint: 'The delivery scan opens the buyer’s acceptance window.',
    target: { kind: 'go', to: () => '/fulfilment' },
  },
  'SOLD>LISTED': {
    label: 'Cancel before dispatch',
    hint: 'A paid order has to be refunded as well as relisted, which no screen does yet.',
    target: { kind: 'elsewhere', where: 'not available here — it owes the buyer a refund' },
  },
  'UNSOLD_REVIEW>LISTED': {
    label: 'Relist after a price drop',
    hint: 'Relisting has to publish a fresh catalogue row, which pricing does.',
    target: { kind: 'elsewhere', where: 'done by proposing a new price' },
  },
  'DELIVERED>ACCEPTED': {
    label: 'Accepted',
    target: { kind: 'automatic', because: 'the buyer confirms, or the acceptance window expires' },
  },
  'DELIVERED>RETURN_REQUESTED': {
    label: 'Return requested',
    target: { kind: 'automatic', because: 'the buyer raises a return inside the window' },
  },
}

/**
 * Moves that are nothing but a state change, so a raw transition is the whole
 * job. Everything else either routes to a screen above or says where it is done:
 * the /transition endpoint is the escape hatch for ops states with no screen,
 * and using it anywhere else would quietly skip somebody's money.
 */
const RAW_SAFE = new Set([
  'RETURN_TO_SELLER',
  'RETURN_IN_TRANSIT',
  'RETURN_RECEIVED',
  'RE_INSPECTION',
  'RELISTED',
  'RETURN_REJECTED',
  'ARCHIVED',
])

/**
 * The buttons that turn "what can happen next" into something a person can do.
 *
 * It sits under the timeline deliberately: the line says where the item is, and
 * the move out of that state is the only question anyone has while looking at it.
 *
 * Every button here is a courtesy. The database validates the move, the role and
 * the reason requirement on the way in, so hiding one a person may not press
 * saves them a refusal — it grants nobody anything.
 */
export function NextActions({
  itemId,
  currentState,
  nextLegalStates,
  onDone,
}: {
  itemId: string
  currentState: string
  nextLegalStates: NextState[]
  onDone: () => void
}) {
  const { session } = useSession()
  // Only fetched when something on offer needs one, but the list is four rows
  // and cached by the browser; asking up front keeps the confirm instant.
  const reasons = useApi(() => api.reasonCodes('item_transition'), [])

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [failedFallback, setFailedFallback] = useState<Recipe['fallback']>(undefined)

  const actions = useMemo(
    () => nextLegalStates.map((n) => planMove(n, currentState, itemId, session)),
    [nextLegalStates, currentState, itemId, session],
  )

  if (nextLegalStates.length === 0) {
    return <p className="tg-muted next__none">This item has reached the end of its journey.</p>
  }

  async function run(state: NextState, reasonCode: string | null, note: string | null) {
    setBusy(state.toState); setError(null); setFailedFallback(undefined)
    try {
      await runMove(itemId, currentState, state.toState, reasonCode, note)
      setAsking(null); setReason(''); setNote('')
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That move did not go through')
      setFailedFallback(RECIPES[`${currentState}>${state.toState}`]?.fallback)
    } finally {
      setBusy(null)
    }
  }

  const nothingToDo = actions.every((a) => a.mode === 'note')

  return (
    <div className="next">
      <div className="next__row">
        {actions.map((a) => {
          if (a.mode === 'go') {
            return (
              <Link key={a.state.toState} className="tg-button next__button" to={a.to!} title={a.hint}>
                {a.label}<span className="next__arrow" aria-hidden="true">→</span>
              </Link>
            )
          }

          if (a.mode === 'act') {
            return (
              <span key={a.state.toState} className="next__slot">
                <button
                  className={`tg-button next__button${isForward(a.state) ? ' tg-button--primary' : ''}`}
                  disabled={busy !== null}
                  title={a.hint}
                  onClick={() =>
                    a.state.requiresReason || a.state.requiresNote
                      ? setAsking(a.state.toState)
                      : run(a.state, null, null)
                  }
                >
                  {busy === a.state.toState ? 'Working…' : a.label}
                </button>

                {asking === a.state.toState && (
                  <span className={`next__reason${a.state.isReversal ? ' next__reason--undo' : ''}`}>
                    {a.state.isReversal && (
                      <span className="next__undo-head">
                        Putting this item back. Say what happened — it stays on the item's
                        record with your name and the time.
                      </span>
                    )}
                    <select
                      className="tg-select"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      aria-label={`Reason for moving to ${a.label}`}
                    >
                      <option value="">Pick a reason…</option>
                      {(reasons.data ?? []).map((r) => (
                        <option key={r.code} value={r.code}>{r.label}</option>
                      ))}
                    </select>
                    {a.state.requiresNote && (
                      <input
                        className="tg-input next__note-input"
                        value={note}
                        placeholder="What happened, in a sentence"
                        aria-label={`Note for moving to ${a.label}`}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    )}
                    <button
                      className="tg-button tg-button--primary"
                      /* The server demands ten characters; refusing here saves a
                         round trip that would come back as a 409 the person can
                         do nothing useful with. */
                      disabled={
                        busy !== null ||
                        (a.state.requiresReason && !reason) ||
                        (a.state.requiresNote && note.trim().length < 10)
                      }
                      onClick={() => run(a.state, reason || null, note.trim() || null)}
                    >
                      Confirm
                    </button>
                    <button className="tg-button" onClick={() => { setAsking(null); setReason(''); setNote('') }}>
                      Cancel
                    </button>
                  </span>
                )}
              </span>
            )
          }

          return (
            <span key={a.state.toState} className="next__note" title={a.hint}>
              <strong>{STATE_LABELS[a.state.toState] ?? a.state.toState}</strong>
              <span className="tg-muted"> · {a.note}</span>
            </span>
          )
        })}
      </div>

      {error && (
        <p className="next__error" role="alert">
          {error}
          {failedFallback && (
            <> <Link to={failedFallback.to}>{failedFallback.label}</Link>.</>
          )}
        </p>
      )}

      {nothingToDo && (
        <p className="tg-muted next__none">
          {isOps(session)
            ? 'Nothing here is yours to press — these moves follow from events elsewhere.'
            : 'Nothing here is yours to do. TrueGlaz moves it on from here, and it will show on this line when it happens.'}
        </p>
      )}
    </div>
  )
}

/**
 * Makes one move, by whichever route that particular move is made.
 *
 * The /transition endpoint is not the way most states change: pricing creates a
 * catalogue row, dispatch writes against the order line. Going through here
 * means a caller cannot accidentally take the raw route for a move that owes
 * somebody bookkeeping — the recipe decides, not the call site.
 */
export function runMove(
  itemId: string,
  currentState: string,
  toState: string,
  reasonCode: string | null,
  note: string | null,
): Promise<unknown> {
  const recipe = RECIPES[`${currentState}>${toState}`]
  if (recipe?.target.kind === 'do') return recipe.target.run(itemId, reasonCode)
  // The note was being dropped here: the column, the function, the endpoint and
  // the client all carried one, and this call passed three arguments. Every
  // staff move ever made has a null note because of it.
  return api.transitionItem(itemId, toState, reasonCode, note)
}

export interface Planned {
  state: NextState
  label: string
  hint?: string
  mode: 'go' | 'act' | 'note'
  to?: string
  note?: string
}

/**
 * Decides what, if anything, this person can do about one legal next state.
 *
 * Exported because the inventory table offers the obvious next step on each row,
 * and a second copy of these rules living there is how an item ends up LISTED
 * with no catalogue row behind it. One table of recipes, two places that read it.
 */
export function planMove(n: NextState, currentState: string, itemId: string, session: Session | null): Planned {
  const recipe = RECIPES[`${currentState}>${n.toState}`]
  const base = recipe?.label ?? STATE_LABELS[n.toState] ?? n.toState
  // An arrow rather than a sentence. "Back to " + the state label reads badly
  // for half the states ("Back to in inspection"), and rewriting each label for
  // the reversal case is a second set of names to keep in step with the first.
  const label = n.isReversal ? `← ${STATE_LABELS[n.toState] ?? n.toState}` : base
  const hint = recipe?.hint ?? n.notes ?? undefined
  const note = (text: string): Planned => ({ state: n, label, hint, mode: 'note', note: text })

  if (recipe?.target.kind === 'automatic') return note(`happens when ${recipe.target.because}`)
  if (recipe?.target.kind === 'elsewhere') return note(recipe.target.where)

  const roles = n.allowedRoles
  if (roles.length === 1 && roles[0] === 'System') return note('the system does this')

  // Any one of the rule's roles is enough — a technician may take a move listed
  // for Technician even when Staff is also on it. Admin holds every role, which
  // `isStaff`/`isTechnician` already account for, so an Admin-only rule (leaving
  // quarantine) still comes out admin-only.
  const allowed = roles.some((r) => (
    r === 'Admin' ? isAdmin(session)
      : r === 'Staff' ? isStaff(session)
        : r === 'Technician' ? isTechnician(session)
          : false
  ))

  if (!allowed) {
    return note(roles.includes('User') ? 'the seller decides this' : `${roles.join(' or ')} only`)
  }

  if (recipe?.target.kind === 'go') {
    return { state: n, label, hint, mode: 'go', to: recipe.target.to(itemId) }
  }
  if (recipe?.target.kind === 'do') return { state: n, label, hint, mode: 'act' }

  // No recipe: only offer it when the state change really is the whole job.
  //
  // A reversal always is, by construction. RAW_SAFE lists target states that
  // carry no bookkeeping, which cannot classify a reversal — IN_INSPECTION is
  // raw-safe when you are putting an item back and emphatically not when you
  // are starting an inspection. The rule knows which of the two this is, and
  // the server does the one piece of bookkeeping a reversal needs (pulling the
  // listing when a live item is withdrawn).
  return RAW_SAFE.has(n.toState) || n.isReversal
    ? { state: n, label, hint, mode: 'act' }
    : note('not available from this screen')
}

/**
 * Continuing the journey reads as the default; ending it should not, and
 * undoing it certainly should not — a correction must never be the primary
 * button on the row.
 */
export function isForward(state: NextState): boolean {
  if (state.isReversal) return false
  return !['INSPECTION_FAILED', 'QUARANTINED', 'RETURN_TO_SELLER', 'ARCHIVED', 'SELLER_DECLINED', 'RETURN_REJECTED'].includes(state.toState)
}
