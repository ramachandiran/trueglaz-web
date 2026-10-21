import { useEffect } from 'react'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import { api, relative, useApi, type Notification } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Badge, Empty, ErrorNote, Loading, Muted } from '../components/ui'

const toneFor = (category: string): 'good' | 'warn' | 'bad' | 'accent' | 'neutral' => {
  switch (category) {
    case 'payouts': return 'good'
    case 'security': return 'bad'
    case 'selling': return 'accent'
    case 'buying': return 'warn'
    default: return 'neutral'
  }
}

export function NotificationsScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const { data, error, loading, reload } = useApi(() => api.notifications(), [])

  useEffect(() => navigation.addListener('focus', reload), [navigation, reload])

  const markOne = (n: Notification) => {
    if (!n.readAt) api.markNotificationRead(n.id).then(reload).catch(() => {})
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
            return (
              <Pressable onPress={() => markOne(n)}>
                <View style={{
                  backgroundColor: unread ? t.colors.accentSoft : t.colors.bgRaised,
                  borderWidth: 1, borderColor: unread ? t.colors.accent : t.colors.border,
                  borderRadius: t.radius.lg, padding: t.space.x3, gap: t.space.x2,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.space.x2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, flex: 1 }}>
                      {unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.accent }} />}
                      <Txt numberOfLines={1} style={{ color: t.colors.text, fontWeight: t.weight.bold as never, flex: 1 }}>{n.title}</Txt>
                    </View>
                    <Badge label={n.category} tone={toneFor(n.category)} />
                  </View>
                  <Muted size={t.size.sm}>{n.body}</Muted>
                  <Muted size={t.size.xs}>{relative(n.at)}</Muted>
                </View>
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}
