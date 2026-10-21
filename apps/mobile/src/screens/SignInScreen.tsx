import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { api, useSession, type AuthResult, type Session } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { Button, Field } from '../components/form'
import { Card, Muted } from '../components/ui'
import { useTheme } from '../theme/ThemeContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const looksLikePhone = (s: string) => /^[+()\d][\d\s()+-]{6,}$/.test(s.trim())

type Step = 'contact' | 'code' | 'signup'

function toSession(r: AuthResult): Session {
  const u = r.user!
  return {
    token: r.token!, expiresAt: r.expiresAt!, userId: u.userId, displayName: u.displayName,
    email: u.email, roles: u.roles, sellerActivatedAt: u.sellerActivatedAt,
  }
}

export function SignInScreen() {
  const t = useTheme()
  const { signIn } = useSession()
  const [step, setStep] = useState<Step>('contact')
  const [contact, setContact] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [genreOptions, setGenreOptions] = useState<{ code: string; label: string }[]>([])

  useEffect(() => {
    api.photographyGenres()
      .then((gs) => setGenreOptions(gs.map((g) => ({ code: g.code, label: g.label }))))
      .catch(() => { /* optional */ })
  }, [])

  const sendCode = async () => {
    const value = contact.trim()
    if (looksLikePhone(value)) { setError("Phone sign-in isn't available yet — use your email."); return }
    if (!EMAIL_RE.test(value)) { setError('Enter a valid email address.'); return }
    setError(null); setBusy(true)
    try {
      const res = await api.requestCode(value)
      setDevCode(res.devCode); setEmail(value); setStep('code')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const verify = async () => {
    if (code.trim().length < 4) { setError('Enter the code from your email.'); return }
    setError(null); setBusy(true)
    try {
      const res = await api.verifyCode(contact.trim(), code.trim())
      if (res.newUser) { setStep('signup'); return }
      await signIn(toSession(res))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const completeSignUp = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError('Tell us your name.'); return }
    if (!EMAIL_RE.test(email.trim())) { setError('Enter a valid email address.'); return }
    if (!looksLikePhone(mobile)) { setError('Enter a valid mobile number.'); return }
    setError(null); setBusy(true)
    try {
      const res = await api.signUp(contact.trim(), code.trim(), {
        firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(),
        mobile: mobile.trim(), photographyGenres: genres,
      })
      await signIn(toSession(res))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const toggleGenre = (c: string) => setGenres((g) => (g.includes(c) ? g.filter((x) => x !== c) : [...g, c]))

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.brand }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: t.space.x5, gap: t.space.x5 }}>
        <View style={{ alignItems: 'center', gap: t.space.x2 }}>
          <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xxl, fontWeight: t.weight.bold as never }}>TrueGlaz</Txt>
          <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.md }}>Buy and sell inspected used gear</Txt>
        </View>

        <Card style={{ gap: t.space.x4 }}>
          {step === 'contact' && (
            <>
              <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Sign in or create an account</Txt>
              <Field label="Email" value={contact} onChangeText={setContact} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} placeholder="you@example.com" onSubmitEditing={sendCode} />
              <Button label="Send code" onPress={sendCode} loading={busy} />
              <Muted>We'll email you a one-time code. No password needed.</Muted>
              <View style={{ borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.x3 }}>
                <Muted>New to TrueGlaz? Enter your email — we'll create your account after the code.</Muted>
              </View>
            </>
          )}

          {step === 'code' && (
            <>
              <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Enter your code</Txt>
              <Muted>Sent to {contact.trim()}.</Muted>
              {devCode && (
                <View style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md, padding: t.space.x3 }}>
                  <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never }}>Demo code: {devCode}</Txt>
                  <Muted size={t.size.xs}>Shown because this is a demo server with no email provider.</Muted>
                </View>
              )}
              <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="______" onSubmitEditing={verify} />
              <Button label="Verify & continue" onPress={verify} loading={busy} />
              <Pressable onPress={() => { setStep('contact'); setCode(''); setDevCode(null) }}>
                <Txt style={{ color: t.colors.accent }}>Use a different email</Txt>
              </Pressable>
            </>
          )}

          {step === 'signup' && (
            <>
              <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Create your account</Txt>
              <Muted>Your email is verified — just a few details to finish.</Muted>
              <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
                <View style={{ flex: 1 }}><Field label="First name" value={firstName} onChangeText={setFirstName} /></View>
                <View style={{ flex: 1 }}><Field label="Last name" value={lastName} onChangeText={setLastName} /></View>
              </View>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
              <Field label="Mobile" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="+91…" />
              {genreOptions.length > 0 && (
                <View style={{ gap: t.space.x2 }}>
                  <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>What do you shoot? (optional)</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
                    {genreOptions.map((g) => {
                      const on = genres.includes(g.code)
                      return (
                        <Pressable key={g.code} onPress={() => toggleGenre(g.code)}
                          style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: on ? t.colors.accentSoft : t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }}>
                          <Txt style={{ color: on ? t.colors.accent : t.colors.text, fontSize: t.size.sm }}>{g.label}</Txt>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              )}
              <Button label="Create account" onPress={completeSignUp} loading={busy} />
            </>
          )}

          {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
