import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { api, useApi } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Badge, Card, Muted, SectionTitle } from '../components/ui'
import { StatusTracker, type TrackStep } from '../components/StatusTracker'
import { demoAadhaar } from '../aadhaar'

type Step = 'aadhaar' | 'otp'

export function StartSellingScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const kyc = useApi(() => api.myKyc(), [])

  const [step, setStep] = useState<Step>('aadhaar')
  const [aadhaar, setAadhaar] = useState('')
  const [otp, setOtp] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [mobileHint, setMobileHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justVerified, setJustVerified] = useState(false)

  const verified = justVerified || kyc.data?.status === 'verified'
  const canSell = kyc.data?.canSell ?? false
  const showForm = !verified

  const start = async () => {
    const digits = aadhaar.replace(/\D/g, '')
    if (digits.length !== 12) { setError('An Aadhaar number is 12 digits.'); return }
    setError(null); setBusy(true)
    try {
      const res = await api.startEkyc(digits)
      setDevCode(res.devCode); setMobileHint(res.mobileHint)
      if (res.devCode) setOtp(res.devCode)
      setStep('otp')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const verify = async () => {
    if (otp.replace(/\D/g, '').length < 4) { setError('Enter the OTP.'); return }
    setError(null); setBusy(true)
    try { await api.verifyEkyc(otp.replace(/\D/g, '')); setJustVerified(true); kyc.reload() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  // The journey to a working seller account, with the current position marked.
  const steps: TrackStep[] = [
    { title: 'Account created', desc: 'Signed in with your email.', state: 'done', meta: 'Done', tone: 'ok' },
    {
      title: 'Identity verified',
      desc: 'Aadhaar eKYC — we keep only the last four digits.',
      state: verified ? 'done' : 'current',
      meta: verified ? 'Verified' : 'In progress', tone: verified ? 'ok' : 'now',
    },
    {
      title: 'Under review by TrueGlaz',
      desc: 'Our team checks your account to switch on selling.',
      state: canSell ? 'done' : verified ? 'current' : 'upcoming',
      meta: canSell ? 'Done' : verified ? 'In progress · usually < 1 day' : 'Next', tone: canSell ? 'ok' : verified ? 'now' : 'next',
    },
    {
      title: 'Selling enabled',
      desc: 'Consign gear, approve prices, and get paid when it sells.',
      state: canSell ? 'current' : 'upcoming',
      meta: canSell ? 'Ready' : 'Next', tone: canSell ? 'now' : 'next',
    },
  ]

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
      {/* status hero */}
      {verified && !canSell && (
        <Card style={{ borderColor: t.colors.warn, gap: t.space.x2 }}>
          <Badge label="Awaiting approval" tone="warn" />
          <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>
            You're verified — waiting for TrueGlaz to approve your selling account
          </Txt>
          <Muted>Usually done within a day. We'll notify you the moment it's approved — there's nothing else you need to do.</Muted>
        </Card>
      )}
      {canSell && (
        <Card style={{ borderColor: t.colors.good, gap: t.space.x2 }}>
          <Badge label="Approved" tone="good" />
          <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>You're all set to sell</Txt>
          <Button label="Go to selling" onPress={() => navigation.goBack()} />
        </Card>
      )}
      {!verified && (
        <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>Start selling</Txt>
      )}

      {/* the status tracker */}
      <View style={{ gap: t.space.x2 }}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.6 }}>YOUR PROGRESS</Txt>
        <StatusTracker steps={steps} />
      </View>

      {/* contextual action: the eKYC form only while unverified */}
      {showForm && step === 'aadhaar' && (
        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>Verify with Aadhaar eKYC</SectionTitle>
          <Muted size={t.size.xs}>We verify your identity over an OTP sent to your Aadhaar-linked mobile. We never store the number.</Muted>
          <Field label="Aadhaar number" value={aadhaar} onChangeText={setAadhaar} keyboardType="number-pad" placeholder="12 digits" />
          <Button label="Use a demo number" variant="ghost" onPress={() => setAadhaar(demoAadhaar())} />
          {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
          <Button label="Send OTP" loading={busy} onPress={start} />
        </Card>
      )}

      {showForm && step === 'otp' && (
        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>Enter the OTP</SectionTitle>
          {mobileHint && <Muted size={t.size.xs}>Sent to {mobileHint}.</Muted>}
          {devCode && (
            <View style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md, padding: t.space.x3 }}>
              <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never }}>Demo OTP: {devCode}</Txt>
            </View>
          )}
          <Field label="OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
          {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
          <Button label="Verify" loading={busy} onPress={verify} />
        </Card>
      )}

      <Muted size={t.size.xs}>Tip: on the demo server, seller@trueglaz.demo is already an approved seller if you want to try consigning right away.</Muted>
    </ScrollView>
  )
}
