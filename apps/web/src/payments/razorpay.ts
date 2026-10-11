import type { RazorpayCheckout } from '@trueglaz/core'

/**
 * Razorpay Standard Checkout, loaded on demand.
 *
 * The script is Razorpay's own and is only fetched when someone actually pays,
 * so nobody browsing the shop downloads a payment SDK. Card numbers, bank
 * logins and UPI approvals all happen inside Razorpay's modal; this page only
 * ever sees the three fields Razorpay hands back, and the API checks those
 * against Razorpay before anything is booked.
 */
const SRC = 'https://checkout.razorpay.com/v1/checkout.js'

export interface RazorpaySuccess {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

interface RazorpayFailure { error?: { description?: string; reason?: string } }

interface RazorpayInstance {
  open(): void
  on(event: 'payment.failed', fn: (r: RazorpayFailure) => void): void
}

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance }
}

let loading: Promise<void> | null = null

function load(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SRC
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { loading = null; reject(new Error('Could not load the payment window. Check your connection and try again.')) }
      document.head.appendChild(s)
    })
  }
  return loading
}

/**
 * Opens Checkout for a Razorpay order the API already created. Exactly one of
 * the callbacks runs: onSuccess with Razorpay's fields, or onClose (with the
 * last failure's reason, if a payment inside the modal failed) when the buyer
 * closes the modal without paying.
 */
export async function openRazorpay(
  options: RazorpayCheckout,
  onSuccess: (r: RazorpaySuccess) => void,
  onClose: (lastFailure: string | null) => void,
): Promise<void> {
  await load()
  if (!window.Razorpay) throw new Error('The payment window did not load')
  let lastFailure: string | null = null
  const { kind: _kind, ...rest } = options
  const rzp = new window.Razorpay({
    ...rest,
    // A failed attempt stays inside the modal and can be retried there, on the
    // same Razorpay order (which Razorpay refuses to take a second payment on).
    retry: { enabled: true },
    handler: onSuccess,
    modal: {
      confirm_close: true,
      ondismiss: () => onClose(lastFailure),
    },
  })
  rzp.on('payment.failed', (r) => { lastFailure = r.error?.description ?? 'The payment did not go through' })
  rzp.open()
}
