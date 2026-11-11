import { dateOnly } from './format'
import type { OrderLineEvent } from './types'

/** Couriers we hand parcels to, by the code stored on a shipment. */
export const COURIERS: Record<string, string> = {
  bluedart: 'Blue Dart', delhivery: 'Delhivery', dtdc: 'DTDC', indiapost: 'India Post', speedpost: 'Speed Post',
  shiprocket: 'Shiprocket', xpressbees: 'Xpressbees', ekart: 'Ekart', ecomexpress: 'Ecom Express', shadowfax: 'Shadowfax',
}

/** The ones offered when dispatching, most used first. */
export const COURIER_CHOICES = ['bluedart', 'delhivery', 'dtdc', 'indiapost', 'shiprocket', 'xpressbees', 'ekart']

export function courierName(code: string | null | undefined): string | null {
  if (!code) return null
  return COURIERS[code.toLowerCase().replace(/[^a-z]/g, '')] ?? code.charAt(0).toUpperCase() + code.slice(1)
}

const REASONS: Record<string, string> = {
  not_as_described: 'not as described',
  damaged_in_transit: 'damaged in transit',
  wrong_item: 'wrong item received',
  change_of_mind: 'changed their mind',
}

const CLOSED_BY: Record<string, string> = {
  buyer_confirmed: 'Sale complete — the buyer confirmed it arrived',
  window_expired: 'Sale complete — the return window ended',
  return_declined: 'Sale complete — after the return was declined',
  return_refused: 'Sale complete — after the return was refused on inspection',
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

/** The headline for one step of an order line's history, the same on web and phone. */
export function orderEventTitle(e: OrderLineEvent): string {
  const d = e.data
  switch (e.kind) {
    case 'paid': return 'Paid'
    case 'dispatched': return `Dispatched with ${courierName(str(d.courier)) ?? 'the courier'}${str(d.tracking) ? ` · tracking ${d.tracking}` : ''}`
    case 'tracking_updated': return `Tracking number added · ${courierName(str(d.courier)) ?? ''} ${d.tracking ?? ''}`.trim()
    case 'delivered': return `Delivered${str(d.deliveredOn) ? ` on ${dateOnly(String(d.deliveredOn))}` : ''}`
    case 'return_requested': return `Return requested — ${REASONS[String(d.reason)] ?? String(d.reason ?? '')}${d.video ? ' · unboxing video attached' : ''}`
    case 'return_approved': return `Return approved${str(d.courier) ? ` · pickup by ${courierName(str(d.courier))}` : ''}${str(d.tracking) ? `, tracking ${d.tracking}` : ''}`
    case 'return_declined': return 'Return declined'
    case 'return_received': return 'Return received at TrueGlaz'
    case 'return_checked': return 'Checked by our technician'
    case 'return_refunded': return 'Return accepted — refund approved'
    case 'return_escalated': return 'Did not pass our check — passed to an admin'
    case 'return_sale_stands': return 'After review the sale stands — item sent back'
    case 'closed': return CLOSED_BY[String(d.closedBy)] ?? 'Sale complete'
    default: return e.kind.replace(/_/g, ' ')
  }
}

/** good | bad | warn | plain, for the dot beside a step. */
export function orderEventTone(kind: string): 'good' | 'bad' | 'warn' | 'plain' {
  if (kind === 'return_declined' || kind === 'return_escalated') return 'bad'
  if (kind === 'return_refunded' || kind === 'closed' || kind === 'delivered') return 'good'
  if (kind === 'return_requested') return 'warn'
  return 'plain'
}
