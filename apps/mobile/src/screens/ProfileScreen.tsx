import { useEffect } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, dateOnly, isSeller, useApi, useSession, type Theme } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme, useThemeMode, type ThemeMode } from '../theme/ThemeContext'
import { Loading, Muted } from '../components/ui'
import { API_ORIGIN } from '../config'

type IconName = React.ComponentProps<typeof Ionicons>['name']

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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ paddingTop: insets.top + t.space.x3, padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
      {/* identity header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
        <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>{name.slice(0, 1).toUpperCase()}</Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never, letterSpacing: -0.4 }}>{name}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: seller ? t.colors.goodSoft : t.colors.bgSunken, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 10 }}>
              <Txt style={{ color: seller ? t.colors.good : t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>{seller ? 'Seller' : 'Buyer'}</Txt>
            </View>
            {profile.data?.email && <Muted size={t.size.xs}>{profile.data.email}</Muted>}
          </View>
        </View>
      </View>

      <NavRow t={t} icon="notifications-outline" label="Notifications"
        trailing={unread > 0 ? `${unread} new` : undefined} trailingTone="accent"
        onPress={() => navigation.navigate('Notifications')} />

      {profile.loading && !profile.data && <Loading />}

      {profile.data && (
        <Panel t={t} title="Account">
          <Line t={t} label="Email" value={profile.data.email ?? '—'} />
          <Line t={t} label="Phone" value={profile.data.phone ?? '—'} />
          <Line t={t} label="Member since" value={dateOnly(profile.data.memberSince)} />
          <Line t={t} label="Identity" value={profile.data.kycStatus.replace(/_/g, ' ')} last />
        </Panel>
      )}

      <View style={{ gap: t.space.x3 }}>
        <SecLabel t={t}>Manage</SecLabel>
        <NavRow t={t} icon="location-outline" label="Addresses"
          trailing={profile.data ? (profile.data.addressCount > 0 ? `${profile.data.addressCount} saved` : 'None yet') : undefined}
          onPress={() => navigation.navigate('Addresses')} />
        {seller && (
          <NavRow t={t} icon="card-outline" label="Payout account"
            trailing={profile.data ? (profile.data.payoutAccount ? 'Set up' : 'Not set') : undefined}
            trailingTone={profile.data && !profile.data.payoutAccount ? 'warn' : undefined}
            onPress={() => navigation.navigate('PayoutAccount')} />
        )}
      </View>

      <Panel t={t} title="Appearance">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
          {(['dark', 'light', 'system', 'midnight'] as ThemeMode[]).map((m) => {
            const on = mode === m
            return (
              <Pressable key={m} onPress={() => setMode(m)}
                style={{ paddingHorizontal: t.space.x4, paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: on ? t.colors.accent : t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }}>
                <Txt style={{ color: on ? t.colors.onCta : t.colors.text, fontSize: t.size.sm, fontWeight: (on ? t.weight.bold : t.weight.medium) as never, textTransform: 'capitalize' }}>{m}</Txt>
              </Pressable>
            )
          })}
        </View>
      </Panel>

      <Pressable onPress={signOut}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: t.colors.bad, borderRadius: 14, paddingVertical: t.space.x3 }}>
        <Ionicons name="log-out-outline" size={18} color={t.colors.bad} />
        <Txt style={{ color: t.colors.bad, fontWeight: t.weight.bold as never }}>Sign out</Txt>
      </Pressable>

      <Muted size={t.size.xs} style={{ textAlign: 'center' }}>TrueGlaz · v0.1.0 · {API_ORIGIN.replace(/^https?:\/\//, '')}</Muted>
    </ScrollView>
  )
}

function Panel({ t, title, children }: { t: Theme; title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 18, padding: t.space.x4, gap: t.space.x2 }}>
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

function NavRow({ t, icon, label, trailing, trailingTone, onPress }: {
  t: Theme; icon: IconName; label: string; trailing?: string; trailingTone?: 'accent' | 'warn'; onPress: () => void
}) {
  const tc = trailingTone === 'accent' ? t.colors.accent : trailingTone === 'warn' ? t.colors.warn : t.colors.textMuted
  return (
    <Pressable onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 16, padding: 14 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={19} color={t.colors.accent} />
      </View>
      <Txt style={{ flex: 1, color: t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.md }}>{label}</Txt>
      {trailing && (
        trailingTone
          ? <View style={{ backgroundColor: trailingTone === 'accent' ? t.colors.accentSoft : t.colors.warnSoft, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 10 }}>
              <Txt style={{ color: tc, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>{trailing}</Txt>
            </View>
          : <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm }}>{trailing}</Txt>
      )}
      <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
    </Pressable>
  )
}
