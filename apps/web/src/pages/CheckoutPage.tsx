import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  api, ApiError, money, useApi, useSession,
  type Address, type Order, type PaymentMethod, type PaymentPreference,
} from '@trueglaz/core'
import { ErrorNote, GradeBadge, Loading } from '../components/ui'
import { openRazorpay, type RazorpaySuccess } from '../payments/razorpay'
import './CheckoutPage.css'

const SHIPPING_MINOR = 40000

type Step = 'delivery' | 'payment' | 'review' | 'done'
const STEPS: { key: Exclude<Step, 'done'>; label: string }[] = [
  { key: 'delivery', label: 'Delivery' },
  { key: 'payment', label: 'Payment' },
  { key: 'review', label: 'Review & pay' },
]

type Addr = {
  recipientName: string; line1: string; line2: string; city: string; state: string; pincode: string; phone: string
}
const EMPTY: Addr = { recipientName: '', line1: '', line2: '', city: '', state: '', pincode: '', phone: '' }

/** Which address the buyer is working with: one of their saved ones, one being edited, or a new one. */
type Mode = { kind: 'saved'; id: string } | { kind: 'edit'; id: string } | { kind: 'new' }

type Pay = { method: PaymentMethod | null; upiMode: 'id' | 'app'; vpa: string; bank: string }

/**
 * Checkout, as a wizard: delivery → payment → review & pay.
 *
 * The buyer can walk back and forth freely, with the step buttons, the Back
 * buttons or the browser's own back button (the step lives in the URL). The
 * order itself is only created on the way into Review, so the first two steps
 * cost nothing to change; after that, changing the address updates the unpaid
 * order rather than starting again, and changing the method updates the open
 * payment rather than opening a second one.
 *
 * Card details are never typed here. The method is chosen here and the card
 * itself is entered on the gateway's own page — which keeps card numbers out
 * of our servers, our logs and our audit scope entirely.
 *
 * The hold is created when the page opens and released if the buyer leaves
 * without ordering: an abandoned reservation blocks the item for everyone else
 * until it lapses.
 */
export function CheckoutPage() {
  const { listingId = '' } = useParams()
  const nav = useNavigate()
  const { session } = useSession()
  const [params, setParams] = useSearchParams()

  const listing = useApi(() => api.listing(listingId), [listingId])
  const saved = useApi(() => api.myAddresses(), [])
  const methods = useApi(() => api.paymentMethods(), [])
  const meta = useApi(() => api.meta(), [])

  const [reservationId, setReservationId] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [paid, setPaid] = useState(false)
  const [resumed, setResumed] = useState<string | null>(null) // the order number picked back up, if any
  const resumedAddr = useRef<Addr | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // -- delivery state ------------------------------------------------------
  const [mode, setMode] = useState<Mode>({ kind: 'new' })
  const [address, setAddress] = useState<Addr>({ ...EMPTY, recipientName: session?.displayName ?? '' })
  const [keep, setKeep] = useState(true) // save the new address / update the saved one
  const [touched, setTouched] = useState(false)
  const sentToOrder = useRef<string | null>(null) // the address the order currently carries

  // -- payment state -------------------------------------------------------
  const [pay, setPay] = useState<Pay>({ method: null, upiMode: 'app', vpa: '', bank: '' })
  const [gateway, setGateway] = useState(false) // the demo gateway panel is open

  // The furthest step reached, so the stepper only offers steps already earned.
  const [reached, setReached] = useState(0)

  // The step is in the URL so the browser's back button walks the wizard.
  const asked = (params.get('step') as Step | null) ?? 'delivery'
  const addressOk = validAddress(address) === null
  const payOk = validPay(pay) === null
  const step: Step = paid ? 'done'
    : asked === 'review' && order && addressOk && payOk ? 'review'
      : (asked === 'payment' || asked === 'review') && addressOk ? 'payment'
        : 'delivery'
  const stepIndex = step === 'done' ? 3 : STEPS.findIndex((s) => s.key === step)

  function go(next: Step, replace = false) {
    setError(null)
    setParams(next === 'delivery' ? {} : { step: next }, { replace })
    setReached((r) => Math.max(r, next === 'done' ? 3 : STEPS.findIndex((s) => s.key === next)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // A deep link or a reload onto a later step with nothing filled in lands back on Delivery.
  useEffect(() => {
    if (!paid && asked !== step && asked !== 'delivery') setParams(step === 'delivery' ? {} : { step }, { replace: true })
  }, [asked, step, paid]) // eslint-disable-line react-hooks/exhaustive-deps

  // The default saved address fills the form once, and only while the person
  // has not started typing.
  const prefilled = useRef(false)
  useEffect(() => {
    if (saved.loading) return
    // A resumed order brings its own address; show it as the saved one it came from, if any.
    if (resumedAddr.current) {
      const same = saved.data?.find((a) => sameAddress(fromSaved(a), resumedAddr.current!))
      setMode(same ? { kind: 'saved', id: same.id } : { kind: 'new' })
      if (!same) setKeep(false)
      prefilled.current = true
      return
    }
    if (prefilled.current) return
    prefilled.current = true
    const fallback = saved.data?.find((a) => a.isDefault) ?? saved.data?.[0]
    if (!fallback || touched) return
    setMode({ kind: 'saved', id: fallback.id })
    setAddress(fromSaved(fallback))
  }, [saved.loading, saved.data, touched, resumed])

  // Hold the item as soon as the page opens. Fired once via a ref (React runs
  // mount effects twice in development) and applied unconditionally.
  const reserving = useRef(false)
  useEffect(() => {
    if (reserving.current) return
    reserving.current = true
    setBusy(true)
    api.reserve(listingId)
      .then(async (r) => {
        setReservationId(r.id)
        // The hold already carries an unpaid order of theirs: they left checkout
        // part-way (a reload, the back button, another tab). Pick it back up.
        if (r.orderId) {
          const d = await api.order(r.orderId)
          if (d.order.state === 'pending_payment') {
            resume(d.order, d.payments)
            // Past the hold, an open payment still has a grace period; a countdown
            // stuck at 0:00 would say otherwise, so none is shown.
            setExpiresAt(new Date(r.expiresAt).getTime() > Date.now() ? r.expiresAt : null)
            return
          }
        }
        setExpiresAt(r.expiresAt)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }, [listingId])

  // Give the hold back if they leave before ordering. Keyed on nothing, with a
  // ref for the latest values, so it runs once on the way out and never
  // releases a reservation that has just become an order.
  const held = useRef<{ reservationId: string | null; orderId: string | null }>({ reservationId: null, orderId: null })
  held.current = { reservationId, orderId: order?.id ?? null }
  useEffect(() => () => {
    const { reservationId: rid, orderId: oid } = held.current
    if (rid && !oid) void api.releaseReservation(rid).catch(() => {})
  }, [])

  const left = useCountdown(paid ? null : expiresAt)
  const hours = meta.data?.returnWindowHours ?? 24
  const partner = meta.data?.paymentGateway === 'razorpay' ? 'Razorpay' : 'our payment partner'

  // -- actions ---------------------------------------------------------------

  /** Puts an unpaid order of theirs back on the page: its address, and the method last chosen. */
  function resume(o: Order, tries: { method: string | null; state: string }[]) {
    const a = fromOrder(o.deliveryAddress)
    resumedAddr.current = a
    setAddress(a)
    sentToOrder.current = JSON.stringify(orderAddress(a))
    setOrder(o)
    setResumed(o.orderNumber)
    const last = [...tries].reverse().find((t) => t.method)
    if (last && (last.method === 'upi' || last.method === 'card' || last.method === 'netbanking')) {
      const pref = ((last as unknown as { rawResponse?: { preference?: { upiVpa?: string; bankCode?: string } } }).rawResponse?.preference) ?? {}
      setPay((p) => ({
        ...p, method: last.method as PaymentMethod,
        upiMode: pref.upiVpa ? 'id' : 'app', vpa: pref.upiVpa ?? '', bank: pref.bankCode ?? '',
      }))
    }
    setReached(2)
  }

  async function continueFromDelivery() {
    setTouched(true)
    const problem = validAddress(address)
    if (problem) { setError(problem); return }
    setBusy(true); setError(null)
    try {
      const body = { ...address, line2: address.line2 || null, phone: address.phone || null }
      if (mode.kind === 'new' && keep) {
        const list = await api.addAddress(body)
        const added = list.find((a) => a.line1 === address.line1 && a.pincode === address.pincode && a.recipientName === address.recipientName)
        saved.reload()
        if (added) setMode({ kind: 'saved', id: added.id })
      } else if (mode.kind === 'edit' && keep) {
        // The form has no label field, so carry the saved one over rather than wipe it.
        const was = saved.data?.find((a) => a.id === mode.id)
        await api.updateAddress(mode.id, { ...body, label: was?.label ?? null })
        saved.reload()
        setMode({ kind: 'saved', id: mode.id })
      }
      await syncOrderAddress()
      go('payment')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the address')
    } finally {
      setBusy(false)
    }
  }

  /** An order already exists (the buyer came back from Review): give it the new address. */
  async function syncOrderAddress() {
    if (!order) return
    const key = JSON.stringify(orderAddress(address))
    if (sentToOrder.current === key) return
    const updated = await api.changeOrderAddress(order.id, orderAddress(address))
    sentToOrder.current = key
    setOrder(updated)
  }

  async function continueFromPayment() {
    const problem = validPay(pay)
    if (problem) { setError(problem); return }
    setBusy(true); setError(null)
    try {
      if (!order) {
        if (!reservationId) throw new Error('Your hold on this item is not ready yet')
        const created = await api.checkout(reservationId, orderAddress(address))
        sentToOrder.current = JSON.stringify(orderAddress(address))
        setOrder(created)
      } else {
        await syncOrderAddress()
      }
      go('review')
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Could not place the order')
    } finally {
      setBusy(false)
    }
  }

  async function startPayment() {
    if (!order || !pay.method) return
    setBusy(true); setError(null)
    try {
      // Opening a payment says nothing about whether it worked: that arrives
      // from the gateway, signed, straight to the API.
      const s = await api.paymentSession(order.id, preferenceOf(pay))
      if (s.checkout?.kind === 'razorpay') {
        // Razorpay's modal takes it from here; busy stays on until it reports back.
        const orderId = order.id
        await openRazorpay(
          s.checkout,
          (r) => { void finishRazorpay(orderId, r) },
          (lastFailure) => {
            setBusy(false)
            setError(lastFailure
              ? `${clause(lastFailure)}. No money was taken — try again, or choose another way to pay.`
              : 'The payment window was closed before paying. Nothing was charged; you can try again.')
          },
        )
        return
      }
      if (s.url) {
        // A real gateway: its own page takes the card, the bank login or the UPI approval.
        window.location.assign(s.url)
        return
      }
      setGateway(true) // the demo gateway, on this page
      setBusy(false)
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Could not start the payment')
      setBusy(false)
    }
  }

  /**
   * Razorpay says it was paid. The API checks that with Razorpay (signature,
   * then the payment itself) before the order is marked paid. A bank that is
   * still deciding leaves it pending; the webhook settles it, and we poll.
   */
  async function finishRazorpay(orderId: string, r: RazorpaySuccess) {
    setBusy(true); setError(null)
    try {
      const res = await api.paymentConfirm(orderId, { ...r })
      if (res.status === 'captured' || res.status === 'duplicate') {
        setPaid(true); go('done', true); return
      }
      if (res.status === 'failed') {
        const st = await api.paymentStatus(orderId)
        setError(`${clause(st.reason ?? 'The payment did not go through')}. No money was taken — try again, or choose another way to pay.`)
        return
      }
      for (let i = 0; i < 15; i++) {
        await new Promise((ok) => setTimeout(ok, 2000))
        const st = await api.paymentStatus(orderId)
        if (st.state === 'captured') { setPaid(true); go('done', true); return }
        if (st.state === 'failed') { setError(`${clause(st.reason ?? 'The payment did not go through')}. No money was taken.`); return }
      }
      setError('Your bank has not confirmed the payment yet. If money left your account, your order will update by itself as soon as it does — see Orders.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We could not confirm the payment. If money left your account, your order will update by itself shortly.')
    } finally {
      setBusy(false)
    }
  }

  async function settleDemo(outcome: 'approve' | 'decline') {
    if (!order) return
    setBusy(true); setError(null)
    try {
      const r = await api.stubPay(order.id, outcome)
      setGateway(false)
      if (r.status === 'captured' || r.status === 'duplicate') {
        setPaid(true)
        go('done', true)
        return
      }
      const st = await api.paymentStatus(order.id)
      setError(`${clause(st.reason ?? 'The payment did not go through')}. No money was taken — try again, or choose another way to pay.`)
    } catch (e) {
      setGateway(false)
      setError(e instanceof ApiError ? e.message : 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  // -- render ----------------------------------------------------------------

  if (listing.loading) return <Loading label="Loading checkout" />
  if (listing.error) return <ErrorNote error={listing.error} onRetry={listing.reload} />
  if (!listing.data) return null
  const d = listing.data
  const title = d.listing.title.split('·')[0].trim()
  const subtotal = order?.subtotalMinor ?? d.listing.priceMinor
  const shipping = order?.shippingMinor ?? SHIPPING_MINOR
  const total = order?.totalMinor ?? d.listing.priceMinor + SHIPPING_MINOR
  const banks = methods.data?.banks ?? []

  return (
    <div className="co">
      <div className="co__main">
        <nav aria-label="Checkout steps">
          <ol className="co__stepper">
            {STEPS.map((s, i) => {
              const state = step === 'done' || i < stepIndex ? 'done' : i === stepIndex ? 'now' : 'todo'
              const can = step !== 'done' && i <= reached && i !== stepIndex && !busy
              return (
                <li key={s.key} className={`co__stage co__stage--${state}`}>
                  <button type="button" disabled={!can} onClick={() => go(s.key)} aria-current={state === 'now' ? 'step' : undefined}>
                    <span className="co__stage-n">{state === 'done' ? '✓' : i + 1}</span>
                    <span className="co__stage-label">{s.label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {resumed && step !== 'done' && (
          <div className="co__note" role="status">
            You were part-way through paying for order <strong>{resumed}</strong>. Carry on where you left off — the
            address is what you chose then, and you can change it.
          </div>
        )}
        {error && <div className="co__error" role="alert">{error}</div>}
        {left === 0 && !paid && (
          <div className="co__error" role="alert">
            Your hold on this item has run out, so someone else may buy it. <Link to={`/listings/${listingId}`}>Go back to the listing</Link> to start again.
          </div>
        )}

        {step === 'delivery' && (
          <section className="co__panel" aria-labelledby="co-h-delivery">
            <h1 id="co-h-delivery" className="co__h">Where should it go?</h1>
            <p className="co__lede">We ship insured, with tracking. The address is copied onto your order, so editing your saved addresses later never changes where an order went.</p>

            {(saved.data?.length ?? 0) > 0 && (
              <div className="co__addrs" role="radiogroup" aria-label="Your saved addresses">
                {(saved.data ?? []).map((a) => {
                  const picked = (mode.kind === 'saved' || mode.kind === 'edit') && mode.id === a.id
                  return (
                    <div key={a.id} className={`co__addr${picked ? ' co__addr--on' : ''}`}>
                      <label className="co__addr-pick">
                        <input type="radio" name="addr" checked={picked}
                          onChange={() => { setMode({ kind: 'saved', id: a.id }); setAddress(fromSaved(a)); setError(null) }} />
                        <span className="co__addr-body">
                          <span><strong>{a.label || a.recipientName}</strong>{a.isDefault && <span className="co__tag">Default</span>}</span>
                          <span className="co__muted">{a.label && a.label !== a.recipientName && `${a.recipientName}, `}{oneLine(fromSaved(a))}</span>
                        </span>
                      </label>
                      {!(mode.kind === 'edit' && mode.id === a.id) && (
                        <button type="button" className="co__link"
                          onClick={() => { setMode({ kind: 'edit', id: a.id }); setAddress(fromSaved(a)); setKeep(true); setError(null) }}>
                          Edit
                        </button>
                      )}
                      {mode.kind === 'edit' && mode.id === a.id && (
                        <AddressForm value={address} onChange={(v) => { setAddress(v); setTouched(true) }} showErrors={touched}
                          keep={keep} onKeep={setKeep} keepLabel="Also update this saved address" />
                      )}
                    </div>
                  )
                })}
                <div className={`co__addr${mode.kind === 'new' ? ' co__addr--on' : ''}`}>
                  <label className="co__addr-pick">
                    <input type="radio" name="addr" checked={mode.kind === 'new'}
                      onChange={() => { setMode({ kind: 'new' }); setAddress({ ...EMPTY, recipientName: session?.displayName ?? '' }); setKeep(true); setTouched(false); setError(null) }} />
                    <span className="co__addr-body"><strong>+ Deliver to a new address</strong></span>
                  </label>
                  {mode.kind === 'new' && (
                    <AddressForm value={address} onChange={(v) => { setAddress(v); setTouched(true) }} showErrors={touched}
                      keep={keep} onKeep={setKeep} keepLabel="Save it to my addresses" />
                  )}
                </div>
              </div>
            )}
            {!saved.loading && (saved.data?.length ?? 0) === 0 && (
              <AddressForm value={address} onChange={(v) => { setAddress(v); setTouched(true) }} showErrors={touched}
                keep={keep} onKeep={setKeep} keepLabel="Save it to my addresses for next time" />
            )}

            <div className="co__nav">
              <Link to={`/listings/${listingId}`} className="co__back">← Back to the item</Link>
              {/* Disabled only while the item is being held, or when it could not be:
                  the reason is in the message above, so the button says so too. */}
              <button className="tg-button tg-button--primary co__next" disabled={busy || !reservationId} onClick={continueFromDelivery}>
                {busy ? 'Working…' : !reservationId ? (error ? 'Not available' : 'Holding the item…') : 'Continue to payment'}
              </button>
            </div>
          </section>
        )}

        {step === 'payment' && (
          <section className="co__panel" aria-labelledby="co-h-pay">
            <h1 id="co-h-pay" className="co__h">How would you like to pay?</h1>
            <p className="co__lede">Your money is held by us, not paid to the seller, until the item reaches you and the return window closes.</p>

            <div className="co__methods" role="radiogroup" aria-label="Payment method">
              <Method id="upi" pay={pay} setPay={setPay} title="UPI" sub="Google Pay, PhonePe, Paytm, BHIM or any UPI app" icon={<IconUpi />} badge="No fee">
                <div className="co__seg" role="radiogroup" aria-label="How to pay by UPI">
                  <label className={pay.upiMode === 'app' ? 'on' : ''}>
                    <input type="radio" name="upimode" checked={pay.upiMode === 'app'} onChange={() => setPay({ ...pay, upiMode: 'app' })} />
                    Scan a QR with any UPI app
                  </label>
                  <label className={pay.upiMode === 'id' ? 'on' : ''}>
                    <input type="radio" name="upimode" checked={pay.upiMode === 'id'} onChange={() => setPay({ ...pay, upiMode: 'id' })} />
                    Send a request to my UPI ID
                  </label>
                </div>
                {pay.upiMode === 'id' && (
                  <label className="co__field">
                    <span>Your UPI ID</span>
                    <input className="tg-input" inputMode="email" autoComplete="off" placeholder="yourname@okhdfcbank" value={pay.vpa}
                      onChange={(e) => setPay({ ...pay, vpa: e.target.value.trim() })} aria-invalid={!!pay.vpa && !VPA.test(pay.vpa)} />
                    {pay.vpa && !VPA.test(pay.vpa) && <small className="co__bad">That does not look like a UPI ID — it is usually name@bank.</small>}
                    <small className="co__muted">You approve the request in your UPI app. We never see your UPI PIN.</small>
                  </label>
                )}
              </Method>

              <Method id="card" pay={pay} setPay={setPay} title="Credit or debit card" sub="Visa, Mastercard, RuPay, American Express" icon={<IconCard />}>
                <p className="co__secure">
                  <IconLock /> You'll type your card in {partner}'s secure payment window, with your bank's OTP check.
                  TrueGlaz never sees or stores your card number, expiry or CVV.
                </p>
                <ul className="co__networks" aria-label="Cards accepted">
                  {['VISA', 'Mastercard', 'RuPay', 'AMEX'].map((n) => <li key={n}>{n}</li>)}
                </ul>
              </Method>

              <Method id="netbanking" pay={pay} setPay={setPay} title="Net banking" sub={`${banks.length || 'All major'} Indian banks`} icon={<IconBank />}>
                <div className="co__banks" role="radiogroup" aria-label="Popular banks">
                  {banks.slice(0, 6).map((b) => (
                    <label key={b.code} className={`co__bank${pay.bank === b.code ? ' co__bank--on' : ''}`}>
                      <input type="radio" name="bank" checked={pay.bank === b.code} onChange={() => setPay({ ...pay, bank: b.code })} />
                      <span className="co__bank-mark" aria-hidden="true">{initials(b.name)}</span>
                      <span>{b.name.replace(/ Bank$| of India$/, '')}</span>
                    </label>
                  ))}
                </div>
                <label className="co__field">
                  <span>Or choose another bank</span>
                  <select className="tg-select" value={banks.slice(0, 6).some((b) => b.code === pay.bank) ? '' : pay.bank}
                    onChange={(e) => setPay({ ...pay, bank: e.target.value })}>
                    <option value="">Select your bank</option>
                    {banks.slice(6).map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                </label>
              </Method>
            </div>

            <div className="co__nav">
              <button type="button" className="co__back" onClick={() => go('delivery')}>← Back to delivery</button>
              <button className="tg-button tg-button--primary co__next" disabled={busy || !pay.method} onClick={continueFromPayment}>
                {busy ? 'Working…' : 'Review your order'}
              </button>
            </div>
          </section>
        )}

        {step === 'review' && order && (
          <section className="co__panel" aria-labelledby="co-h-review">
            <h1 id="co-h-review" className="co__h">Check and pay</h1>
            <p className="co__lede">Order {order.orderNumber}. Nothing is charged until you approve the payment.</p>

            <div className="co__recap">
              <div className="co__recap-row">
                <div>
                  <h2 className="co__kicker">Delivering to</h2>
                  <p className="co__recap-main">{address.recipientName}</p>
                  <p className="co__muted">{oneLine(address)}{address.phone && ` · ${address.phone}`}</p>
                </div>
                <button type="button" className="co__link" onClick={() => go('delivery')}>Change</button>
              </div>
              <div className="co__recap-row">
                <div>
                  <h2 className="co__kicker">Paying by</h2>
                  <p className="co__recap-main">{methodLabel(pay, banks)}</p>
                  {pay.method === 'card' && <p className="co__muted">Card details are entered in {partner}'s secure payment window.</p>}
                </div>
                <button type="button" className="co__link" onClick={() => go('payment')}>Change</button>
              </div>
              <div className="co__recap-row">
                <div>
                  <h2 className="co__kicker">Item</h2>
                  <p className="co__recap-main">{title} <GradeBadge code={d.listing.gradeCode} /></p>
                  {d.defects.length > 0 && <p className="co__muted">With {d.defects.length} disclosed {d.defects.length === 1 ? 'defect' : 'defects'}, listed in the summary.</p>}
                </div>
              </div>
            </div>

            <ul className="co__promises">
              <li><IconShield /> Paid into escrow — the seller is paid only after the return window.</li>
              <li><IconClock /> {windowText(hours)} after delivery to return it if it is not as described.</li>
            </ul>

            <div className="co__nav">
              <button type="button" className="co__back" onClick={() => go('payment')}>← Back to payment</button>
              <button className="tg-button tg-button--primary co__next co__pay" disabled={busy || left === 0} onClick={startPayment}>
                {busy ? 'Waiting for payment…' : `Pay ${money(total)}`}
              </button>
            </div>
          </section>
        )}

        {step === 'done' && order && (
          <section className="co__panel co__panel--done" aria-labelledby="co-h-done">
            <div className="co__tick" aria-hidden="true">✓</div>
            <h1 id="co-h-done" className="co__h">Payment received — it's yours</h1>
            <p className="co__lede">Order {order.orderNumber} · {money(total)} paid by {methodLabel(pay, banks)}.</p>
            <ol className="co__next-steps">
              <li><strong>We pack it</strong> and send it insured, with tracking, to {address.recipientName}, {address.city}.</li>
              <li><strong>Check it when it arrives.</strong> You have {windowText(hours)} to return it if it is not as described.</li>
              <li><strong>Then it is yours</strong>, and only then is the seller paid.</li>
            </ol>
            <div className="co__actions">
              <button className="tg-button tg-button--primary" onClick={() => nav('/orders')}>Track my order</button>
              <button className="tg-button" onClick={() => nav('/')}>Keep browsing</button>
            </div>
          </section>
        )}
      </div>

      <aside className="co__summary" aria-label="Order summary">
        <h2 className="co__kicker">Your order</h2>
        <p className="co__sum-title">{title}</p>
        <div className="co__sum-badges">
          <GradeBadge code={d.listing.gradeCode} />
          {d.gradeLabel && <span className="co__muted">{d.gradeLabel}</span>}
        </div>
        <dl className="co__lines">
          <div><dt>Item</dt><dd>{money(subtotal)}</dd></div>
          <div><dt>Insured shipping</dt><dd>{money(shipping)}</dd></div>
          <div className="co__total"><dt>Total</dt><dd>{money(total)}</dd></div>
        </dl>
        {left != null && left > 0 && step !== 'done' && (
          <p className={`co__hold${left < 120 ? ' co__hold--low' : ''}`} role="timer">
            Held for you for <strong>{clock(left)}</strong>
          </p>
        )}
        {d.defects.length > 0 && (
          <div className="co__defects">
            <h3 className="co__kicker">Disclosed defects</h3>
            <ul>{d.defects.map((x) => <li key={x.id}>{x.title}</li>)}</ul>
          </div>
        )}
      </aside>

      {gateway && order && pay.method && (
        <DemoGateway pay={pay} banks={banks} total={total} orderNumber={order.orderNumber} busy={busy}
          onApprove={() => settleDemo('approve')} onDecline={() => settleDemo('decline')} onClose={() => setGateway(false)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- address --

function AddressForm({ value, onChange, showErrors, keep, onKeep, keepLabel }: {
  value: Addr; onChange: (v: Addr) => void; showErrors: boolean
  keep: boolean; onKeep: (v: boolean) => void; keepLabel: string
}) {
  const err = showErrors ? fieldErrors(value) : {}
  const f = (k: keyof Addr, label: string, opts: { wide?: boolean; required?: boolean; auto?: string; inputMode?: 'numeric' | 'tel'; max?: number } = {}) => (
    <label className={`co__field${opts.wide ? ' co__field--wide' : ''}`}>
      <span>{label}{opts.required && <span aria-hidden="true"> *</span>}</span>
      <input className="tg-input" value={value[k]} autoComplete={opts.auto} inputMode={opts.inputMode} maxLength={opts.max}
        aria-invalid={!!err[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
      {err[k] && <small className="co__bad">{err[k]}</small>}
    </label>
  )
  return (
    <div className="co__form">
      <div className="co__grid">
        {f('recipientName', 'Full name', { required: true, auto: 'name', wide: true })}
        {f('line1', 'House / flat, street', { required: true, auto: 'address-line1', wide: true })}
        {f('line2', 'Area, landmark (optional)', { auto: 'address-line2', wide: true })}
        {f('city', 'City', { required: true, auto: 'address-level2' })}
        <label className="co__field">
          <span>State</span>
          <select className="tg-select" value={value.state} autoComplete="address-level1" onChange={(e) => onChange({ ...value, state: e.target.value })}>
            <option value="">Select</option>
            {/* A saved address may carry a spelling the list does not have; keep it selectable. */}
            {value.state && !STATES.includes(value.state) && <option>{value.state}</option>}
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        {f('pincode', 'PIN code', { required: true, auto: 'postal-code', inputMode: 'numeric', max: 6 })}
        {f('phone', 'Phone for the courier', { auto: 'tel', inputMode: 'tel', max: 14 })}
      </div>
      <label className="co__check">
        <input type="checkbox" checked={keep} onChange={(e) => onKeep(e.target.checked)} /> {keepLabel}
      </label>
    </div>
  )
}

// ---------------------------------------------------------------- payment --

function Method({ id, pay, setPay, title, sub, icon, badge, children }: {
  id: PaymentMethod; pay: Pay; setPay: (p: Pay) => void; title: string; sub: string
  icon: React.ReactNode; badge?: string; children: React.ReactNode
}) {
  const on = pay.method === id
  return (
    <div className={`co__method${on ? ' co__method--on' : ''}`}>
      <label className="co__method-head">
        <input type="radio" name="method" checked={on} onChange={() => setPay({ ...pay, method: id })} />
        <span className="co__method-icon" aria-hidden="true">{icon}</span>
        <span className="co__method-text">
          <strong>{title}</strong>
          <span className="co__muted">{sub}</span>
        </span>
        {badge && <span className="co__tag co__tag--good">{badge}</span>}
      </label>
      {on && <div className="co__method-body">{children}</div>}
    </div>
  )
}

/**
 * The stub gateway, drawn as a gateway would be. Only on a deployment with no
 * real gateway (the demo), where the API itself plays the gateway and still
 * signs and verifies the webhook. It never asks for card details.
 */
function DemoGateway({ pay, banks, total, orderNumber, busy, onApprove, onDecline, onClose }: {
  pay: Pay; banks: { code: string; name: string }[]; total: number; orderNumber: string; busy: boolean
  onApprove: () => void; onDecline: () => void; onClose: () => void
}) {
  const bank = banks.find((b) => b.code === pay.bank)?.name
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { box.current?.focus() }, [])
  return (
    <div className="gw" role="dialog" aria-modal="true" aria-labelledby="gw-h" onKeyDown={(e) => { if (e.key === 'Escape' && !busy) onClose() }}>
      <div className="gw__box" ref={box} tabIndex={-1}>
        <div className="gw__bar">
          <span><IconLock /> Demo payment gateway</span>
          <button type="button" className="gw__x" onClick={onClose} disabled={busy} aria-label="Close">×</button>
        </div>
        <p className="gw__amount">{money(total)}</p>
        <p className="gw__for">TrueGlaz · order {orderNumber}</p>
        <h2 id="gw-h" className="gw__h">
          {pay.method === 'upi' ? (pay.upiMode === 'id' ? `Request sent to ${pay.vpa}` : 'Scan to pay with any UPI app')
            : pay.method === 'card' ? 'Card payment' : `${bank ?? 'Your bank'} — net banking`}
        </h2>
        {pay.method === 'upi' && pay.upiMode === 'app' && <FakeQr />}
        <p className="gw__note">
          {pay.method === 'upi' ? (pay.upiMode === 'id' ? 'Open your UPI app and approve the request with your PIN.' : 'Open any UPI app, scan the code and approve with your PIN.')
            : pay.method === 'card' ? "In production this is the payment partner's secure card page and your bank's OTP check. Nothing here asks for card details."
              : `In production you sign in to ${bank ?? 'your bank'} on its own site and approve the payment there.`}
        </p>
        <p className="gw__demo">This is a demonstration. No money moves. Choose what the bank does:</p>
        <div className="gw__actions">
          <button className="tg-button tg-button--primary" disabled={busy} onClick={onApprove}>{busy ? 'Working…' : 'Approve payment'}</button>
          <button className="tg-button" disabled={busy} onClick={onDecline}>Decline</button>
        </div>
      </div>
    </div>
  )
}

function FakeQr() {
  // A pattern that reads as a QR code; it encodes nothing.
  const cells = useMemo(() => Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21, y = Math.floor(i / 21)
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
    if (finder) {
      const fx = x > 13 ? x - 14 : x, fy = y > 13 ? y - 14 : y
      return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5)
    }
    return ((x * 7 + y * 13 + x * y) % 5) < 2
  }), [])
  return (
    <svg className="gw__qr" viewBox="0 0 21 21" role="img" aria-label="Demo QR code" shapeRendering="crispEdges">
      <rect width="21" height="21" fill="#fff" />
      {cells.map((on, i) => on && <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#111" />)}
    </svg>
  )
}

// ---------------------------------------------------------------- helpers --

const PIN = /^[1-9][0-9]{5}$/
const VPA = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/
const PHONE = /^(\+?91[\s-]?)?[6-9][0-9]{9}$/

function fieldErrors(a: Addr): Partial<Record<keyof Addr, string>> {
  const e: Partial<Record<keyof Addr, string>> = {}
  if (!a.recipientName.trim()) e.recipientName = 'Who should the courier ask for?'
  if (!a.line1.trim()) e.line1 = 'Add the house or flat and street'
  if (!a.city.trim()) e.city = 'Add the city'
  if (!PIN.test(a.pincode.trim())) e.pincode = 'A PIN code is 6 digits'
  if (a.phone.trim() && !PHONE.test(a.phone.replace(/\s/g, ''))) e.phone = 'A 10-digit Indian mobile number'
  return e
}

function validAddress(a: Addr): string | null {
  const first = Object.values(fieldErrors(a))[0]
  return first ? `Check the address: ${first.charAt(0).toLowerCase()}${first.slice(1)}.` : null
}

function validPay(p: Pay): string | null {
  if (!p.method) return 'Choose how you would like to pay.'
  if (p.method === 'upi' && p.upiMode === 'id' && !VPA.test(p.vpa)) return 'Enter your UPI ID, or choose to scan a QR instead.'
  if (p.method === 'netbanking' && !p.bank) return 'Choose your bank.'
  return null
}

function preferenceOf(p: Pay): PaymentPreference {
  return {
    method: p.method!,
    upiVpa: p.method === 'upi' && p.upiMode === 'id' ? p.vpa : null,
    bankCode: p.method === 'netbanking' ? p.bank : null,
  }
}

function methodLabel(p: Pay, banks: { code: string; name: string }[]): string {
  if (p.method === 'upi') return p.upiMode === 'id' ? `UPI · ${p.vpa}` : 'UPI · any app'
  if (p.method === 'card') return 'Credit or debit card'
  if (p.method === 'netbanking') return `Net banking · ${banks.find((b) => b.code === p.bank)?.name ?? p.bank}`
  return '—'
}

function orderAddress(a: Addr) {
  return {
    recipientName: a.recipientName.trim(), line1: a.line1.trim(), line2: a.line2.trim(), city: a.city.trim(),
    state: a.state.trim(), pincode: a.pincode.trim(), countryCode: 'IN', phone: a.phone.trim(),
  }
}

function fromSaved(a: Address): Addr {
  return {
    recipientName: a.recipientName, line1: a.line1, line2: a.line2 ?? '', city: a.city,
    state: a.state ?? '', pincode: a.pincode, phone: a.phoneE164 ?? '',
  }
}

function fromOrder(d: Record<string, unknown> | null): Addr {
  const v = (k: string) => (typeof d?.[k] === 'string' ? (d![k] as string) : '')
  return { recipientName: v('recipientName'), line1: v('line1'), line2: v('line2'), city: v('city'), state: v('state'), pincode: v('pincode'), phone: v('phone') }
}

function sameAddress(a: Addr, b: Addr): boolean {
  const k = (x: Addr) => [x.recipientName, x.line1, x.line2, x.city, x.pincode].map((s) => s.trim().toLowerCase()).join('|')
  return k(a) === k(b)
}

function oneLine(a: Addr): string {
  return [a.line1, a.line2, a.city, [a.state, a.pincode].filter(Boolean).join(' ')].filter((x) => x && x.trim()).join(', ')
}

function initials(name: string): string {
  return name.replace(/ Bank$| of India$/, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase()
}

/** A gateway's sentence, ready to be followed by one of ours ("…bank." + ". No money…" reads as a typo). */
function clause(s: string): string {
  return s.trim().replace(/[.!\s]+$/, '')
}

function windowText(hours: number): string {
  return hours % 24 === 0 && hours >= 48 ? `${hours / 24} days` : `${hours} hours`
}

function clock(secs: number): string {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

/** Seconds until `iso`, ticking; 0 once passed, null with nothing to count. */
function useCountdown(iso: string | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!iso) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [iso])
  if (!iso) return null
  return Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000))
}

const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]

const svg = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function IconUpi() { return <svg {...svg}><path d="M7 4l5 16M12 4l5 16" /><path d="M4 12h16" opacity=".35" /></svg> }
function IconCard() { return <svg {...svg}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></svg> }
function IconBank() { return <svg {...svg}><path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></svg> }
function IconLock() { return <svg {...svg} width={14} height={14}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg> }
function IconShield() { return <svg {...svg} width={18} height={18}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg> }
function IconClock() { return <svg {...svg} width={18} height={18}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> }
