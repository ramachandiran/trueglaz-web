import type { ItemStateTransition, NextState } from './types'

/**
 * The canonical route a unit takes from submission to the seller being paid.
 * The database holds 41 legal transitions; this is the happy path through them,
 * and it is what the timeline lays out as a line.
 */
export const HAPPY_PATH = [
  'DRAFT',
  'SUBMITTED',
  'PRE_APPROVED',
  'IN_TRANSIT_INBOUND',
  'RECEIVED',
  'IN_INSPECTION',
  'GRADED',
  'PRICE_PROPOSED',
  'LISTED',
  'RESERVED',
  'SOLD',
  'DISPATCHED',
  'DELIVERED',
  'ACCEPTED',
] as const

/**
 * States that end the journey somewhere other than a completed sale. Reaching
 * one means the rest of the happy path is no longer ahead of this item, so the
 * timeline stops projecting it and shows the real options instead.
 */
export const OFF_PATH_TERMINALS = new Set([
  'REJECTED_PRE_INTAKE',
  'INSPECTION_FAILED',
  'QUARANTINED',
  'SELLER_DECLINED',
  'RETURN_REQUESTED',
  'RETURN_TO_SELLER',
  'RETURNED',
  'UNSOLD_REVIEW',
  'ARCHIVED',
])

export const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PRE_APPROVED: 'Pre-approved',
  REJECTED_PRE_INTAKE: 'Rejected before intake',
  IN_TRANSIT_INBOUND: 'In transit',
  RECEIVED: 'Received',
  IN_INSPECTION: 'In inspection',
  GRADED: 'Graded',
  INSPECTION_FAILED: 'Inspection failed',
  QUARANTINED: 'Quarantined',
  PRICE_PROPOSED: 'Price proposed',
  AWAITING_SELLER_APPROVAL: 'Awaiting seller',
  SELLER_DECLINED: 'Seller declined',
  LISTED: 'Listed',
  RESERVED: 'Reserved',
  SOLD: 'Sold',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  ACCEPTED: 'Accepted',
  RETURN_REQUESTED: 'Return requested',
  RETURN_TO_SELLER: 'Returning to seller',
  RETURNED: 'Returned',
  UNSOLD_REVIEW: 'Unsold review',
  ARCHIVED: 'Archived',
}

export const STATE_BLURBS: Record<string, string> = {
  DRAFT: 'The seller has started a submission but not sent it.',
  SUBMITTED: 'Sent to TrueGlaz, waiting on pre-approval.',
  PRE_APPROVED: 'Inbound label issued; the ship-by clock is running.',
  IN_TRANSIT_INBOUND: 'With the courier, on its way to the hub.',
  RECEIVED: 'In TrueGlaz custody and assigned a storage bin.',
  IN_INSPECTION: 'A technician is working through the checklist.',
  GRADED: 'QC signed off on a grade by a second pair of eyes.',
  PRICE_PROPOSED: 'Priced, and the fee snapshot is taken.',
  AWAITING_SELLER_APPROVAL: 'Below the floor, downgraded, or manual pricing — the seller decides.',
  LISTED: 'Live in the catalogue and buyable.',
  RESERVED: 'A buyer is holding it through checkout.',
  SOLD: 'Paid for. The money is in escrow, not yet earned.',
  DISPATCHED: 'On its way to the buyer.',
  DELIVERED: 'Delivered; the acceptance window is open.',
  ACCEPTED: 'Revenue recognised and the seller is owed a payout.',
  QUARANTINED: 'Held back — the only way out is an admin archiving it.',
  SELLER_DECLINED: 'The seller turned down the price.',
  INSPECTION_FAILED: 'It did not pass inspection.',
}

export type StepStatus = 'done' | 'current' | 'upcoming'

export interface TimelineStep {
  state: string
  label: string
  status: StepStatus
  /** True when this state is not on the happy path but actually happened. */
  detour: boolean
  occurredAt?: string
  actorRole?: string | null
  reasonCode?: string | null
  note?: string | null
}

/**
 * Turns an item's append-only history plus its legal next moves into one line of
 * steps: what has happened, where it is now, and what is still ahead.
 *
 * History is the truth, so anything that actually happened appears even when it
 * is off the happy path. Projection stops at a terminal state, because pretending
 * a quarantined item is still on its way to ACCEPTED would be a lie.
 */
export function buildTimeline(
  history: ItemStateTransition[],
  currentState: string,
  nextLegalStates: NextState[] = [],
): TimelineStep[] {
  const visits = new Map<string, ItemStateTransition>()
  for (const h of history) {
    // The last visit wins, so a relisted item shows its most recent pass.
    visits.set(h.toState, h)
  }

  const steps: TimelineStep[] = []
  const placed = new Set<string>()

  const push = (state: string, detour: boolean) => {
    if (placed.has(state)) return
    placed.add(state)
    const visit = visits.get(state)
    const status: StepStatus =
      state === currentState ? 'current' : visit ? 'done' : 'upcoming'
    steps.push({
      state,
      label: STATE_LABELS[state] ?? state,
      status,
      detour,
      occurredAt: visit?.occurredAt,
      actorRole: visit?.actorRole,
      reasonCode: visit?.reasonCode,
      note: visit?.note,
    })
  }

  const reachedTerminal = OFF_PATH_TERMINALS.has(currentState)
  const currentIndexOnPath = HAPPY_PATH.indexOf(currentState as (typeof HAPPY_PATH)[number])

  // Walk the happy path, splicing in any real detour that happened after each step.
  for (const state of HAPPY_PATH) {
    const onPathIndex = HAPPY_PATH.indexOf(state)
    const isAhead =
      currentIndexOnPath >= 0 ? onPathIndex > currentIndexOnPath : !visits.has(state)

    // Once an item has gone off-path for good, stop projecting the rest of the route.
    if (reachedTerminal && isAhead && !visits.has(state)) continue

    push(state, false)

    // Detours recorded in history slot in right after the state they followed.
    for (const h of history) {
      if (h.fromState === state && !HAPPY_PATH.includes(h.toState as (typeof HAPPY_PATH)[number])) {
        push(h.toState, true)
      }
    }
  }

  // Anything in history we still have not placed (an unusual route) goes on in order.
  for (const h of history) {
    if (h.toState) push(h.toState, !HAPPY_PATH.includes(h.toState as (typeof HAPPY_PATH)[number]))
  }

  // At a terminal state the honest "what's next" is the legal moves, not the route.
  if (reachedTerminal) {
    for (const n of nextLegalStates) push(n.toState, true)
  }

  return steps
}

/** How far along the happy path this item is, for a progress read-out. */
export function progressOf(steps: TimelineStep[]): { done: number; total: number } {
  const total = steps.length
  const done = steps.filter((s) => s.status === 'done' || s.status === 'current').length
  return { done, total }
}
