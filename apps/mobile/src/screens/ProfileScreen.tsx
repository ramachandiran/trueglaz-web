import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Switch, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, dateOnly, isSeller, money, useApi, useSession, type Theme } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme, useThemeMode, type ThemeMode } from '../theme/ThemeContext'
import { Muted } from '../components/ui'
import { Button, Field } from '../components/form'
import { BottomSheet } from '../components/BottomSheet'
import { API_ORIGIN } from '../config'
import { disablePush, enablePush, pushIsOn, pushSupported } from '../push'
import { Chip, lift } from '../components/kit'

type IconName = React.ComponentProps<typeof Ionicons>['name']
const LIVE = ['pending_payment', 'paid', 'dispatched', 'delivered']

/**
 * Profile (TG-112): who you are, your vault at a glance, three shortcuts, and
 * one grouped list of settings — laid out like the reference the product owner
 * chose, in TrueGlaz's colours and with only things the app really has.
 */
export function ProfileScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { session, signOut } = useSession()
  const { mode, setMode } = useThemeMode()
  const seller = isSeller(session)
  const profile = useApi(() => api.profile(), [])
  const orders = useApi(() => api.myOrders(), [])
  const vault = useApi(() => api.vault(), [])
  const wanted = useApi(() => api.myRequests(), [])
  const items = useApi(() => (seller ? api.myItems() : Promise.resolve(null)), [seller])
  const meta = useApi(() => api.meta(), [])
  const [sheet, setSheet] = useState<'edit' | 'appearance' | 'help' | null>(null)
  const [push, setPush] = useState<boolean | null>(null)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    const refresh = () => {
      profile.reload(); orders.reload(); vault.reload(); wanted.reload()
      pushIsOn().then(setPush).catch(() => setPush(false))
    }
    pushIsOn().then(setPush).catch(() => setPush(false))
    return navigation.addListener('focus', refresh)
  }, [navigation]) // eslint-disable-line react-hooks/exhaustive-deps

  const p = profile.data
  const name = p?.displayName ?? session?.displayName ?? 'You'
  const unread = p?.unreadNotifications ?? 0
  const activeOrders = (orders.data ?? []).filter((o) => LIVE.includes(o.state)).length
  const gear = vault.data ?? []
  const worth = gear.reduce((n, i) => n + (i.valuation?.midMinor ?? i.costMinor ?? 0), 0)
  const insured = gear.filter((i) => i.policy).length
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
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + t.space.x2, paddingBottom: t.space.x7, paddingHorizontal: t.space.x4, gap: t.space.x4 }}>
        <Txt accessibilityRole="header" style={{ color: t.colors.text, fontSize: 34, fontWeight: t.weight.bold as never, letterSpacing: -0.8 }}>Profile</Txt>

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
            <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never }}>Edit</Txt>
          </Pressable>
        </View>

        {/* the vault card, where the reference has its loyalty card */}
        <Pressable onPress={() => navigation.navigate('Vault')} accessibilityRole="button"
          accessibilityLabel={gear.length ? `Gear Vault, worth about ${money(worth)}, ${insured} of ${gear.length} insured` : 'Gear Vault, add your gear'}
          style={[{ backgroundColor: t.colors.brand, borderRadius: 20, padding: 20, overflow: 'hidden', gap: 6 }, lift(t)]}>
          <View style={{ position: 'absolute', right: -40, top: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: t.colors.brandAlt, opacity: 0.6 }} />
          <View style={{ position: 'absolute', right: 30, bottom: -60, width: 130, height: 130, borderRadius: 65, backgroundColor: t.colors.brandAlt, opacity: 0.4 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="shield-checkmark" size={18} color={t.colors.brandAccent} />
            <Txt style={{ color: t.colors.onBrand, fontSize: t.size.md, fontWeight: t.weight.bold as never, letterSpacing: 0.3 }}>TrueGlaz Vault</Txt>
          </View>
          {gear.length ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <Txt style={{ color: t.colors.onBrand, fontSize: 36, fontWeight: t.weight.bold as never, letterSpacing: -1 }}>~{money(worth)}</Txt>
                <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm }}>{gear.length} {gear.length === 1 ? 'item' : 'items'}</Txt>
              </View>
              <Protection t={t} gear={gear} onQuote={(id) => navigation.navigate('Vault', { quoteFor: id })} onOpen={() => navigation.navigate('Vault')} />
            </>
          ) : (
            <>
              <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xl, fontWeight: t.weight.bold as never, marginTop: 6 }}>What is your kit worth?</Txt>
              <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.xs }}>Add your gear: valued from real sales, free</Txt>
            </>
          )}
        </Pressable>

        {/* three shortcuts */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tile t={t} icon="receipt-outline" title="Orders" sub={activeOrders ? `${activeOrders} active` : 'None active'} onPress={() => navigation.navigate('Orders')} />
          <Tile t={t} icon="heart-outline" title="Wishlist" sub={openAsks ? `${openAsks} ${openAsks === 1 ? 'item' : 'items'}` : 'Ask for gear'} onPress={() => navigation.navigate('Wishlist')} />
          <Tile t={t} icon="cube-outline" title="Selling" sub={seller ? (listed ? `${listed} listed` : 'Nothing listed') : 'Start selling'} onPress={() => navigation.navigate('Sell')} />
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
          <Row t={t} icon="help-buoy-outline" title="Help and legal" onPress={() => setSheet('help')} last />
        </View>

        <Pressable onPress={async () => { await disablePush(); await signOut() }} accessibilityRole="button" hitSlop={8}
          style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 24 }}>
          <Txt style={{ color: t.colors.bad, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>Log out</Txt>
        </Pressable>
        <Muted size={t.size.xs} style={{ textAlign: 'center' }}>TrueGlaz · v0.1.0 · {API_ORIGIN.replace(/^https?:\/\//, '')}</Muted>
      </ScrollView>

      {sheet === 'edit' && p && (
        <EditSheet t={t} name={p.displayName} onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); profile.reload() }}
          facts={[
            ['Email', p.email ?? '—'], ['Phone', p.phone ?? '—'],
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

/**
 * The insurance part of the vault card (TG-118): how much gear is not covered,
 * in money, with the next step one tap away; or, when all of it is, a quiet tick.
 */
function Protection({ t, gear, onQuote, onOpen }: {
  t: Theme; gear: import('@trueglaz/core').VaultItem[]; onQuote: (id: string) => void; onOpen: () => void
}) {
  const value = (i: (typeof gear)[number]) => i.valuation?.midMinor ?? i.costMinor ?? 0
  const bare = gear.filter((i) => !i.policy)
  const asked = bare.filter((i) => i.insuranceRequest)
  const open = bare.filter((i) => !i.insuranceRequest)
  const covered = gear.filter((i) => i.policy).reduce((n, i) => n + value(i), 0)
  const atRisk = open.reduce((n, i) => n + value(i), 0)
  const share = gear.length ? Math.round((gear.filter((i) => i.policy).length / gear.length) * 100) : 0

  if (bare.length === 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: 'rgba(82,181,131,0.16)', borderRadius: 14, padding: 12 }}>
        <Ionicons name="shield-checkmark" size={26} color={t.colors.good} />
        <View style={{ flex: 1 }}>
          <Txt style={{ color: t.colors.onBrand, fontWeight: t.weight.bold as never }}>All your gear is insured</Txt>
          <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.xs }}>~{money(covered)} covered</Txt>
        </View>
      </View>
    )
  }
  const biggest = [...open].sort((a, b) => value(b) - value(a))[0]
  return (
    <View style={{ marginTop: 10, backgroundColor: t.colors.bgRaised, borderRadius: 16, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="shield-outline" size={22} color={t.colors.cta} />
        </View>
        <View style={{ flex: 1 }}>
          {open.length > 0 ? (
            <>
              <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>~{money(atRisk)} of your gear isn't insured</Txt>
              <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, marginTop: 2, lineHeight: 17 }}>
                Cover for theft, fire, flood and accidental damage. A licensed agent calls you with a price; nothing to pay now.
              </Txt>
            </>
          ) : (
            <>
              <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>Quote on its way</Txt>
              <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, marginTop: 2 }}>An agent will call you about {asked.length === 1 ? 'your item' : `${asked.length} items`}.</Txt>
            </>
          )}
        </View>
      </View>
      <View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.bgSunken, overflow: 'hidden' }}>
          <View style={{ width: `${share}%`, height: 6, backgroundColor: t.colors.good }} />
        </View>
        <Txt style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 4 }}>
          {gear.length - bare.length} of {gear.length} insured{asked.length && open.length ? ` · ${asked.length} quote${asked.length === 1 ? '' : 's'} on the way` : ''}
        </Txt>
      </View>
      {open.length > 0 && biggest && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => onQuote(biggest.id)} accessibilityRole="button"
            style={{ flex: 1, backgroundColor: t.colors.cta, borderRadius: t.radius.pill, paddingVertical: 11, alignItems: 'center' }}>
            <Txt style={{ color: t.colors.onCta, fontWeight: t.weight.bold as never }}>Get a free quote</Txt>
          </Pressable>
          {open.length > 1 && (
            <Pressable onPress={onOpen} accessibilityRole="button"
              style={{ borderRadius: t.radius.pill, paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1, borderColor: t.colors.border }}>
              <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>See all</Txt>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

function Tile({ t, icon, title, sub, onPress }: { t: Theme; icon: IconName; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${sub}`}
      style={[{ flex: 1, backgroundColor: t.colors.bgRaised, borderRadius: 16, padding: 14, gap: 10, minHeight: 104 }, lift(t)]}>
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

function EditSheet({ t, name, facts, onClose, onSaved }: {
  t: Theme; name: string; facts: [string, string][]; onClose: () => void; onSaved: () => void
}) {
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!value.trim()) { setErr('Enter your name.'); return }
    setBusy(true); setErr(null)
    try { await api.updateProfile(value.trim()); onSaved() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
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
        {facts.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
            <Muted>{k}</Muted>
            <Txt style={{ color: t.colors.text, textTransform: k === 'Identity' ? 'capitalize' : 'none' }}>{v}</Txt>
          </View>
        ))}
      </View>
      <Muted size={t.size.xs}>To change your sign-in email or phone, use Profile on the website: it needs a code sent to the new one.</Muted>
    </BottomSheet>
  )
}

function initials(n: string): string {
  const parts = n.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? 'T') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
