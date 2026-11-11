import { uploadPhoto } from '../media/uploadPhoto'
import { useState } from 'react'
import { Image, ScrollView, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { api, useApi, useSession } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Card, Muted, SectionTitle } from '../components/ui'
import { type TrackStep } from '../components/StatusTracker'
import { ProgressSection, StatusHero } from '../components/StatusViews'
import { demoAadhaar } from '../aadhaar'
import { DigilockerCard } from '../components/DigilockerCard'
import { OtpBoxes } from '../components/OtpBoxes'

type Step = 'aadhaar' | 'otp'

export function StartSellingScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const kyc = useApi(() => api.myKyc(), [])
  const { session } = useSession()

  const [step, setStep] = useState<Step>('aadhaar')
  const [aadhaar, setAadhaar] = useState('')
  const [otp, setOtp] = useState('')
  const [selfie, setSelfie] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [mobileHint, setMobileHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justVerified, setJustVerified] = useState(false)

  const verified = justVerified || kyc.data?.status === 'verified'
  const canSell = kyc.data?.canSell ?? false
  // An older API sends no list, and offered only the OTP route.
  const methods = kyc.data?.methods ?? ['aadhaar_otp', 'documents']
  const digilocker = methods.includes('digilocker')
  const otpOffered = methods.includes('aadhaar_otp')
  const [useOtp, setUseOtp] = useState(false)
  const showOtp = !verified && otpOffered && (!digilocker || useOtp)
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

  const takeSelfie = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { setError('Allow camera access to take your verification selfie.'); return }
    const res = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.6 })
    if (!res.canceled) { setSelfie(res.assets[0]); setError(null) }
  }

  const verify = async () => {
    if (otp.replace(/\D/g, '').length < 4) { setError('Enter the OTP.'); return }
    if (!selfie) { setError('Take a verification selfie to finish.'); return }
    setError(null); setBusy(true)
    try {
      // Attach the selfie to the identity check before verifying — once it is
      // verified the record is locked and no longer accepts uploads.
      if (session?.userId) await uploadPhoto(selfie, { ownerType: 'kyc', ownerId: session.userId, role: 'selfie' })
      await api.verifyEkyc(otp.replace(/\D/g, '')); setJustVerified(true); kyc.reload()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  // The journey to a working seller account, with the current position marked.
  const steps: TrackStep[] = [
    { title: 'Account created', desc: 'Signed in with your email.', state: 'done', meta: 'Done', tone: 'ok' },
    {
      title: 'Identity verified',
      desc: digilocker ? 'Aadhaar through DigiLocker — we keep only the last four digits.' : 'Aadhaar eKYC — we keep only the last four digits.',
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
        <StatusHero
          tone="warn"
          badge="Awaiting approval"
          title="You're verified — waiting for TrueGlaz to approve your selling account"
          body="Usually done within a day. We'll notify you the moment it's approved — there's nothing else you need to do."
        />
      )}
      {canSell && (
        <StatusHero tone="good" badge="Approved" title="You're all set to sell">
          <Button label="Go to selling" onPress={() => navigation.goBack()} />
        </StatusHero>
      )}
      {!verified && (
        <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>Start selling</Txt>
      )}

      {/* the status tracker */}
      <ProgressSection steps={steps} />

      {/* contextual action: DigiLocker first, the OTP route only where offered */}
      {showForm && digilocker && !useOtp && kyc.data && (
        <DigilockerCard kyc={kyc.data} onVerified={() => { setJustVerified(true); kyc.reload() }} />
      )}
      {showForm && digilocker && otpOffered && (
        <Button
          label={useOtp ? 'Use DigiLocker instead' : 'Use a one-time code on your Aadhaar instead'}
          variant="ghost"
          onPress={() => { setUseOtp(!useOtp); setError(null) }}
        />
      )}

      {showOtp && step === 'aadhaar' && (
        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>Verify with Aadhaar eKYC</SectionTitle>
          <Muted size={t.size.xs}>We verify your identity over an OTP sent to your Aadhaar-linked mobile. We never store the number.</Muted>
          <Field label="Aadhaar number" value={aadhaar} onChangeText={setAadhaar} keyboardType="number-pad" placeholder="12 digits" />
          <Button label="Use a demo number" variant="ghost" onPress={() => setAadhaar(demoAadhaar())} />
          {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
          <Button label="Send OTP" loading={busy} onPress={start} />
        </Card>
      )}

      {showOtp && step === 'otp' && (
        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>Enter the OTP</SectionTitle>
          {mobileHint && <Muted size={t.size.xs}>Sent to {mobileHint}.</Muted>}
          {devCode && (
            <View style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md, padding: t.space.x3 }}>
              <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never }}>Demo OTP: {devCode}</Txt>
            </View>
          )}
          <OtpBoxes value={otp} onChange={setOtp} label="OTP" />

          <View style={{ gap: t.space.x2 }}>
            <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>Verification selfie (required)</Txt>
            <Muted size={t.size.xs}>A quick photo of your face confirms it's really you. We keep it with your identity check.</Muted>
            {selfie && <Image source={{ uri: selfie.uri }} style={{ width: 120, height: 120, borderRadius: t.radius.md, alignSelf: 'flex-start' }} resizeMode="cover" />}
            <Button label={selfie ? 'Retake selfie' : 'Take a selfie'} variant="ghost" onPress={takeSelfie} />
          </View>

          {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
          <Button label="Verify" loading={busy} onPress={verify} />
        </Card>
      )}

      <Muted size={t.size.xs}>Tip: on the demo server, seller@trueglaz.demo is already an approved seller if you want to try consigning right away.</Muted>
    </ScrollView>
  )
}
