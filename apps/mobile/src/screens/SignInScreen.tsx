import { useEffect, useRef, useState } from 'react'
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, useSession, type AuthResult, type Session } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { Button, Field } from '../components/form'
import { OtpBoxes } from '../components/OtpBoxes'
import { CodeTimer } from '../components/CodeTimer'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { Card, Muted } from '../components/ui'
import { useTheme } from '../theme/ThemeContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const looksLikePhone = (s: string) => /^[+()\d][\d\s()+-]{6,}$/.test(s.trim())

type Step = 'contact' | 'code' | 'signup'

/** Used only when an older API does not say how long its code lasts. */
const FALLBACK_CODE_SECONDS = 300
const FALLBACK_RESEND_SECONDS = 60
const native = Platform.OS !== 'web'

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
  const reduced = useReducedMotion()
  const [step, setStep] = useState<Step>('contact')
  const [contact, setContact] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The code's deadline, its result colour, and a counter that re-runs the shake.
  const [deadline, setDeadline] = useState(0)
  const [resendAt, setResendAt] = useState(0)
  const [expired, setExpired] = useState(false)
  const [resending, setResending] = useState(false)
  const [status, setStatus] = useState<'error' | 'success' | undefined>()
  const [shakeKey, setShakeKey] = useState(0)
  const [welcome, setWelcome] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [genreOptions, setGenreOptions] = useState<{ code: string; label: string }[]>([])
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.photographyGenres()
      .then((gs) => setGenreOptions(gs.map((g) => ({ code: g.code, label: g.label }))))
      .catch(() => { /* optional */ })
    return () => { if (clearTimer.current) clearTimeout(clearTimer.current) }
  }, [])

  const startCode = (res: { devCode: string | null; expiresAt: string; expiresInSeconds?: number; resendInSeconds?: number }) => {
    const secs = res.expiresInSeconds
      ?? Math.max(1, Math.round((Date.parse(res.expiresAt) - Date.now()) / 1000) || FALLBACK_CODE_SECONDS)
    setDevCode(res.devCode)
    setDeadline(Date.now() + secs * 1000)
    setResendAt(Date.now() + (res.resendInSeconds ?? FALLBACK_RESEND_SECONDS) * 1000)
    setExpired(false); setCode(''); setStatus(undefined); setError(null)
  }

  const sendCode = async () => {
    const value = contact.trim()
    if (looksLikePhone(value)) { setError("Phone sign-in isn't available yet. Use your email."); return }
    if (!EMAIL_RE.test(value)) { setError('Enter a valid email address.'); return }
    setError(null); setBusy(true)
    try {
      const res = await api.requestCode(value)
      startCode(res); setEmail(value); setStep('code')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const resend = async () => {
    setResending(true)
    try { startCode(await api.requestCode(contact.trim())) }
    catch (e) { setError((e as Error).message) }
    finally { setResending(false) }
  }

  /** Wrong code: red, shake, then empty boxes ready for another go. The message stays. */
  const fail = (message: string) => {
    setError(message); setStatus('error'); setShakeKey((k) => k + 1)
    if (/expired/i.test(message)) setExpired(true)
    if (clearTimer.current) clearTimeout(clearTimer.current)
    clearTimer.current = setTimeout(() => { setCode(''); setStatus(undefined) }, 700)
  }

  /** Right code: green boxes, the tick, then in. Short — it is a confirmation, not a show. */
  const succeed = (session: Session, title: string) => {
    setStatus('success'); setError(null); setWelcome(title)
    setTimeout(() => { signIn(session).catch((e) => { setWelcome(null); setStatus(undefined); setError((e as Error).message) }) }, reduced ? 350 : 900)
  }

  const verify = async (typed?: string) => {
    const c = (typed ?? code).trim()
    if (expired) { setError('That code has expired. Ask for a new one.'); return }
    if (c.length < 6) { setError('Enter the 6-digit code from your email.'); return }
    setError(null); setBusy(true)
    try {
      const res = await api.verifyCode(contact.trim(), c)
      if (res.newUser) {
        setStatus('success')
        setTimeout(() => { setStatus(undefined); setStep('signup') }, reduced ? 150 : 450)
        return
      }
      const first = res.user?.displayName?.split(' ')[0]
      succeed(toSession(res), first ? `Welcome back, ${first}` : 'Welcome back')
    } catch (e) { fail((e as Error).message) } finally { setBusy(false) }
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
      succeed(toSession(res), `Welcome to TrueGlaz, ${firstName.trim()}`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const toggleGenre = (c: string) => setGenres((g) => (g.includes(c) ? g.filter((x) => x !== c) : [...g, c]))

  const changeEmail = () => {
    setStep('contact'); setCode(''); setDevCode(null); setError(null); setStatus(undefined); setExpired(false)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.brand }}>
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: t.space.x5, gap: t.space.x6 }}>
        <Entrance reduced={reduced}>
          <Image source={require('../../assets/logo-lockup.png')} accessibilityLabel="TrueGlaz" accessibilityRole="image"
            style={{ width: 208, height: 208 * 300 / 1614, tintColor: t.colors.onBrand, alignSelf: 'center' }} resizeMode="contain" />
        </Entrance>

        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
          <Card style={{ gap: t.space.x4, paddingVertical: t.space.x5 }}>
            {step === 'contact' && (
              <>
                <Title>Sign in or create an account</Title>
                <Field label="Email" value={contact} onChangeText={(v: string) => { setContact(v); setError(null) }} autoCapitalize="none"
                  keyboardType="email-address" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
                  placeholder="you@example.com" onSubmitEditing={sendCode} returnKeyType="send" />
                <Button label="Continue" variant="cta" onPress={sendCode} loading={busy} />
                <Muted size={t.size.xs} style={{ textAlign: 'center' }}>We'll email you a 6-digit code. No password needed.</Muted>
              </>
            )}

            {step === 'code' && (
              <>
                <Title>Enter your code</Title>
                <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <Muted>Sent to <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{contact.trim()}</Txt></Muted>
                  <Pressable onPress={changeEmail} accessibilityRole="button" hitSlop={8}>
                    <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never }}>Change</Txt>
                  </Pressable>
                </View>
                {devCode && (
                  <View style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md, padding: t.space.x3, alignItems: 'center' }}>
                    <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never }}>Demo code: {devCode}</Txt>
                    <Muted size={t.size.xs}>Shown because this demo server sends no email.</Muted>
                  </View>
                )}
                <View style={{ opacity: expired ? 0.45 : 1 }}>
                  <OtpBoxes value={code} label="Sign-in code" showLabel={false} status={status} shakeKey={shakeKey}
                    editable={!expired && !busy && status !== 'success'}
                    onChange={(v) => { setCode(v); setError(null); setStatus(undefined) }}
                    onComplete={(v) => { if (!busy) verify(v) }} />
                </View>
                {status !== 'success' && (
                  <CodeTimer key={deadline} deadline={deadline} resendAt={resendAt} onResend={resend} resending={resending}
                    onExpire={() => { setExpired(true); setStatus(undefined); setError(null) }} />
                )}
                {!expired && <Button label="Verify" variant="cta" onPress={() => verify()} loading={busy} disabled={status === 'success'} />}
              </>
            )}

            {step === 'signup' && (
              <>
                <Title>Create your account</Title>
                <Muted style={{ textAlign: 'center' }}>Your email is verified. A few details to finish.</Muted>
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
                <Button label="Create account" variant="cta" onPress={completeSignUp} loading={busy} />
              </>
            )}

            {error && (
              <Txt style={{ color: t.colors.bad, fontSize: t.size.sm, textAlign: 'center' }} accessibilityLiveRegion="assertive">{error}</Txt>
            )}
          </Card>
        </View>
      </ScrollView>
      {welcome && <SuccessOverlay title={welcome} reduced={reduced} />}
    </KeyboardAvoidingView>
  )
}

function Title({ children }: { children: string }) {
  const t = useTheme()
  return (
    <Txt accessibilityRole="header"
      style={{ color: t.colors.text, fontSize: 22, fontWeight: t.weight.bold as never, textAlign: 'center', letterSpacing: -0.3 }}>
      {children}
    </Txt>
  )
}

/** The logo settles in once, on first open. */
function Entrance({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: reduced ? 0 : 450, useNativeDriver: native }).start() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      {children}
    </Animated.View>
  )
}

/** Signed in: a tick that grows in over the navy, then the app takes over. */
function SuccessOverlay({ title, reduced }: { title: string; reduced: boolean }) {
  const t = useTheme()
  const fade = useRef(new Animated.Value(0)).current
  const pop = useRef(new Animated.Value(reduced ? 1 : 0.3)).current
  const ring = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: native }).start()
    if (reduced) return
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: native }),
      Animated.timing(ring, { toValue: 1, duration: 700, useNativeDriver: native }),
    ]).start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View accessibilityLiveRegion="polite" accessibilityLabel={`Signed in. ${title}`}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.brand, opacity: fade,
        alignItems: 'center', justifyContent: 'center', gap: t.space.x5 }}>
      <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
        {!reduced && (
          <Animated.View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: t.colors.good,
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }} />
        )}
        <Animated.View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: t.colors.good,
          alignItems: 'center', justifyContent: 'center', transform: [{ scale: pop }] }}>
          <Ionicons name="checkmark" size={52} color="#ffffff" />
        </Animated.View>
      </View>
      <Txt style={{ color: t.colors.onBrand, fontSize: 22, fontWeight: t.weight.bold as never, textAlign: 'center' }}>{title}</Txt>
    </Animated.View>
  )
}
