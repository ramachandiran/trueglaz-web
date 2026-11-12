import { useState } from 'react'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, ApiError, dateOnly, money, useApi, type BuyerAsk, type MyRequest } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Card, ErrorNote, Loading, Muted } from '../components/ui'
import { Chip, lift } from '../components/kit'

const STATE: Record<string, { label: string; tone: 'good' | 'warn' | 'muted' }> = {
  submitted: { label: 'Being checked', tone: 'warn' },
  published: { label: 'Live', tone: 'good' },
  fulfilled: { label: 'Found', tone: 'good' },
  rejected: { label: 'Not accepted', tone: 'muted' },
  withdrawn: { label: 'Removed', tone: 'muted' },
  expired: { label: 'Expired', tone: 'muted' },
}

/**
 * The buyer's wishlist (TG-117): gear they want that is not in the shop yet.
 * We tell them the moment one comes in at their price and condition, and the
 * same asks show sellers what to send in. Two live at a time.
 */
export function WishlistScreen() {
  const t = useTheme()
  const navigation = useNavigation<any>()
  const mine = useApi(() => api.myRequests(), [])
  const home = useApi(() => api.buyerHome(), [])
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const matchFor = new Map<string, BuyerAsk>((home.data?.asks ?? []).map((a) => [a.id, a]))
  const data = mine.data
  const live = (data?.requests ?? []).filter((r) => r.state === 'submitted' || r.state === 'published')
  const earlier = (data?.requests ?? []).filter((r) => r.state !== 'submitted' && r.state !== 'published').slice(0, 6)

  const remove = (r: MyRequest) => Alert.alert('Remove from wishlist?', r.wanted, [
    { text: 'Keep', style: 'cancel' },
    {
      text: 'Remove', style: 'destructive', onPress: async () => {
        setBusy(r.id)
        try { await api.withdrawRequest(r.id); mine.reload(); home.reload() }
        catch (e) { Alert.alert('Could not remove it', (e as Error).message) }
        finally { setBusy(null) }
      },
    },
  ])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: t.space.x4, gap: t.space.x3, paddingBottom: t.space.x7 }}>
      {mine.error && <ErrorNote error={mine.error} onRetry={mine.reload} />}
      {mine.loading && !data && <Loading />}

      {data && (
        <Muted size={t.size.sm}>
          Tell us what you are after. When one comes in at your price and condition, we let you know first.
        </Muted>
      )}

      {data && live.length === 0 && !adding && (
        <Card style={{ alignItems: 'center', gap: t.space.x2, paddingVertical: t.space.x5 }}>
          <Ionicons name="heart-outline" size={34} color={t.colors.cta} />
          <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>Your wishlist is empty</Txt>
          <Muted size={t.size.sm} style={{ textAlign: 'center' }}>Add a camera or lens you can't find in the shop.</Muted>
        </Card>
      )}

      {live.map((r) => {
        const s = STATE[r.state] ?? { label: r.state, tone: 'muted' as const }
        const m = matchFor.get(r.id)
        const found = (m?.matchCount ?? 0) > 0
        return (
          <View key={r.id} style={[{ backgroundColor: t.colors.bgRaised, borderRadius: 16, padding: 14, gap: 8, borderWidth: found ? 1.5 : 0, borderColor: t.colors.good }, lift(t)]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{r.wanted}</Txt>
                <Muted size={t.size.xs}>
                  {[r.maxPriceMinor ? `Up to ${money(r.maxPriceMinor)}` : 'Any price', r.minGradeLabel ? `${r.minGradeLabel} or better` : 'Any condition'].join(' · ')}
                </Muted>
              </View>
              <Txt style={{ fontSize: t.size.xs, fontWeight: t.weight.bold as never, color: s.tone === 'good' ? t.colors.good : s.tone === 'warn' ? t.colors.warn : t.colors.textMuted }}>{s.label}</Txt>
            </View>
            {found ? (
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Shop', { q: m!.matches[0]?.title ?? r.wanted, at: Date.now() })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.colors.cta, borderRadius: t.radius.pill, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' }}>
                <Ionicons name="sparkles" size={16} color={t.colors.onCta} />
                <Txt style={{ color: t.colors.onCta, fontWeight: t.weight.bold as never }}>
                  {m!.matchCount} in stock{m!.matches.length ? ` · from ${money(Math.min(...m!.matches.map((x) => x.priceMinor)))}` : ''}
                </Txt>
              </Pressable>
            ) : (
              <Muted size={t.size.xs}>
                {r.state === 'submitted' ? 'We check each one before it goes live, usually within a day.'
                  : (m?.nearCount ?? 0) > 0 ? `${m!.nearCount} in stock over your price or below your condition.`
                  : `Not in stock yet.${r.expiresAt ? ` Watching until ${dateOnly(r.expiresAt)}.` : ''}`}
              </Muted>
            )}
            <Pressable onPress={() => remove(r)} disabled={busy === r.id} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
              <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, textDecorationLine: 'underline' }}>{busy === r.id ? 'Removing…' : 'Remove'}</Txt>
            </Pressable>
          </View>
        )
      })}

      {data && (adding
        ? <AddForm slotsLeft={data.slotsLeft} expiryDays={data.expiryDays} onCancel={() => setAdding(false)}
            onDone={() => { setAdding(false); mine.reload(); home.reload() }} />
        : data.slotsLeft > 0
          ? <Button label="Add to wishlist" variant="cta" onPress={() => setAdding(true)} />
          : <Muted size={t.size.xs} style={{ textAlign: 'center' }}>You can wish for {data.limit} things at a time. Remove one to add another.</Muted>)}

      {earlier.length > 0 && (
        <View style={{ gap: 6, marginTop: t.space.x3 }}>
          <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, textTransform: 'uppercase', letterSpacing: 0.6 }}>Earlier</Txt>
          {earlier.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6 }}>
              <Txt numberOfLines={1} style={{ color: t.colors.text, flex: 1 }}>{r.wanted}</Txt>
              <Muted size={t.size.xs}>{STATE[r.state]?.label ?? r.state}</Muted>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

function AddForm({ slotsLeft, expiryDays, onDone, onCancel }: { slotsLeft: number; expiryDays: number; onDone: () => void; onCancel: () => void }) {
  const t = useTheme()
  const grades = useApi(() => api.grades(), [])
  const [wanted, setWanted] = useState('')
  const [price, setPrice] = useState('')
  const [grade, setGrade] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true); setError(null)
    try {
      await api.askFor({
        modelFreeText: wanted.trim(),
        minGradeCode: grade || null,
        maxPriceMinor: price ? Math.round(Number(price.replace(/[^\d.]/g, '')) * 100) : null,
        note: note.trim() || null,
      })
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add that')
    } finally { setBusy(false) }
  }

  return (
    <Card style={{ gap: t.space.x3 }}>
      <Field label="What are you looking for?" value={wanted} onChangeText={setWanted} autoFocus
        placeholder="e.g. Sony 70-200mm f/2.8 GM II" hint={`Make and model is enough. It stays for ${expiryDays} days; ${slotsLeft} ${slotsLeft === 1 ? 'slot' : 'slots'} left.`} />
      <Field label="Your top price (₹, optional)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="₹" />
      <View style={{ gap: 6 }}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>Lowest condition you'd take</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="Any" on={!grade} onPress={() => setGrade('')} />
          {(grades.data ?? []).filter((g) => g.isActive).map((g) => (
            <Chip key={g.code} label={g.label} on={grade === g.code} onPress={() => setGrade(g.code)} />
          ))}
        </View>
      </View>
      <Field label="Anything else (optional)" value={note} onChangeText={setNote} placeholder="e.g. must have the original box" returnKeyType="done" />
      {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
      <Button label="Add to wishlist" variant="cta" loading={busy} disabled={wanted.trim().length < 3} onPress={save} />
      <Button label="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  )
}
