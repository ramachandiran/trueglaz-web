import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Switch, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, dateOnly, isSeller, useApi, useSession, type Theme } from '@trueglaz/core'
import { Txt, useLargeText } from '../components/Txt'
import { useTheme, useThemeMode, type ThemeMode } from '../theme/ThemeContext'
import { Muted } from '../components/ui'
import { Button, Field } from '../components/form'
import { BottomSheet } from '../components/BottomSheet'
import { OtpBoxes } from '../components/OtpBoxes'
import { CodeTimer } from '../components/CodeTimer'
import { API_ORIGIN } from '../config'
import { disablePush, enablePush, pushIsOn, pushSupported } from '../push'
import { Chip, lift, PageTitle } from '../components/kit'

type IconName = React.ComponentProps<typeof Ionicons>['name']
const LIVE = ['pending_payment', 'paid', 'dispatched', 'delivered']

/**
 * Profile (TG-112): who you are, three shortcuts, and
 * one grouped list of settings — laid out like the reference the product owner
 * chose, in TrueGlaz's colours and with only things the app really has.
 */
export function ProfileScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const large = useLargeText()
  const insets = useSafeAreaInsets()
  const { session, signOut } = useSession()
  const { mode, setMode } = useThemeMode()
  const seller = isSeller(session)
  const profile = useApi(() => api.profile(), [])
  const orders = useApi(() => api.myOrders(), [])
  const wanted = useApi(() => api.myRequests(), [])
  const items = useApi(() => (seller ? api.myItems() : Promise.resolve(null)), [seller])
  const meta = useApi(() => api.meta(), [])
  const [sheet, setSheet] = useState<'edit' | 'appearance' | 'help' | null>(null)
  const [push, setPush] = useState<boolean | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const refresh = () => {
      profile.reload(); orders.reload(); wanted.reload()
      pushIsOn().then(setPush).catch(() => setPush(false))
    }
    pushIsOn().then(setPush).catch(() => setPush(false))
    return navigation.addListener('focus', refresh)
  }, [navigation]) // eslint-disable-line react-hooks/exhaustive-deps

  const p = profile.data
  const name = p?.displayName ?? session?.displayName ?? 'You'
  const unread = p?.unreadNotifications ?? 0
  const activeOrders = (orders.data ?? []).filter((o) => LIVE.includes(o.state)).length
  const openAsks = wanted.data?.openCount ?? 0
  const listed = (items.data ?? []).filter((i) => i.currentState === 'LISTED').length

  const togglePush = async (on: boolean) => {
    setPushBusy(true)
    try {
      if (on) await enablePush(true); else await disablePush(true)
      setPush(await pushIsOn())
    } finally { setPushBusy(false) }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      {/* The title stays fixed while the page scrolls under it, like every other tab. */}
      <PageTitle title="Profile" scrolled={scrolled} />
      <ScrollView onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)} scrollEventThrottle={32}
        contentContainerStyle={{ paddingTop: t.space.x2, paddingBottom: t.space.x7, paddingHorizontal: t.space.x4, gap: t.space.x4 }}>

        {/* who you are */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: t.colors.cta, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ color: t.colors.onCta, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>{initials(name)}</Txt>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.lg + 2, fontWeight: t.weight.bold as never }}>{name}</Txt>
            <Muted size={t.size.sm}>{p?.email ?? session?.email ?? ''}</Muted>
          </View>
          <Pressable onPress={() => setSheet('edit')} accessibilityRole="button" accessibilityLabel="Edit profile"
            style={[{ backgroundColor: t.colors.bgRaised, borderRadius: t.radius.pill, paddingVertical: 9, paddingHorizontal: 18 }, lift(t)]}>
            <Txt style={{ color: t.colors.accentText, fontWeight: t.weight.bold as never }}>Edit</Txt>
          </Pressable>
        </View>

        {/* three shortcuts */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Tile t={t} full={large} icon="receipt-outline" title="Orders" sub={activeOrders ? `${activeOrders} active` : 'None active'} onPress={() => navigation.navigate('Orders')} />
          <Tile t={t} full={large} icon="heart-outline" title="Wishlist" sub={openAsks ? `${openAsks} ${openAsks === 1 ? 'item' : 'items'}` : 'Ask for gear'} onPress={() => navigation.navigate('Wishlist')} />
          <Tile t={t} full={large} icon="cube-outline" title="Selling" sub={seller ? (listed ? `${listed} listed` : 'Nothing listed') : 'Start selling'} onPress={() => navigation.navigate('Sell')} />
        </View>

        {/* settings */}
        <View style={[{ backgroundColor: t.colors.bgRaised, borderRadius: 16, paddingHorizontal: 14 }, lift(t)]}>
          <Row t={t} icon="location-outline" title="Addresses" value={p ? (p.addressCount ? `${p.addressCount} saved` : 'None yet') : undefined} onPress={() => navigation.navigate('Addresses')} />
          {seller && (
            <Row t={t} icon="card-outline" title="Payout account"
              value={p ? (p.payoutAccount ? (p.payoutAccount.method === 'upi' ? 'UPI' : `Bank ··${p.payoutAccount.accountLast4 ?? ''}`) : 'Not set') : undefined}
              onPress={() => navigation.navigate('PayoutAccount')} />
          )}
          <Row t={t} icon="mail-unread-outline" title="Notifications" onPress={() => navigation.navigate('Notifications')}
            right={unread > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: t.colors.cta, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt style={{ color: t.colors.onCta, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>{unread > 99 ? '99+' : unread}</Txt>
                </View>
                <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} />
              </View>
            ) : undefined}
            value={unread > 0 ? undefined : 'All read'} />
          <Row t={t} icon="notifications-outline" title="Push notifications" onPress={() => navigation.navigate('NotificationSettings')}
            right={pushSupported && push !== null ? (
              pushBusy ? <ActivityIndicator color={t.colors.accent} /> : (
                <Switch value={push} onValueChange={togglePush} accessibilityLabel="Push notifications on this phone"
                  trackColor={{ false: t.colors.border, true: t.colors.cta }} thumbColor="#ffffff" />
              )
            ) : undefined} />
          <Row t={t} icon="contrast-outline" title="Appearance" value={mode.slice(0, 1).toUpperCase() + mode.slice(1)} onPress={() => setSheet('appearance')} />
          <Row t={t} icon="help-buoy-outline" title="Help and legal" onPress={() => setSheet('help')} />
          <Row t={t} icon="shield-outline" title="Your data and account" value="Download, delete" onPress={() => navigation.navigate('DeleteAccount')} last />
        </View>

        <Pressable onPress={async () => { await disablePush(); await signOut() }} accessibilityRole="button" hitSlop={8}
          style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 24 }}>
          <Txt style={{ color: t.colors.bad, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>Log out</Txt>
        </Pressable>
        <Muted size={t.size.xs} style={{ textAlign: 'center' }}>TrueGlaz · v0.1.0 · {API_ORIGIN.replace(/^https?:\/\//, '')}</Muted>
      </ScrollView>

      {sheet === 'edit' && p && (
        <EditSheet t={t} name={p.displayName} email={p.email} phone={p.phone} onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); profile.reload() }}
          onContactChanged={() => profile.reload()}
          facts={[
            ['Member since', dateOnly(p.memberSince)], ['Identity', p.kycStatus.replace(/_/g, ' ')],
          ]} />
      )}
      {sheet === 'appearance' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <View style={{ gap: t.space.x3 }}>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Appearance</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
              {(['dark', 'light', 'system', 'midnight'] as ThemeMode[]).map((m) => (
                <Chip key={m} label={m.slice(0, 1).toUpperCase() + m.slice(1)} on={mode === m} onPress={() => setMode(m)} />
              ))}
            </View>
            <Button label="Done" variant="ghost" onPress={() => setSheet(null)} />
          </View>
        </BottomSheet>
      )}
      {sheet === 'help' && (
        <BottomSheet onClose={() => setSheet(null)}>
          <View style={{ gap: t.space.x3 }}>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Help and legal</Txt>
            {meta.data?.support?.email && (
              <Button label={`Email ${meta.data.support.email}`} variant="cta" onPress={() => Linking.openURL(`mailto:${meta.data!.support!.email}`)} />
            )}
            {meta.data?.support?.phone && (
              <Button label={`Call ${meta.data.support.phone}`} variant="ghost" onPress={() => Linking.openURL(`tel:${meta.data!.support!.phone!.replace(/\s/g, '')}`)} />
            )}
            {!meta.data?.support?.email && !meta.data?.support?.phone && <Muted>Contact details will appear here once they are set in the company profile.</Muted>}
            <Muted size={t.size.xs}>
              {meta.data?.support?.legalName ? `${meta.data.support.legalName}. ` : ''}Every unit graded, every defect disclosed.
            </Muted>
            <Button label="Close" variant="ghost" onPress={() => setSheet(null)} />
          </View>
        </BottomSheet>
      )}
    </View>
  )
}

function Tile({ t, icon, title, sub, onPress, full }: { t: Theme; icon: IconName; title: string; sub: string; onPress: () => void; full?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${sub}`}
      style={[{ flex: 1, flexBasis: full ? '100%' : 0, backgroundColor: t.colors.bgRaised, borderRadius: 16, padding: 14, gap: 10, minHeight: 104 }, lift(t)]}>
      <Ionicons name={icon} size={22} color={t.colors.accent} />
      <View>
        <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{title}</Txt>
        <Muted size={t.size.xs}>{sub}</Muted>
      </View>
    </Pressable>
  )
}

function Row({ t, icon, title, value, right, onPress, last }: {
  t: Theme; icon: IconName; title: string; value?: string; right?: React.ReactNode; onPress?: () => void; last?: boolean
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.colors.border }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={t.colors.accent} />
      </View>
      <Txt style={{ flex: 1, color: t.colors.text, fontSize: t.size.md }}>{title}</Txt>
      {value && <Muted size={t.size.sm}>{value}</Muted>}
      {right ?? <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} />}
    </Pressable>
  )
}

function EditSheet({ t, name, email, phone, facts, onClose, onSaved, onContactChanged }: {
  t: Theme; name: string; email: string | null; phone: string | null; facts: [string, string][]
  onClose: () => void; onSaved: () => void; onContactChanged: () => void
}) {
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [changing, setChanging] = useState<'email' | 'phone' | null>(null)
  const save = async () => {
    if (!value.trim()) { setErr('Enter your name.'); return }
    setBusy(true); setErr(null)
    try { await api.updateProfile(value.trim()); onSaved() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const contactRow = (kind: 'email' | 'phone', current: string | null) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Muted size={t.size.xs}>{kind === 'email' ? 'Email' : 'Phone'}</Muted>
        <Txt style={{ color: current ? t.colors.text : t.colors.textMuted }}>{current ?? 'Not added'}</Txt>
      </View>
      <Pressable onPress={() => setChanging(kind)} accessibilityRole="button" hitSlop={10}
        accessibilityLabel={`${current ? 'Change' : 'Add'} ${kind === 'email' ? 'email' : 'phone number'}`}
        style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: t.radius.pill, borderWidth: 1, borderColor: t.colors.border }}>
        <Txt style={{ color: t.colors.accentText, fontWeight: t.weight.bold as never, fontSize: t.size.sm }}>{current ? 'Change' : 'Add'}</Txt>
      </Pressable>
    </View>
  )
  if (changing) {
    return (
      <ContactChange t={t} kind={changing} current={changing === 'email' ? email : phone}
        onClose={() => setChanging(null)} onDone={() => { setChanging(null); onContactChanged() }} />
    )
  }
  return (
    <BottomSheet onClose={onClose} scroll footer={<>
      <Button label="Save" variant="cta" onPress={save} loading={busy} />
      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </>}>
      <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Edit profile</Txt>
      <Field label="Name" value={value} onChangeText={setValue} autoCapitalize="words" returnKeyType="done" onSubmitEditing={save} />
      {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
      <View style={{ gap: 2 }}>
        {contactRow('phone', phone)}
        {contactRow('email', email)}
        {facts.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
            <Muted>{k}</Muted>
            <Txt style={{ color: t.colors.text, textTransform: k === 'Identity' ? 'capitalize' : 'none' }}>{v}</Txt>
          </View>
        ))}
      </View>
      <Muted size={t.size.xs}>Your email and phone both sign you in. Changing one sends a code to the new one first.</Muted>
    </BottomSheet>
  )
}

/**
 * Change the phone number or email that signs you in (TG-154). A code goes to
 * the NEW contact and must come back, which is what proves it is theirs; the
 * old contact is told once it has changed. Indian mobiles can be typed as ten
 * digits; anything else needs its +country code.
 */
function ContactChange({ t, kind, current, onClose, onDone }: {
  t: Theme; kind: 'email' | 'phone'; current: string | null; onClose: () => void; onDone: () => void
}) {
  const [input, setInput] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [deadline, setDeadline] = useState(0)
  const [resendAt, setResendAt] = useState(0)
  const [expired, setExpired] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const contact = (): string | null => {
    const v = input.trim()
    if (kind === 'email') return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v) ? v.toLowerCase() : null
    const digits = v.replace(/[^\d+]/g, '')
    if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits
    const local = digits.replace(/^0+/, '')
    return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null
  }
  const send = async () => {
    const c = contact()
    if (!c) { setErr(kind === 'email' ? 'Enter a valid email address.' : 'Enter a 10-digit mobile number.'); return }
    setBusy(true); setErr(null)
    try {
      const res = await api.requestContactCode(c)
      setSentTo(c); setDevCode(res.devCode ?? null); setCode(res.devCode ?? '')
      setDeadline(Date.now() + (res.expiresInSeconds ?? 300) * 1000)
      setResendAt(Date.now() + (res.resendInSeconds ?? 60) * 1000)
      setExpired(false)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const confirmCode = async () => {
    if (code.replace(/\D/g, '').length < 4) { setErr('Enter the code we sent.'); return }
    setBusy(true); setErr(null)
    try { await api.confirmContact(sentTo!, code.replace(/\D/g, '')); onDone() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const noun = kind === 'email' ? 'email' : 'phone number'
  return (
    <BottomSheet onClose={onClose} scroll footer={<>
      {sentTo && !expired
        ? <Button label={`Confirm new ${noun}`} variant="cta" onPress={confirmCode} loading={busy} />
        : !sentTo && <Button label="Send code" variant="cta" onPress={send} loading={busy} />}
      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </>}>
      <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>
        {current ? `Change ${noun}` : `Add ${noun}`}
      </Txt>
      {current && <Muted size={t.size.sm}>Now: {current}</Muted>}
      {kind === 'phone' ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.space.x2 }}>
          <View style={{ paddingVertical: t.space.x3, paddingHorizontal: t.space.x3, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgSunken }}>
            <Txt style={{ color: t.colors.text }}>+91</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="New mobile number" value={input} onChangeText={(v) => { setInput(v); setSentTo(null) }} editable={!sentTo || expired}
              keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" placeholder="98765 43210" maxLength={16} />
          </View>
        </View>
      ) : (
        <Field label="New email" value={input} onChangeText={(v) => { setInput(v); setSentTo(null) }} editable={!sentTo || expired}
          keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" />
      )}
      {sentTo && (
        <View style={{ gap: t.space.x3 }}>
          <Muted size={t.size.xs}>We sent a code to {sentTo}. Enter it to confirm it is yours.</Muted>
          {devCode && (
            <View style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md, padding: t.space.x3 }}>
              <Txt style={{ color: t.colors.accentText, fontWeight: t.weight.bold as never }}>Demo code: {devCode}</Txt>
            </View>
          )}
          <OtpBoxes value={code} onChange={setCode} label="Verification code" editable={!expired} />
          <CodeTimer key={deadline} deadline={deadline} resendAt={resendAt} onResend={send} resending={busy} align="flex-start"
            onExpire={() => { setExpired(true); setCode('') }} />
        </View>
      )}
      {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
    </BottomSheet>
  )
}

function initials(n: string): string {
  const parts = n.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? 'T') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
