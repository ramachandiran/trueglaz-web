import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError, useSession, type KycStatus } from '@trueglaz/core'
import { Loading } from '../components/ui'
import './DigilockerReturnPage.css'

type View =
  | { kind: 'checking' }
  | { kind: 'waiting' }
  | { kind: 'verified'; kyc: KycStatus }
  | { kind: 'failed'; message: string }

/** DigiLocker can take a few seconds to confirm after the person approves. */
const POLL_MS = 3000
const POLL_FOR_MS = 60_000

/**
 * Where DigiLocker sends the person after they share (or decline) their Aadhaar.
 *
 * Not behind the sign-in guard: someone whose session lapsed while they were in
 * DigiLocker should be told to sign in, not bounced with no explanation. From
 * the phone app (`?from=app`) this page opens in the app's browser sheet, which
 * has no TrueGlaz session at all, so it only says to go back; the app finishes
 * the check itself when it returns to the front.
 */
export function DigilockerReturnPage() {
  const [params] = useSearchParams()
  const fromApp = params.get('from') === 'app'
  const { session, ready } = useSession()
  const [view, setView] = useState<View>({ kind: 'checking' })
  const started = useRef(false)

  useEffect(() => {
    if (fromApp || !ready || !session || started.current) return
    started.current = true
    let stop = false
    const until = Date.now() + POLL_FOR_MS
    async function tick() {
      try {
        const r = await api.completeDigilocker()
        if (stop) return
        if (r.state === 'verified') { setView({ kind: 'verified', kyc: r.kyc }); return }
        if (Date.now() > until) { setView({ kind: 'waiting' }); return }
        setTimeout(tick, POLL_MS)
      } catch (e) {
        if (!stop) setView({ kind: 'failed', message: e instanceof ApiError ? e.message : 'We could not finish the check.' })
      }
    }
    tick()
    return () => { stop = true }
  }, [fromApp, ready, session])

  if (fromApp) {
    return (
      <Card title="Go back to the TrueGlaz app" tone="ok">
        <p>DigiLocker is done. Close this page and the app will finish the check.</p>
      </Card>
    )
  }

  if (!ready) return <Loading label="Checking your session" />

  if (!session) {
    return (
      <Card title="Sign in to finish" tone="neutral">
        <p>Your session ended while you were in DigiLocker. Sign in and start the check again — it takes a minute.</p>
        <Link className="tg-button tg-button--primary" to="/sign-in" state={{ from: '/sell/manage' }}>Sign in</Link>
      </Card>
    )
  }

  switch (view.kind) {
    case 'checking':
      return (
        <Card title="Confirming with DigiLocker…" tone="neutral">
          <p className="tg-muted">This usually takes a few seconds. Please keep this page open.</p>
          <Loading label="Confirming with DigiLocker" />
        </Card>
      )
    case 'waiting':
      return (
        <Card title="DigiLocker hasn't confirmed yet" tone="neutral">
          <p>If you approved sharing, it can take a minute to reach us. Check again from Selling, or start over if you closed DigiLocker early.</p>
          <Link className="tg-button tg-button--primary" to="/sell/manage">Go to Selling</Link>
        </Card>
      )
    case 'verified':
      return (
        <Card title="Aadhaar verified" tone="ok">
          <p>
            <strong>{view.kyc.legalName}</strong>
            {view.kyc.idLast4 && <> · Aadhaar ending {view.kyc.idLast4}</>}
          </p>
          <p className="tg-muted">
            {view.kyc.canSell
              ? 'You can send items in for sale now.'
              : 'Our team gives new sellers a quick look before the first item, usually within a working day.'}
          </p>
          <div className="dlr__actions">
            <Link className="tg-button tg-button--primary" to="/sell/manage">Continue to Selling</Link>
            <Link className="tg-button" to="/profile#bank">Add your payout account</Link>
          </div>
        </Card>
      )
    case 'failed':
      return (
        <Card title="That didn't go through" tone="bad">
          <p role="alert">{view.message}</p>
          <div className="dlr__actions">
            <Link className="tg-button tg-button--primary" to="/sell/manage">Try again</Link>
          </div>
        </Card>
      )
  }
}

function Card({ title, tone, children }: { title: string; tone: 'ok' | 'bad' | 'neutral'; children: React.ReactNode }) {
  return (
    <main className="dlr">
      <section className={`tg-card dlr__card dlr__card--${tone}`}>
        <p className="dlr__eyebrow">Identity check</p>
        <h1 className="dlr__title">{title}</h1>
        {children}
      </section>
    </main>
  )
}
