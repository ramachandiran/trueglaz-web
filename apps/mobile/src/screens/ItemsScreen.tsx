import { useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native'
import { api, dateTime, HAPPY_PATH, money, STATE_LABELS, useApi } from '@trueglaz/core'
import { useTheme } from '../theme/ThemeContext'
import { Card, Empty, ErrorNote, Loading, Muted, StateBadge } from '../components/ui'

/** Tracking: every unit by lifecycle stage. The web rail becomes a chip strip. */
export function ItemsScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const [state, setState] = useState<string | null>(null)
  const { data, error, loading, reload } = useApi((a) => api.items(a), [])

  const byState = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of data ?? []) counts.set(i.currentState, (counts.get(i.currentState) ?? 0) + 1)
    return counts
  }, [data])

  const stages = useMemo(() => {
    const extra = [...byState.keys()].filter((s) => !HAPPY_PATH.includes(s as never))
    return [...HAPPY_PATH, ...extra.sort()].filter((s) => (byState.get(s) ?? 0) > 0)
  }, [byState])

  const visible = useMemo(
    () => (data ?? []).filter((i) => !state || i.currentState === state),
    [data, state],
  )

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: t.space.x3, gap: t.space.x2 }}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: t.colors.border }}
      >
        <Stage label={`All ${data?.length ?? 0}`} selected={state === null} onPress={() => setState(null)} />
        {stages.map((s) => (
          <Stage
            key={s}
            label={`${STATE_LABELS[s] ?? s} ${byState.get(s) ?? 0}`}
            selected={state === s}
            onPress={() => setState(s)}
          />
        ))}
      </ScrollView>

      {loading && <Loading />}
      {error && <View style={{ padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>}

      {!loading && !error && (
        <FlatList
          data={visible}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: t.space.x4, gap: t.space.x3 }}
          ListEmptyComponent={<Empty title="No items in this stage" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('Item', { id: item.id })}>
              <Card style={{ gap: t.space.x2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
                  <Text style={{ color: t.colors.text, fontFamily: t.font.mono, fontWeight: t.weight.medium as never }}>
                    {item.internalSku}
                  </Text>
                  <StateBadge state={item.currentState} />
                </View>
                <Muted size={t.size.xs}>
                  Declared {item.declaredGradeCode}
                  {item.assignedGradeCode ? ` · graded ${item.assignedGradeCode}` : ''}
                  {` · asking ${money(item.askingAmountMinor)} · ${dateTime(item.updatedAt)}`}
                </Muted>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

function Stage({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: t.space.x3,
        paddingVertical: t.space.x2,
        borderRadius: t.radius.pill,
        backgroundColor: selected ? t.colors.accentSoft : t.colors.bgRaised,
        borderWidth: 1,
        borderColor: selected ? t.colors.accent : t.colors.border,
      }}
    >
      <Text style={{ color: selected ? t.colors.accent : t.colors.text, fontSize: t.size.sm }}>{label}</Text>
    </Pressable>
  )
}
