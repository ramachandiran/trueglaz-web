import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, money, useApi, useSession, type Address } from '@trueglaz/core'
import { ErrorNote, GradeBadge, Loading } from '../components/ui'
import './CheckoutPage.css'

const SHIPPING_MINOR = 40000

type Step = 'address' | 'pay' | 'done'

/**
 * Reserve -> checkout -> pay, on one page.
 *
 * The hold is created when the page opens and released if the buyer leaves
 * without ordering: an abandoned reservation blocks the item for everyone else
 * until it lapses, so it is worth giving back promptly rather than waiting for
 * the sweep.
 */
export function CheckoutPage() {
  const { listingId = '' } = useParams()
  const nav = useNavigate()
  const { session } = useSession()

  const listing = useApi(() => api.listing(listingId), [listingId])

  const [reservationId, setReservationId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('address')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  const [address, setAddress] = useState({
    recipientName: session?.displayName ?? '',
    line1: '', line2: '', city: '', state: '', pincode: '', countryCode: 'IN',
  })

  // Saved addresses, so a returning buyer is not retyping their own street.
  const saved = useApi(() => api.myAddresses(), [])
  const [pickedAddressId, setPickedAddressId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  // The default fills the form once, and only while the person has not started
  // typing — overwriting what someone is in the middle of entering would be
  // worse than an empty form.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || saved.loading) return
    const fallback = saved.data?.find((a) => a.isDefault) ?? saved.data?.[0]
    if (!fallback) return
    prefilled.current = true
    setPickedAddressId(fallback.id)
    setAddress((current) => (current.line1 ? current : fromSaved(fallback)))
  }, [saved.loading, saved.data])

  // Hold the item as soon as the page opens.
  //
  // React runs mount effects twice in development, so the request is fired once
  // via a ref. The result is then applied unconditionally: discarding it on the
  // first mount's teardown would leave the second mount waiting for a request it
  // never made, and the page stuck on "Working…".
  const reserving = useRef(false)
  useEffect(() => {
    if (reserving.current) return
    reserving.current = true
    setBusy(true)
    api.reserve(listingId)
      .then((r) => {
        setReservationId(r.id)
        setExpiresAt(r.expiresAt)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }, [listingId])

  // Give the hold back if they leave before ordering.
  //
  // Deliberately keyed on nothing: listing these as dependencies would run the
  // cleanup every time they change, and the moment an order is created that
  // cleanup still carries the old "no order yet" values — releasing the very
  // reservation that just became an order. A ref keeps the latest values so the
  // release happens once, on the way out.
  const held = useRef<{ reservationId: string | null; orderId: string | null }>({
    reservationId: null, orderId: null,
  })
  held.current = { reservationId, orderId }

  useEffect(() => {
    return () => {
      const { reservationId: rid, orderId: oid } = held.current
      if (rid && !oid) void api.releaseReservation(rid).catch(() => {})
    }
  }, [])

  const total = useMemo(
    () => (listing.data ? listing.data.listing.priceMinor + SHIPPING_MINOR : 0),
    [listing.data],
  )

  async function placeOrder() {
    if (!reservationId) return
    setBusy(true); setError(null)
    try {
      const order = await api.checkout(reservationId, address)
      setOrderId(order.id)
      setStep('pay')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not place the order')
    } finally {
      setBusy(false)
    }
  }

  async function payNow() {
    if (!orderId) return
    setBusy(true); setError(null)
    try {
      // No gateway is integrated yet; this stands in for the redirect and the
      // callback that would normally capture the payment.
      await api.pay(orderId, {
        gateway: 'razorpay',
        gatewayRef: `pay_${orderId.slice(0, 8)}`,
        method: 'upi',
        idempotencyKey: `checkout-${orderId}`,
        gatewayFeeMinor: Math.round(total * 0.02),
      })
      setStep('done')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  if (listing.loading) return <Loading label="Loading checkout" />
  if (listing.error) return <ErrorNote error={listing.error} onRetry={listing.reload} />
  if (!listing.data) return null
  const d = listing.data

  const addressValid = address.recipientName && address.line1 && address.city && address.pincode
  const hasSaved = (saved.data?.length ?? 0) > 0

  return (
    <div className="checkout">
      <div className="checkout__main">
        <ol className="checkout__steps" aria-label="Checkout progress">
          {(['address', 'pay', 'done'] as Step[]).map((s, i) => (
            <li
              key={s}
              className={`checkout__step${step === s ? ' checkout__step--current' : ''}${
                (['address', 'pay', 'done'] as Step[]).indexOf(step) > i ? ' checkout__step--done' : ''
              }`}
            >
              {s === 'address' ? 'Delivery' : s === 'pay' ? 'Payment' : 'Confirmed'}
            </li>
          ))}
        </ol>

        {error && (
          <div className="checkout__error tg-card" role="alert">
            {error}
          </div>
        )}

        {step === 'address' && (
          <section className="tg-card checkout__panel">
            <h2 className="checkout__heading">Where should it go?</h2>
            <p className="tg-muted checkout__note">
              The address is copied onto the order, not linked — editing it later
              never rewrites an order already placed.
            </p>

            {hasSaved && !editing && (
              <div className="checkout__saved">
                {(saved.data ?? []).map((a) => (
                  <label key={a.id} className={`checkout__saved-option${pickedAddressId === a.id ? ' checkout__saved-option--picked' : ''}`}>
                    <input
                      type="radio"
                      name="saved-address"
                      checked={pickedAddressId === a.id}
                      onChange={() => { setPickedAddressId(a.id); setAddress(fromSaved(a)) }}
                    />
                    <span>
                      <strong>{a.label || a.recipientName}</strong>
                      {a.isDefault && <span className="tg-badge tg-badge--good checkout__saved-default">Default</span>}
                      <span className="tg-muted checkout__saved-body">
                        {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city} {a.pincode}
                      </span>
                    </span>
                  </label>
                ))}
                <div>
                  <button className="tg-button tg-button--subtle" onClick={() => { setEditing(true); setPickedAddressId(null) }}>
                    Send it somewhere else
                  </button>
                </div>
              </div>
            )}

            {(!hasSaved || editing) && (
            <div className="checkout__grid">
              <Field label="Recipient" value={address.recipientName} onChange={(v) => setAddress({ ...address, recipientName: v })} required />
              <Field label="Address line 1" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} required wide />
              <Field label="Address line 2" value={address.line2} onChange={(v) => setAddress({ ...address, line2: v })} wide />
              <Field label="City" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} required />
              <Field label="State" value={address.state} onChange={(v) => setAddress({ ...address, state: v })} />
              <Field label="PIN code" value={address.pincode} onChange={(v) => setAddress({ ...address, pincode: v })} required />
            </div>
            )}
            {!hasSaved && (
              <p className="tg-muted checkout__note">
                Save this one to <Link to="/profile#addresses">your addresses</Link> to skip
                typing it next time.
              </p>
            )}
            <button
              className="tg-button tg-button--primary checkout__cta"
              disabled={busy || !addressValid || !reservationId}
              onClick={placeOrder}
            >
              {busy ? 'Working…' : 'Continue to payment'}
            </button>
          </section>
        )}

        {step === 'pay' && (
          <section className="tg-card checkout__panel">
            <h2 className="checkout__heading">Payment</h2>
            <p className="tg-muted checkout__note">
              Your money is held in escrow. Nothing reaches the seller until you
              have the item and accept it.
            </p>
            <button className="tg-button tg-button--primary checkout__cta" disabled={busy} onClick={payNow}>
              {busy ? 'Processing…' : `Pay ${money(total)}`}
            </button>
          </section>
        )}

        {step === 'done' && (
          <section className="tg-card checkout__panel checkout__panel--done">
            <h2 className="checkout__heading">Order confirmed</h2>
            <p className="tg-muted checkout__note">
              We'll dispatch it shortly. When it arrives you have a few days to
              accept — that is the moment the seller gets paid.
            </p>
            <div className="checkout__actions">
              <button className="tg-button tg-button--primary" onClick={() => nav('/orders')}>
                View my orders
              </button>
              <button className="tg-button" onClick={() => nav('/')}>Keep browsing</button>
            </div>
          </section>
        )}
      </div>

      <aside className="checkout__summary tg-card">
        <h2 className="checkout__heading">{d.listing.title.split('·')[0].trim()}</h2>
        <div className="checkout__badges">
          <GradeBadge code={d.listing.gradeCode} />
          {d.gradeLabel && <span className="tg-badge">{d.gradeLabel}</span>}
        </div>
        <dl className="checkout__lines">
          <div><dt>Item</dt><dd>{money(d.listing.priceMinor)}</dd></div>
          <div><dt>Shipping</dt><dd>{money(SHIPPING_MINOR)}</dd></div>
          <div className="checkout__total"><dt>Total</dt><dd>{money(total)}</dd></div>
        </dl>
        {expiresAt && step !== 'done' && (
          <p className="checkout__hold tg-muted">
            Held for you until {new Date(expiresAt).toLocaleTimeString()}
          </p>
        )}
        {d.defects.length > 0 && (
          <div className="checkout__defects">
            <h3 className="checkout__subheading">Disclosed</h3>
            <ul>
              {d.defects.map((x) => <li key={x.id}>{x.title}</li>)}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}

function Field({
  label, value, onChange, required, wide,
}: { label: string; value: string; onChange: (v: string) => void; required?: boolean; wide?: boolean }) {
  return (
    <label className={`checkout__field${wide ? ' checkout__field--wide' : ''}`}>
      <span className="checkout__field-label">
        {label}{required && <span aria-hidden="true"> *</span>}
      </span>
      <input className="tg-input" value={value} required={required} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/** A saved address in the shape the order snapshot wants. */
function fromSaved(a: Address) {
  return {
    recipientName: a.recipientName,
    line1: a.line1,
    line2: a.line2 ?? '',
    city: a.city,
    state: a.state ?? '',
    pincode: a.pincode,
    countryCode: a.countryCode ?? 'IN',
  }
}
