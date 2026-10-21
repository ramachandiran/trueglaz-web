import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { api, useApi } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Badge, Card, Muted, SectionTitle } from '../components/ui'
import { demoAadhaar } from '../aadhaar'

type Step = 'aadhaar' | 'otp'
type StepState = 'done' | 'current' | 'upcoming'

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
  const steps: { title: string; desc: string; state: StepState; meta: string; tone: 'ok' | 'now' | 'next' }[] = [
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
        <View>
          {steps.map((s, i) => (
            <TrackStep key={s.title} index={i + 1} step={s} last={i === steps.length - 1} />
          ))}
        </View>
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

function TrackStep({ index, step, last }: {
  index: number
  step: { title: string; desc: string; state: StepState; meta: string; tone: 'ok' | 'now' | 'next' }
  last: boolean
}) {
  const t = useTheme()
  const done = step.state === 'done'
  const current = step.state === 'current'

  const node = done
    ? { bg: t.colors.good, border: t.colors.good, fg: '#ffffff' }
    : current
      ? { bg: t.colors.accent, border: t.colors.accent, fg: '#ffffff' }
      : { bg: t.colors.bgRaised, border: t.colors.border, fg: t.colors.textMuted }

  const meta = step.tone === 'ok'
    ? { bg: t.colors.goodSoft, fg: t.colors.good }
    : step.tone === 'now'
      ? { bg: t.colors.accentSoft, fg: t.colors.accent }
      : { bg: t.colors.bgSunken, fg: t.colors.textMuted }

  return (
    <View style={{ flexDirection: 'row', gap: t.space.x3 }}>
      <View style={{ alignItems: 'center', width: 32 }}>
        <View style={[
          { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: node.bg, borderColor: node.border },
          current && { shadowColor: t.colors.accent, shadowOpacity: 0.35, shadowRadius: 5, elevation: 3 },
        ]}>
          <Txt style={{ color: node.fg, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{done ? '✓' : index}</Txt>
        </View>
        {!last && <View style={{ width: 2, flex: 1, minHeight: 22, marginVertical: 3, backgroundColor: done ? t.colors.good : t.colors.border }} />}
      </View>

      <View style={{ flex: 1, paddingBottom: last ? 4 : t.space.x4 }}>
        <Txt style={{ color: step.state === 'upcoming' ? t.colors.textMuted : t.colors.text, fontWeight: (step.state === 'upcoming' ? t.weight.medium : t.weight.bold) as never, fontSize: t.size.md }}>
          {step.title}
        </Txt>
        <Muted size={t.size.xs}>{step.desc}</Muted>
        <View style={{ alignSelf: 'flex-start', marginTop: 6, backgroundColor: meta.bg, borderRadius: t.radius.pill, paddingHorizontal: t.space.x3, paddingVertical: 3 }}>
          <Txt style={{ color: meta.fg, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{step.meta}</Txt>
        </View>
      </View>
    </View>
  )
}
