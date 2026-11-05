import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { api, money, type PaymentSessionView, type RazorpayCheckout } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button } from '../components/form'
import { ErrorNote, Loading, Muted } from '../components/ui'

/**
 * Paying for an order with the real gateway.
 *
 * The API opens a payment session; this screen hosts the gateway's own checkout
 * and only ever passes back what the gateway returned. Whether money moved is
 * decided by the API (it checks the gateway's signature and fetches the payment
 * before booking anything), never by this screen.
 *
 * - Razorpay: its Standard Checkout runs inside a WebView, the same script the
 *   website uses. Success posts Razorpay's three fields back here, and they go
 *   to `payment-confirm`.
 * - A gateway with a hosted page (`session.url`): the page opens in the WebView
 *   and this screen polls `payment-status` until the gateway has reported.
 * - The stub (demo) gateway approves at once, as checkout always has.
 */
export function PayScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const orderId: string = route.params.orderId
  const [session, setSession] = useState<PaymentSessionView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const done = useRef(false)

  const finish = useCallback(() => {
    if (done.current) return
    done.current = true
    navigation.replace('OrderDetail', { id: orderId, justPaid: true })
  }, [navigation, orderId])

  const open = useCallback(async () => {
    setError(null); setNote(null); setSession(null)
    try {
      // Idempotent: asking again returns the open session rather than a second payment.
      const opened = await api.paymentSession(orderId)
      if (opened.provider === 'stub') {
        await api.stubPay(orderId, 'approve')
        finish()
        return
      }
      setSession(opened)
    } catch (e) { setError((e as Error).message) }
  }, [orderId, finish])

  useEffect(() => { open() }, [open])

  // A hosted page reports to the API, not to us: watch for the outcome.
  useEffect(() => {
    if (!session?.url || session.checkout) return
    const id = setInterval(async () => {
      try {
        const s = await api.paymentStatus(orderId)
        if (s.state === 'captured') finish()
        else if (s.state === 'failed') setNote(s.reason ?? 'The payment did not go through. You can try again.')
      } catch { /* the next tick tries again */ }
    }, 3000)
    return () => clearInterval(id)
  }, [session, orderId, finish])

  const onMessage = async (e: WebViewMessageEvent) => {
    let msg: { type: string; fields?: Record<string, string>; reason?: string | null }
    try { msg = JSON.parse(e.nativeEvent.data) } catch { return }
    if (msg.type === 'success' && msg.fields) {
      setConfirming(true)
      try {
        const r = await api.paymentConfirm(orderId, msg.fields)
        if (r.status === 'captured' || r.status === 'duplicate') finish()
        else if (r.status === 'pending') setNote('Your bank is still confirming the payment. We will update this order as soon as it does.')
        else setNote('The payment did not go through. You can try again.')
      } catch (err) { setError((err as Error).message) } finally { setConfirming(false) }
    } else if (msg.type === 'dismiss') {
      setNote(msg.reason ? `${msg.reason}. You can try again.` : 'Payment was not completed. You can try again, or pay later from Orders.')
      setSession(null)
    } else if (msg.type === 'error') {
      setError(msg.reason ?? 'The payment window did not load.')
    }
  }

  if (error || note || (!session && !confirming)) {
    if (!error && !note) return <Centered><Loading /></Centered>
    return (
      <Centered>
        {error ? <ErrorNote error={new Error(error)} /> : <Txt style={{ color: t.colors.text, textAlign: 'center' }}>{note}</Txt>}
        <Button label="Try again" onPress={open} />
        <Button label="Pay later" variant="ghost" onPress={() => navigation.replace('OrderDetail', { id: orderId, awaitingPayment: true })} />
      </Centered>
    )
  }

  if (confirming || !session) return <Centered><Loading /><Muted>Confirming your payment…</Muted></Centered>

  // The gateway's checkout needs a native WebView; the web build of the app has
  // none (the stub gateway above needs no window and works everywhere).
  if (Platform.OS === 'web') {
    return (
      <Centered>
        <Muted>Payment opens in the TrueGlaz app on your phone, or on the website.</Muted>
        <Button label="Back to the order" variant="ghost" onPress={() => navigation.replace('OrderDetail', { id: orderId, awaitingPayment: true })} />
      </Centered>
    )
  }

  const checkout = session.checkout
  if (checkout?.kind === 'razorpay') {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <Muted size={t.size.xs} style={{ textAlign: 'center', padding: t.space.x2 }}>
          Paying {money(session.amountMinor, session.currency)} for order {session.orderNumber}
        </Muted>
        <WebView
          originWhitelist={['*']}
          source={{ html: razorpayPage(checkout), baseUrl: 'https://checkout.razorpay.com' }}
          onMessage={onMessage}
          javaScriptEnabled
          setSupportMultipleWindows={false}
          style={{ flex: 1 }}
        />
      </View>
    )
  }

  if (session.url) {
    return <WebView source={{ uri: session.url }} style={{ flex: 1 }} />
  }

  return (
    <Centered>
      <ErrorNote error={new Error('This payment method is not available in the app yet.')} />
      <Button label="Back to the order" variant="ghost" onPress={() => navigation.replace('OrderDetail', { id: orderId, awaitingPayment: true })} />
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  const t = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x5, gap: t.space.x3, justifyContent: 'center' }}>
      {children}
    </View>
  )
}

/**
 * A page that opens Razorpay Standard Checkout straight away and reports back.
 * Only public values go in (key id, Razorpay order, prefill); the options are
 * JSON-encoded and `<` is escaped so nothing in them can close the script tag.
 */
function razorpayPage(options: RazorpayCheckout): string {
  const { kind: _kind, ...rest } = options
  const json = JSON.stringify(rest).replace(/</g, '\\u003c')
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head><body>
<script>
  function post(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)) }
  var lastFailure = null
  try {
    var o = ${json}
    o.retry = { enabled: true }
    o.handler = function (r) { post({ type: 'success', fields: {
      razorpay_payment_id: r.razorpay_payment_id, razorpay_order_id: r.razorpay_order_id, razorpay_signature: r.razorpay_signature } }) }
    o.modal = { confirm_close: true, ondismiss: function () { post({ type: 'dismiss', reason: lastFailure }) } }
    var rzp = new Razorpay(o)
    rzp.on('payment.failed', function (r) { lastFailure = (r.error && r.error.description) || 'The payment did not go through' })
    rzp.open()
  } catch (e) { post({ type: 'error', reason: 'The payment window did not load' }) }
</script></body></html>`
}
