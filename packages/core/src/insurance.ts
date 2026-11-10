import type { InsuranceRequest, InsuranceStatus } from './types'
import { dateOnly } from './format'

/** The four steps the owner sees on a vault card. */
export const INSURANCE_STEPS = ['Requested', 'With agent', 'Quote to you', 'Policy added'] as const

/** How far along the steps a request is (0-based; 4 = insured). */
export function insuranceStep(status: InsuranceStatus): number {
  switch (status) {
    case 'requested': return 0
    case 'with_agent': return 1
    case 'quote_shared': return 2
    case 'policy_uploaded': return 3
    case 'insured': return 4
    default: return -1
  }
}

export type Tone = 'warn' | 'good' | 'info' | 'bad'

/** What an open request means to its owner, in a few words, plus the next step. */
export function insuranceOwnerStatus(r: InsuranceRequest): { label: string; tone: Tone; hint: string } {
  if (r.reuploadReason) return { label: 'Upload the policy again', tone: 'bad', hint: r.reuploadReason }
  switch (r.status) {
    case 'requested':
    case 'with_agent':
      return { label: 'Quote requested', tone: 'warn', hint: r.replyBy ? `An agent calls you by ${dayName(r.replyBy)}` : 'An agent will call you' }
    case 'quote_shared':
      return { label: 'Quote with you', tone: 'info', hint: 'Bought the cover? Add the policy here.' }
    case 'policy_uploaded':
      return { label: 'Checking your policy', tone: 'info', hint: 'We check it within a working day.' }
    case 'insured':
      return { label: 'Insured', tone: 'good', hint: '' }
    default:
      return { label: 'Closed', tone: 'bad', hint: r.closedReason ?? '' }
  }
}

export const CALL_TIMES = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
] as const

/** "Fri 13 Nov". */
export function dayName(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return dateOnly(iso)
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}

/** What the suggested cover amount is based on, in words. */
export function coverBasisText(basis: string): string {
  switch (basis) {
    case 'new_price': return 'Price of a new one today'
    case 'paid': return 'What you paid'
    case 'estimate': return 'Our top estimate'
    default: return 'Cover amount'
  }
}
