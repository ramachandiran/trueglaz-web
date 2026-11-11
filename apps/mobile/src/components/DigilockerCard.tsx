import { useEffect, useRef, useState } from 'react'
import { AppState, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { api, type KycStatus } from '@trueglaz/core'
import { Txt } from './Txt'
import { Button } from './form'
import { Card, Muted, SectionTitle } from './ui'
import { Check } from './VaultCover'
import { useTheme } from '../theme/ThemeContext'

const DEFAULT_CONSENT =
  'I agree to share my Aadhaar details (name, date of birth, gender and the last four digits) from DigiLocker with TrueGlaz to verify my identity for selling. TrueGlaz does not see or store my full Aadhaar number.'

/**
 * Aadhaar through the seller's own DigiLocker, from the app.
 *
 * DigiLocker opens in the in-app browser sheet. It sends the person back to our
 * web return page (DigiLocker only accepts an https address), which just says
 * "go back to the app"; the app then asks the API whether DigiLocker has
 * confirmed — when the sheet closes, and again whenever the app comes to the
 * front, since on Android the sheet does not always report closing.
 */
export function DigilockerCard({ kyc, onVerified }: { kyc: KycStatus | null; onVerified: () => void }) {
  const t = useTheme()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(!!kyc?.digilockerPending)
  const [error, setError] = useState<string | null>(null)
  const checking = useRef(false)

  async function check(quiet: boolean) {
    if (checking.current) return
    checking.current = true
    try {
      // A few tries: DigiLocker can take a moment after the person approves.
      for (let i = 0; i < 4; i++) {
        const r = await api.completeDigilocker()
        if (r.state === 'verified') { setWaiting(false); setError(null); onVerified(); return }
        await new Promise((res) => setTimeout(res, 2500))
      }
      if (!quiet) setError("DigiLocker hasn't confirmed yet. Finish sharing there, then tap check again.")
    } catch (e) {
      setWaiting(false)
      setError((e as Error).message)
    } finally { checking.current = false }
  }

  // Coming back to the app is the usual signal that DigiLocker is done.
  useEffect(() => {
    if (!waiting) return
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(true) })
    return () => sub.remove()
  }, [waiting])

  async function start() {
    setBusy(true); setError(null)
    try {
      const { url } = await api.startDigilocker(true, true)
      setWaiting(true)
      await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'done', showTitle: true })
      await check(false)
    } catch (e) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <Card style={{ gap: t.space.x3 }}>
      <SectionTitle>Verify with DigiLocker</SectionTitle>
      <View style={{ gap: 6 }}>
        <Muted size={t.size.xs}>1. Open DigiLocker, the government's document wallet.</Muted>
        <Muted size={t.size.xs}>2. Sign in with the code sent to your Aadhaar-linked mobile.</Muted>
        <Muted size={t.size.xs}>3. Allow sharing, then come back to this app.</Muted>
      </View>
      <Check on={consent} onToggle={() => setConsent(!consent)} label={kyc?.consentText ?? DEFAULT_CONSENT} />
      {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
      <Button
        label={waiting ? 'Open DigiLocker again' : 'Verify with DigiLocker'}
        loading={busy}
        disabled={!consent}
        onPress={start}
      />
      {waiting && !busy && (
        <Button label="I've finished in DigiLocker" variant="ghost" onPress={() => check(false)} />
      )}
      <Muted size={t.size.xs}>You must be 18 or over. We never see or keep your full Aadhaar number.</Muted>
    </Card>
  )
}
