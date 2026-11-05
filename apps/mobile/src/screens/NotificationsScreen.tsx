import { useEffect } from 'react'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, relative, useApi, type Notification, type Theme } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Empty, ErrorNote, Loading, Muted } from '../components/ui'
import { openLink, routeForLink } from '../linking'

type IconName = React.ComponentProps<typeof Ionicons>['name']

/** Icon + colour per notification category, so a payout reads differently from a security alert at a glance. */
function categoryStyle(category: string, t: Theme): { icon: IconName; fg: string; bg: string } {
  switch (category) {
    case 'payouts': return { icon: 'cash-outline', fg: t.colors.good, bg: t.colors.goodSoft }
    case 'security': return { icon: 'shield-outline', fg: t.colors.bad, bg: t.colors.badSoft }
    case 'selling': return { icon: 'pricetag-outline', fg: t.colors.accent, bg: t.colors.accentSoft }
    case 'buying': return { icon: 'bag-handle-outline', fg: t.colors.warn, bg: t.colors.warnSoft }
    default: return { icon: 'notifications-outline', fg: t.colors.textMuted, bg: t.colors.bgSunken }
  }
}

export function NotificationsScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const { data, error, loading, reload } = useApi(() => api.notifications(), [])

  useEffect(() => navigation.addListener('focus', reload), [navigation, reload])

  // Tapping opens what it is about, and marks it read on the way.
  const open = (n: Notification) => {
    if (!n.readAt) api.markNotificationRead(n.id).then(reload).catch(() => {})
    openLink(navigation, n.link)
  }
  const markAll = () => { api.markAllNotificationsRead().then(reload).catch(() => {}) }

  const items = data?.items ?? []
  const anyUnread = (data?.unread ?? 0) > 0

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: t.space.x4, paddingBottom: t.space.x2 }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>Notifications</Txt>
        {anyUnread && (
          <Pressable onPress={markAll}>
            <Txt style={{ color: t.colors.accent, fontWeight: t.weight.medium as never }}>Mark all read</Txt>
          </Pressable>
        )}
      </View>

      {loading && !data && <Loading />}
      {error && <View style={{ padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>}

      {data && (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: t.space.x4, paddingTop: t.space.x2, gap: t.space.x3 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={t.colors.accent} />}
          ListEmptyComponent={<Empty title="No notifications" hint="Updates on your orders, items, prices and payouts show up here." />}
          renderItem={({ item: n }) => {
            const unread = !n.readAt
            const cs = categoryStyle(n.category, t)
            return (
              <Pressable onPress={() => open(n)}
                accessibilityRole={routeForLink(n.link) ? 'link' : 'button'}
                style={{
                  flexDirection: 'row', gap: t.space.x3, alignItems: 'flex-start',
                  backgroundColor: unread ? t.colors.bgRaised : t.colors.bg,
                  borderWidth: 1, borderColor: unread ? t.colors.borderStrong : t.colors.border,
                  borderRadius: 16, padding: 14,
                }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: cs.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={cs.icon} size={19} color={cs.fg} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2 }}>
                    <Txt numberOfLines={1} style={{ color: t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.md, flex: 1 }}>{n.title}</Txt>
                    {unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.accent }} />}
                  </View>
                  <Muted size={t.size.sm} style={{ marginTop: 3, lineHeight: 19 }}>{n.body}</Muted>
                  <Muted size={t.size.xs} style={{ marginTop: 5 }}>{relative(n.at)}</Muted>
                </View>
                {routeForLink(n.link) && <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} style={{ alignSelf: 'center' }} />}
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}
