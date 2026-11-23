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
        <EditSheet t={t} name={p.displayName} email={p.email} phone={p.phone} memberSince={p.memberSince} kycStatus={p.kycStatus}
          supportEmail={meta.data?.support?.email ?? null} onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); profile.reload() }} />
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

/**
 * Edit profile (TG-177). Two parts that behave differently, so they look
 * different: Your details can be changed here and saved together; Account
 * shows what identifies you and is read-only. The mobile number saves without
 * a code (TG-178); the email that signs you in is not editable here (TG-179).
 */
function EditSheet({ t, name, email, phone, memberSince, kycStatus, supportEmail, onClose, onSaved }: {
  t: Theme; name: string; email: string | null; phone: string | null; memberSince: string | null; kycStatus: string
  supportEmail: string | null; onClose: () => void; onSaved: () => void
}) {
  const [value, setValue] = useState(name)
  const [mobile, setMobile] = useState(phoneForField(phone))
  const [busy, setBusy] = useState(false)
  const [nameErr, setNameErr] = useState<string | null>(null)
  const [phoneErr, setPhoneErr] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const nameChanged = value.trim() !== name.trim()
  const phoneChanged = mobile.replace(/\s/g, '') !== phoneForField(phone).replace(/\s/g, '')
  const dirty = nameChanged || phoneChanged
  const foreign = mobile.trim().startsWith('+')

  const save = async () => {
    const n = value.trim()
    const m = mobile.replace(/[\s-]/g, '')
    let bad = false
    if (n.length < 2) { setNameErr('Enter your name.'); bad = true } else setNameErr(null)
    if (phoneChanged) {
      const ok = foreign ? /^\+[1-9]\d{7,14}$/.test(m) : /^[6-9]\d{9}$/.test(m)
      if (!ok) { setPhoneErr(foreign ? 'Enter the number with its country code, like +44 7911 123456.' : 'Enter a 10-digit mobile number.'); bad = true }
      else setPhoneErr(null)
    }
    if (bad) return
    setBusy(true); setErr(null)
    try {
      if (nameChanged) await api.updateProfile(n)
      if (phoneChanged) {
        try { await api.updatePhone(m) } catch (e) { setPhoneErr((e as Error).message); return }
      }
      onSaved()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const kyc = kycLook(t, kycStatus)
  return (
    <BottomSheet onClose={onClose} scroll footer={<>
      <Button label="Save changes" variant="cta" onPress={save} loading={busy} disabled={!dirty} />
      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </>}>
      <View style={{ alignItems: 'center', gap: t.space.x2, paddingTop: t.space.x1 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.cta, alignItems: 'center', justifyContent: 'center' }}>
          <Txt style={{ color: t.colors.onCta, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>{initials(value || name)}</Txt>
        </View>
        <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Edit profile</Txt>
      </View>

      <SectionLabel t={t} text="Your details" />
      <View style={{ gap: t.space.x3 }}>
        <View style={{ gap: t.space.x1 }}>
          <Field label="Full name" value={value} onChangeText={(v) => { setValue(v); setNameErr(null) }}
            autoCapitalize="words" autoComplete="name" textContentType="name" returnKeyType="next" />
          {nameErr && <Txt style={{ color: t.colors.bad, fontSize: t.size.xs }}>{nameErr}</Txt>}
        </View>
        <View style={{ gap: t.space.x1 }}>
          <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>Mobile number</Txt>
          {/* +91 is fixed, as at sign-up (TG-109); a number typed with + is taken as it is. */}
          <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
            {!foreign && (
              <View style={{ justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderRightWidth: 0, borderColor: t.colors.borderInput,
                borderTopLeftRadius: t.radius.md, borderBottomLeftRadius: t.radius.md, backgroundColor: t.colors.bgSunken }}>
                <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>+91</Txt>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Field value={mobile} onChangeText={(v) => { setMobile(v); setPhoneErr(null) }} keyboardType="phone-pad"
                placeholder="98765 43210" maxLength={18} textContentType="telephoneNumber" autoComplete="tel"
                accessibilityLabel={foreign ? 'Mobile number' : 'Mobile number, after +91'} returnKeyType="done" onSubmitEditing={save}
                style={foreign ? undefined : { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} />
            </View>
          </View>
          {phoneErr
            ? <Txt style={{ color: t.colors.bad, fontSize: t.size.xs }}>{phoneErr}</Txt>
            : <Muted size={t.size.xs}>For order and delivery updates by SMS.</Muted>}
        </View>
      </View>

      <SectionLabel t={t} text="Account" />
      <View style={{ borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bgSunken, paddingHorizontal: t.space.x3 }}>
        <Fact t={t} icon="mail-outline" label="Sign-in email" value={email ?? 'Not added'} trailing={<Ionicons name="lock-closed" size={14} color={t.colors.textMuted} />} />
        <Fact t={t} icon="calendar-outline" label="Member since" value={memberSince ? dateOnly(memberSince) : '—'} />
        <Fact t={t} icon="shield-checkmark-outline" label="Identity" last value=""
          trailing={<View style={{ backgroundColor: kyc.bg, borderRadius: t.radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Txt style={{ color: kyc.fg, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>{kyc.label}</Txt>
          </View>} />
      </View>
      <Muted size={t.size.xs}>
        Your email is how you sign in, so it cannot be changed here.{supportEmail ? ` To change it, write to ${supportEmail}.` : ' To change it, contact support.'}
      </Muted>
      {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
    </BottomSheet>
  )
}

function SectionLabel({ t, text }: { t: Theme; text: string }) {
  return (
    <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 1, textTransform: 'uppercase', marginTop: t.space.x2 }}>
      {text}
    </Txt>
  )
}

function Fact({ t, icon, label, value, trailing, last }: { t: Theme; icon: IconName; label: string; value: string; trailing?: React.ReactNode; last?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.colors.border }}>
      <Ionicons name={icon} size={18} color={t.colors.textMuted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Muted size={t.size.xs}>{label}</Muted>
        {value ? <Txt numberOfLines={1} style={{ color: t.colors.text }}>{value}</Txt> : null}
      </View>
      {trailing}
    </View>
  )
}

/** The number as the field shows it: the ten digits after +91, or a foreign number whole. */
function phoneForField(phone: string | null): string {
  if (!phone) return ''
  return phone.startsWith('+91') ? phone.slice(3) : phone
}

function kycLook(t: Theme, status: string): { label: string; bg: string; fg: string } {
  switch (status) {
    case 'verified': return { label: 'Verified', bg: t.colors.goodSoft, fg: t.colors.good }
    case 'in_review': case 'pending': return { label: 'Under review', bg: t.colors.warnSoft, fg: t.colors.warn }
    case 'rejected': case 'failed': return { label: 'Not accepted', bg: t.colors.badSoft, fg: t.colors.bad }
    default: return { label: 'Not verified', bg: t.colors.bgHover, fg: t.colors.textMuted }
  }
}

function initials(n: string): string {
  const parts = n.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? 'T') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
