import { useEffect } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, dateOnly, isSeller, useApi, useSession, type Theme } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme, useThemeMode, type ThemeMode } from '../theme/ThemeContext'
import { Loading, Muted } from '../components/ui'
import { API_ORIGIN } from '../config'
import { disablePush } from '../push'
import { Chip, ListRow, PageTitle, lift } from '../components/kit'


export function ProfileScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { session, signOut } = useSession()
  const { mode, setMode } = useThemeMode()
  const profile = useApi(() => api.profile(), [])
  const seller = isSeller(session)
  const unread = profile.data?.unreadNotifications ?? 0
  const name = session?.displayName ?? 'You'

  useEffect(() => navigation.addListener('focus', () => profile.reload()), [navigation]) // eslint-disable-line react-hooks/exhaustive-deps

  const orders = useApi(() => api.myOrders(), [])
  const vault = useApi(() => api.vault(), [])
  const orderCount = orders.data?.length ?? 0
  const vaultCount = vault.data?.length ?? 0
  const addressCount = profile.data?.addressCount ?? 0

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: t.space.x7 }}>
      <PageTitle title="My profile" />

      <View style={{ paddingHorizontal: t.space.x4, gap: t.space.x4 }}>
        {/* who you are */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x4, marginTop: t.space.x4 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>{initials(name)}</Txt>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{name}</Txt>
            {profile.data?.email && <Muted size={t.size.sm}>{profile.data.email}</Muted>}
            <View style={{ alignSelf: 'flex-start', marginTop: 6, backgroundColor: seller ? t.colors.goodSoft : t.colors.bgSunken, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 10 }}>
              <Txt style={{ color: seller ? t.colors.good : t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>{seller ? 'Seller' : 'Buyer'}</Txt>
            </View>
          </View>
        </View>

        {/* places to go */}
        <View>
          <ListRow title="My orders" sub={orderCount ? `Already have ${orderCount} ${orderCount === 1 ? 'order' : 'orders'}` : 'Nothing bought yet'}
            onPress={() => navigation.navigate('Orders')} />
          <ListRow title="Delivery addresses" sub={addressCount ? `${addressCount} ${addressCount === 1 ? 'address' : 'addresses'}` : 'None yet: add one for checkout'}
            onPress={() => navigation.navigate('Addresses')} />
          <ListRow title="Gear Vault" sub={vaultCount ? `${vaultCount} ${vaultCount === 1 ? 'item' : 'items'}, valued from real sales` : 'Track what your kit is worth'}
            onPress={() => navigation.navigate('Vault')} />
          {seller && (
            <ListRow title="Payout account" sub={profile.data ? (profile.data.payoutAccount ? 'Where we pay you for gear you sell' : 'Not set: add one to be paid') : undefined}
              onPress={() => navigation.navigate('PayoutAccount')} />
          )}
          <ListRow title="Notifications" sub={unread > 0 ? `${unread} new — tap to read` : 'All caught up'} badge={unread}
            onPress={() => navigation.navigate('Notifications')} />
          <ListRow title="Notification settings" sub="Push on this phone, and what you hear about"
            onPress={() => navigation.navigate('NotificationSettings')} last />
        </View>

        {profile.loading && !profile.data && <Loading />}

        {profile.data && (
          <Panel t={t} title="Account">
            <Line t={t} label="Email" value={profile.data.email ?? '—'} />
            <Line t={t} label="Phone" value={profile.data.phone ?? '—'} />
            <Line t={t} label="Member since" value={dateOnly(profile.data.memberSince)} />
            <Line t={t} label="Identity" value={profile.data.kycStatus.replace(/_/g, ' ')} last />
          </Panel>
        )}

        <Panel t={t} title="Appearance">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
            {(['dark', 'light', 'system', 'midnight'] as ThemeMode[]).map((m) => (
              <Chip key={m} label={m.slice(0, 1).toUpperCase() + m.slice(1)} on={mode === m} onPress={() => setMode(m)} />
            ))}
          </View>
        </Panel>

        <Pressable onPress={async () => { await disablePush(); await signOut() }} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: t.colors.bad, borderRadius: t.radius.pill, height: 48 }}>
          <Ionicons name="log-out-outline" size={18} color={t.colors.bad} />
          <Txt style={{ color: t.colors.bad, fontWeight: t.weight.bold as never }}>Sign out</Txt>
        </Pressable>

        <Muted size={t.size.xs} style={{ textAlign: 'center' }}>TrueGlaz · v0.1.0 · {API_ORIGIN.replace(/^https?:\/\//, '')}</Muted>
      </View>
    </ScrollView>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? 'T') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

function Panel({ t, title, children }: { t: Theme; title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: t.colors.bgRaised, borderRadius: 14, padding: t.space.x4, gap: t.space.x2, ...lift(t) }}>
      <SecLabel t={t}>{title}</SecLabel>
      {children}
    </View>
  )
}

function SecLabel({ t, children }: { t: Theme; children: React.ReactNode }) {
  return <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 2 }}>{children}</Txt>
}

function Line({ t, label, value, last }: { t: Theme; label: string; value: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.colors.border }}>
      <Muted>{label}</Muted>
      <Txt style={{ color: t.colors.text, fontWeight: t.weight.medium as never, textTransform: label === 'Identity' ? 'capitalize' : 'none' }}>{value}</Txt>
    </View>
  )
}
