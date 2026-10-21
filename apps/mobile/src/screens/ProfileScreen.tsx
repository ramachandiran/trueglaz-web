import { useEffect } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, dateOnly, isSeller, useApi, useSession } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme, useThemeMode, type ThemeMode } from '../theme/ThemeContext'
import { Button } from '../components/form'
import { Badge, Card, Loading, Muted, SectionTitle } from '../components/ui'
import { API_ORIGIN } from '../config'

export function ProfileScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { session, signOut } = useSession()
  const { mode, setMode } = useThemeMode()
  const profile = useApi(() => api.profile(), [])
  const seller = isSeller(session)
  const unread = profile.data?.unreadNotifications ?? 0

  // Counts can change on the Addresses / Payout screens, so refresh on return.
  useEffect(() => navigation.addListener('focus', () => profile.reload()), [navigation]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ paddingTop: insets.top + t.space.x3, padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
      <View style={{ gap: t.space.x2 }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.xxl, fontWeight: t.weight.bold as never }}>{session?.displayName ?? 'You'}</Txt>
        <View style={{ flexDirection: 'row', gap: t.space.x2, flexWrap: 'wrap' }}>
          <Badge label={seller ? 'Seller' : 'Buyer'} tone={seller ? 'good' : 'neutral'} />
          {session?.roles.filter((r) => r !== 'buyer' && r !== 'seller').map((r) => <Badge key={r} label={r} />)}
        </View>
      </View>

      <Pressable onPress={() => navigation.navigate('Notifications')}>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
            <Txt style={{ fontSize: 20 }}>🔔</Txt>
            <Txt style={{ color: t.colors.text, fontWeight: t.weight.medium as never }}>Notifications</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2 }}>
            {unread > 0 && <Badge label={`${unread} new`} tone="accent" />}
            <Txt style={{ color: t.colors.textMuted }}>›</Txt>
          </View>
        </Card>
      </Pressable>

      {profile.loading && !profile.data && <Loading />}

      {profile.data && (
        <Card style={{ gap: t.space.x2 }}>
          <SectionTitle>Account</SectionTitle>
          <Line label="Email" value={profile.data.email ?? '—'} />
          <Line label="Phone" value={profile.data.phone ?? '—'} />
          <Line label="Member since" value={dateOnly(profile.data.memberSince)} />
          <Line label="Identity" value={profile.data.kycStatus.replace(/_/g, ' ')} />
        </Card>
      )}

      <View style={{ gap: t.space.x3 }}>
        <SectionTitle>Manage</SectionTitle>
        <NavRow
          icon="📍"
          label="Addresses"
          value={profile.data ? (profile.data.addressCount > 0 ? `${profile.data.addressCount} saved` : 'None yet') : undefined}
          onPress={() => navigation.navigate('Addresses')}
        />
        {seller && (
          <NavRow
            icon="🏦"
            label="Payout account"
            value={profile.data ? (profile.data.payoutAccount ? 'Set up' : 'Not set') : undefined}
            tone={profile.data && !profile.data.payoutAccount ? 'warn' : undefined}
            onPress={() => navigation.navigate('PayoutAccount')}
          />
        )}
      </View>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Appearance</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
          {(['system', 'light', 'dark', 'midnight'] as ThemeMode[]).map((m) => {
            const on = mode === m
            return (
              <Pressable key={m} onPress={() => setMode(m)}
                style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: on ? t.colors.accentSoft : t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }}>
                <Txt style={{ color: on ? t.colors.accent : t.colors.text, fontSize: t.size.sm }}>{m}</Txt>
              </Pressable>
            )
          })}
        </View>
      </Card>

      <Button label="Sign out" variant="danger" onPress={signOut} />

      <Muted size={t.size.xs}>TrueGlaz mobile · v0.1.0 · API {API_ORIGIN}</Muted>
    </ScrollView>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Muted>{label}</Muted>
      <Txt style={{ color: t.colors.text }}>{value}</Txt>
    </View>
  )
}

function NavRow({ icon, label, value, tone, onPress }: { icon: string; label: string; value?: string; tone?: 'warn'; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress}>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
          <Txt style={{ fontSize: 20 }}>{icon}</Txt>
          <Txt style={{ color: t.colors.text, fontWeight: t.weight.medium as never }}>{label}</Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2 }}>
          {value && <Txt style={{ color: tone === 'warn' ? t.colors.warn : t.colors.textMuted, fontSize: t.size.sm }}>{value}</Txt>}
          <Txt style={{ color: t.colors.textMuted }}>›</Txt>
        </View>
      </Card>
    </Pressable>
  )
}
