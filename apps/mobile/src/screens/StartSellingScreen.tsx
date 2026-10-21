import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { api, useApi } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Badge, Card, Muted, SectionTitle } from '../components/ui'
import { demoAadhaar } from '../aadhaar'

type Step = 'aadhaar' | 'otp' | 'done'

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

  const alreadyVerified = kyc.data?.status === 'verified'

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
    try { await api.verifyEkyc(otp.replace(/\D/g, '')); setStep('done'); kyc.reload() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
      <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>Verify your identity</Txt>

      {alreadyVerified && (
        <Card style={{ borderColor: t.colors.good, gap: 4 }}>
          <Txt style={{ color: t.colors.good, fontWeight: t.weight.bold as never }}>Identity already verified ✓</Txt>
          <Muted size={t.size.xs}>Selling activation is approved by our team; you'll be notified.</Muted>
        </Card>
      )}

      {step === 'aadhaar' && !alreadyVerified && (
        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>Aadhaar eKYC</SectionTitle>
          <Muted size={t.size.xs}>We verify your identity over an OTP sent to your Aadhaar-linked mobile. We never store the number.</Muted>
          <Field label="Aadhaar number" value={aadhaar} onChangeText={setAadhaar} keyboardType="number-pad" placeholder="12 digits" />
          <Button label="Use a demo number" variant="ghost" onPress={() => setAadhaar(demoAadhaar())} />
          {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
          <Button label="Send OTP" loading={busy} onPress={start} />
        </Card>
      )}

      {step === 'otp' && (
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

      {step === 'done' && (
        <Card style={{ borderColor: t.colors.good, gap: t.space.x2 }}>
          <Badge label="Verified" tone="good" />
          <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>Identity verified</Txt>
          <Muted>Your selling account is being reviewed by our team. You'll be able to consign items once it's approved — we'll notify you.</Muted>
          <Button label="Back to selling" variant="ghost" onPress={() => navigation.goBack()} />
        </Card>
      )}

      <Muted size={t.size.xs}>Tip: on the demo server, the account seller@trueglaz.demo is already an approved seller if you want to try consigning right away.</Muted>
    </ScrollView>
  )
}
