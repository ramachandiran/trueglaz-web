import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  api, money, dateOnly, useApi, ApiError,
  type VaultItem, type InsuranceQuote, type InsurancePlan, type ProductModel,
} from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Card, Empty, ErrorNote, Loading, Muted } from '../components/ui'

/** The midpoint estimate, or the purchase cost when there is no valuation yet. */
function estimate(it: VaultItem): number {
  return it.valuation?.midMinor ?? it.purchaseCostMinor ?? 0
}

const WARRANTY_LABEL: Record<VaultItem['warrantyStatus'], string> = {
  active: 'Under warranty', expiring: 'Warranty ending soon', expired: 'Warranty expired', unknown: 'Warranty unknown',
}

export function VaultScreen() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi(() => api.vault(), [])
  const [adding, setAdding] = useState(false)
  const [insuring, setInsuring] = useState<VaultItem | null>(null)

  const items = data ?? []
  const total = useMemo(() => items.reduce((n, it) => n + estimate(it), 0), [items])
  const insured = items.filter((i) => i.policy).length

  function warrantyColor(s: VaultItem['warrantyStatus']) {
    return s === 'active' ? t.colors.good : s === 'expiring' ? t.colors.warn : t.colors.textMuted
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <View style={{ padding: t.space.x4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>Gear Vault</Txt>
        <Button label="+ Add" onPress={() => setAdding(true)} style={{ paddingVertical: t.space.x2 }} />
      </View>

      {loading && !data && <Loading />}
      {error && <View style={{ padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>}

      {data && (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={t.colors.accent} />}
          contentContainerStyle={{ padding: t.space.x4, gap: t.space.x3, paddingBottom: insets.bottom + t.space.x6 }}
          ListHeaderComponent={items.length > 0 ? (
            <View style={{ backgroundColor: t.colors.brand, borderRadius: t.radius.lg, padding: t.space.x4, marginBottom: t.space.x1 }}>
              <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm }}>Estimated market value</Txt>
              <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xxl, fontWeight: t.weight.bold as never }}>~{money(total)}</Txt>
              <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.xs, marginTop: 2 }}>
                {items.length} item{items.length === 1 ? '' : 's'} · {insured} insured · indicative, final price set at a free inspection
              </Txt>
            </View>
          ) : null}
          ListEmptyComponent={<Empty title="Your vault is empty" hint="Add gear you own to track its value, warranty and insurance." />}
          renderItem={({ item }) => {
            const v = item.valuation
            return (
              <Card style={{ flexDirection: 'row', gap: t.space.x3, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{item.modelLabel}</Txt>
                  {item.purchaseCostMinor != null && (
                    <Muted size={t.size.xs}>
                      Bought {money(item.purchaseCostMinor)}{item.purchaseDate ? ` · ${dateOnly(item.purchaseDate)}` : ''}
                      {item.serialLast4 ? ` · ser ••${item.serialLast4}` : ''}
                    </Muted>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: warrantyColor(item.warrantyStatus) }} />
                    <Txt style={{ color: warrantyColor(item.warrantyStatus), fontSize: t.size.xs }}>{WARRANTY_LABEL[item.warrantyStatus]}</Txt>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>
                    {v ? `~${money(v.midMinor)}` : '…'}
                  </Txt>
                  {item.policy ? (
                    <View style={{ backgroundColor: t.colors.goodSoft, borderRadius: t.radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Txt style={{ color: t.colors.good, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>
                        ✓ Insured{!item.policy.live ? ' (demo)' : ''}
                      </Txt>
                    </View>
                  ) : (
                    <Button label="Insure" variant="ghost" onPress={() => setInsuring(item)} style={{ paddingVertical: 6, paddingHorizontal: 12 }} />
                  )}
                </View>
              </Card>
            )
          }}
        />
      )}

      {adding && <AddModal onClose={() => setAdding(false)} onAdded={() => { setAdding(false); reload() }} />}
      {insuring && <InsureModal item={insuring} onClose={() => setInsuring(null)} onBought={() => { setInsuring(null); reload() }} />}
    </View>
  )
}

// -- add gear ------------------------------------------------------------------

function AddModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const t = useTheme()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ProductModel[]>([])
  const [model, setModel] = useState<ProductModel | null>(null)
  const [serial, setSerial] = useState('')
  const [cost, setCost] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function search(text: string) {
    setQ(text); setModel(null)
    if (text.trim().length < 2) { setResults([]); return }
    try { setResults((await api.searchModels(text.trim(), 8)).content) } catch { setResults([]) }
  }

  async function submit() {
    setBusy(true); setErr(null)
    try {
      await api.addGear({
        productModelId: model?.id ?? null,
        modelFreeText: model ? null : q.trim() || null,
        serialNumber: serial.trim() || null,
        purchaseCostMinor: cost ? Math.round(parseFloat(cost) * 100) : null,
        purchaseDate: date.trim() || null,
      })
      onAdded()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not add that') } finally { setBusy(false) }
  }

  const canSave = (model != null || q.trim().length > 1) && !busy

  return (
    <Sheet title="Add gear" onClose={onClose}>
      <Field label="Model" placeholder="Search the catalogue, or type what it is"
        value={model ? model.name : q} onChangeText={search} autoFocus />
      {!model && results.length > 0 && (
        <View style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, overflow: 'hidden' }}>
          {results.map((m) => (
            <Pressable key={m.id} onPress={() => { setModel(m); setResults([]) }}
              style={{ paddingVertical: t.space.x3, paddingHorizontal: t.space.x3, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
              <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>{m.name}</Txt>
            </Pressable>
          ))}
        </View>
      )}
      <Field label="Serial number" placeholder="Kept private & sealed" value={serial} onChangeText={setSerial} />
      <Field label="What you paid (₹)" placeholder="e.g. 130000" keyboardType="numeric" value={cost} onChangeText={setCost} />
      <Field label="Purchase date (YYYY-MM-DD)" placeholder="2024-06-15" value={date} onChangeText={setDate} />
      <Muted size={t.size.xs}>We’ll estimate its value from our market and work out the warranty from the purchase date.</Muted>
      {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
      <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
        <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button label={busy ? 'Adding…' : 'Add to vault'} onPress={submit} disabled={!canSave} loading={busy} style={{ flex: 1 }} />
      </View>
    </Sheet>
  )
}

// -- insure --------------------------------------------------------------------

function InsureModal({ item, onClose, onBought }: { item: VaultItem; onClose: () => void; onBought: () => void }) {
  const t = useTheme()
  const { data: quote, error, loading } = useApi<InsuranceQuote>(() => api.insuranceQuote(item.id), [item.id])
  const [plan, setPlan] = useState('plus')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function buy() {
    setBusy(true); setErr(null)
    try { await api.buyInsurance(item.id, plan, quote?.sumInsuredMinor); onBought() }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not buy cover') } finally { setBusy(false) }
  }

  return (
    <Sheet title={`Insure ${item.modelLabel}`} onClose={onClose}>
      {loading && <Loading />}
      {error && <ErrorNote error={error} />}
      {quote && (
        <>
          <Muted size={t.size.sm}>
            Cover amount ~{money(quote.sumInsuredMinor)} — from your vault estimate.
            {!quote.providerLive ? ' Demo cover: no real policy is issued.' : ''}
          </Muted>
          <View style={{ gap: t.space.x2 }}>
            {quote.plans.map((p: InsurancePlan) => {
              const sel = plan === p.code
              return (
                <Pressable key={p.code} onPress={() => setPlan(p.code)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: t.space.x2,
                    borderWidth: 1.5, borderColor: sel ? t.colors.accent : t.colors.border,
                    backgroundColor: sel ? t.colors.accentSoft : 'transparent',
                    borderRadius: t.radius.md, padding: t.space.x3,
                  }}>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{p.title}</Txt>
                    <Muted size={t.size.xs}>{p.blurb}</Muted>
                  </View>
                  <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{money(p.totalMinor)}/yr</Txt>
                </Pressable>
              )
            })}
          </View>
          <Pressable onPress={() => setAgree(!agree)} style={{ flexDirection: 'row', gap: t.space.x2, alignItems: 'center' }}>
            <View style={{
              width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
              borderColor: agree ? t.colors.brand : t.colors.border, backgroundColor: agree ? t.colors.brand : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {agree && <Txt style={{ color: t.colors.onBrand, fontWeight: t.weight.bold as never }}>✓</Txt>}
            </View>
            <Txt style={{ color: t.colors.text, fontSize: t.size.sm, flex: 1 }}>
              I’ve read the policy wording and am choosing this cover myself.
            </Txt>
          </Pressable>
          <Muted size={t.size.xs}>Underwritten by an IRDAI-licensed insurer · TrueGlaz Protect. Proof of ownership is attached.</Muted>
          {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
          <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
            <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button label={busy ? 'Buying…' : 'Buy cover'} onPress={buy} disabled={!agree || busy} loading={busy} style={{ flex: 1 }} />
          </View>
        </>
      )}
    </Sheet>
  )
}

// -- bits ----------------------------------------------------------------------

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useTheme()
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,30,40,0.45)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: t.colors.bg, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg,
          padding: t.space.x4, maxHeight: '90%',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.space.x3 }}>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{title}</Txt>
            <Pressable onPress={onClose} hitSlop={10}><Txt style={{ color: t.colors.textMuted, fontSize: t.size.xl }}>×</Txt></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: t.space.x3 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
