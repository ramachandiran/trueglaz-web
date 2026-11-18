import { useState } from 'react'
import { FormScroll } from '../components/FormScroll'
import { Platform, Share, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, useApi, useSession, type Theme } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { OtpBoxes } from '../components/OtpBoxes'
import { CodeTimer } from '../components/CodeTimer'
import { Button } from '../components/form'
import { Card, ErrorNote, Loading, Muted, SectionTitle } from '../components/ui'
import { FadeIn } from '../components/motion'
import { useTheme } from '../theme/ThemeContext'
import { disablePush } from '../push'
import { setFarewell } from '../farewell'

const ERASED = [
  'Your name, email and phone number',
  'Saved addresses',
  'Vault items, serial numbers and notes',
  'Wishes, saved items and price alerts',
  'Notifications, devices and sign-ins',
  'Identity documents, unless we paid you as a seller',
]
const KEPT = [
  'Orders and invoices: GST law asks us to keep them for 8 years',
  'Payouts and their bank reference, for income tax',
  'Insurance policies, which belong to the insurer',
]

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Your data and account (TG-125): take a copy, or leave.
 *
 * Deleting is deliberately three calm steps, not one red button: see what
 * goes and what stays, get a code, type it. Anything still in flight (an
 * order on its way, money we owe you) is listed first and holds the button,
 * because erasing the person at one end of a live parcel helps nobody.
 */
export function DeleteAccountScreen() {
  const t = useTheme()
  const { signOut } = useSession()
  const status = useApi(() => api.accountDeletion(), [])

  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState<string | null>(null)

  const [sent, setSent] = useState<{ to: string; devCode: string | null } | null>(null)
  const [code, setCode] = useState('')
  const [deadline, setDeadline] = useState(0)
  const [resendAt, setResendAt] = useState(0)
  const [expired, setExpired] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    setExporting(true); setExportNote(null)
    try {
      const data = await api.myData()
      const json = JSON.stringify(data, null, 2)
      const name = `trueglaz-my-data-${new Date().toISOString().slice(0, 10)}.json`
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
        const a = document.createElement('a'); a.href = url; a.download = name; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        setExportNote('Saved to your downloads.')
      } else {
        // The share sheet is the phone's own "save to": Files, Drive, email.
        await Share.share({ title: name, message: json })
      }
    } catch (e) { setExportNote((e as Error).message) } finally { setExporting(false) }
  }

  const sendCode = async () => {
    setError(null); setBusy(true)
    try {
      const res = await api.requestDeletionCode()
      setSent({ to: res.contact, devCode: res.devCode })
      setCode(res.devCode ?? '')
      setDeadline(Date.now() + (res.expiresInSeconds || 300) * 1000)
      setResendAt(Date.now() + (res.resendInSeconds || 60) * 1000)
      setExpired(false)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const confirm = async () => {
    if (code.replace(/\D/g, '').length < 4) { setError('Enter the code we sent you.'); return }
    setError(null); setBusy(true)
    try {
      const res = await api.confirmDeletion(code.replace(/\D/g, ''))
      setFarewell(`Your account will be deleted on ${res.dueAt ? day(res.dueAt) : 'the date in your email'}. Changed your mind? Sign in before then and it is cancelled.`)
      await disablePush().catch(() => {})
      await signOut()
    } catch (e) { setError((e as Error).message); setBusy(false) }
  }

  if (status.loading && !status.data) return <Loading />
  if (status.error) return <ErrorNote error={status.error} onRetry={status.reload} />
  const s = status.data!
  const blocked = s.blockers.length > 0

  return (
    <FormScroll style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}
      keyboardShouldPersistTaps="handled">
      <FadeIn>
        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>Download my data</SectionTitle>
          <Muted>A copy of everything we hold about your account, as one file: profile, addresses, orders, sales, payouts, wishes and settings.</Muted>
          <Button label="Download my data" variant="primary" loading={exporting} onPress={download} />
          {exportNote && <Muted size={t.size.xs}>{exportNote}</Muted>}
        </Card>
      </FadeIn>

      <FadeIn index={1}>
        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>Delete my account</SectionTitle>
          <Muted>
            You get {s.graceDays} days to change your mind. We sign you out everywhere straight away; signing in again before
            the date cancels it. After that it cannot be undone.
          </Muted>

          <List t={t} icon="trash-outline" tone={t.colors.bad} title="What we erase" items={ERASED} />
          <List t={t} icon="archive-outline" tone={t.colors.textMuted} title="What the law makes us keep, without your name" items={KEPT} />

          {blocked && (
            <View style={{ backgroundColor: t.colors.warnSoft, borderRadius: t.radius.md, padding: t.space.x3, gap: t.space.x2 }}>
              <Txt style={{ color: t.colors.warn, fontWeight: t.weight.bold as never }}>Finish these first</Txt>
              {s.blockers.map((b) => (
                <View key={b.code} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Ionicons name="alert-circle" size={16} color={t.colors.warn} style={{ marginTop: 2 }} />
                  <Txt style={{ flex: 1, color: t.colors.warn, fontSize: t.size.sm }}>{b.message} ({b.count})</Txt>
                </View>
              ))}
              <Muted size={t.size.xs}>Once they are done, come back here. Need help sooner? Contact support from Help and legal.</Muted>
            </View>
          )}

          {sent && (
            <View style={{ gap: t.space.x3 }}>
              <Muted size={t.size.xs}>We sent a code to {sent.to}.</Muted>
              {sent.devCode && (
                <View style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md, padding: t.space.x3 }}>
                  <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never }}>Demo code: {sent.devCode}</Txt>
                </View>
              )}
              <OtpBoxes value={code} onChange={(v: string) => { setCode(v); setError(null) }} label="Verification code" editable={!expired} />
              <CodeTimer key={deadline} deadline={deadline} resendAt={resendAt} onResend={sendCode} resending={busy} align="flex-start"
                onExpire={() => { setExpired(true); setCode('') }} />
            </View>
          )}

          {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}

          {!sent
            ? <Button label="Send code to delete my account" variant="danger" disabled={blocked} loading={busy} onPress={sendCode} />
            : !expired && <Button label="Delete my account" variant="danger" loading={busy} onPress={confirm} />}
        </Card>
      </FadeIn>
    </FormScroll>
  )
}

function List({ t, icon, tone, title, items }: { t: Theme; icon: React.ComponentProps<typeof Ionicons>['name']; tone: string; title: string; items: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.sm }}>{title}</Txt>
      {items.map((i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Ionicons name={icon} size={14} color={tone} style={{ marginTop: 3 }} />
          <Txt style={{ flex: 1, color: t.colors.textMuted, fontSize: t.size.sm }}>{i}</Txt>
        </View>
      ))}
    </View>
  )
}
