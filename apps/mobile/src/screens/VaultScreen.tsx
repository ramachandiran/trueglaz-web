import { useEffect, useMemo, useState } from 'react'
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
import {
  isE2eeOn, isUnlocked, lockVault, ensureLoaded, decField, encField,
  enableE2ee, unlockVault, changePin, recoverVault, disableE2ee,
} from '../state/vaultKey'

/** The midpoint estimate, or the purchase cost when there is no valuation yet. */
function estimate(it: VaultItem): number {
  return it.valuation?.midMinor ?? it.costMinor ?? 0
}

/** The sensitive fields as the owner should see them, decrypting if unlocked. */
function shownSerial(it: VaultItem): string | null {
  if (!it.e2ee) return it.serial
  if (it.serialCipher && isUnlocked()) { try { return decField(it.serialCipher) } catch { return null } }
  return null
}
function shownCost(it: VaultItem): number | null {
  if (!it.e2ee) return it.costMinor
  if (it.costCipher && isUnlocked()) {
    try { const n = parseInt(decField(it.costCipher), 10); return Number.isFinite(n) ? n : null } catch { return null }
  }
  return null
}
function hasLockedFields(it: VaultItem): boolean {
  return it.e2ee && !isUnlocked() && (it.serialCipher != null || it.costCipher != null || it.notesCipher != null)
}

type PrivacyMode = 'setup' | 'unlock' | 'change' | 'recover' | 'disable'

const WARRANTY_LABEL: Record<VaultItem['warrantyStatus'], string> = {
  active: 'Under warranty', expiring: 'Warranty ending soon', expired: 'Warranty expired', unknown: 'Warranty unknown',
}

export function VaultScreen() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi(() => api.vault(), [])
  const [adding, setAdding] = useState(false)
  const [insuring, setInsuring] = useState<VaultItem | null>(null)
  const [privacy, setPrivacy] = useState<PrivacyMode | null>(null)
  const [, setPTick] = useState(0)
  const rePrivacy = () => setPTick((n) => n + 1)

  useEffect(() => { ensureLoaded().then(rePrivacy) }, [])

  const e2ee = isE2eeOn()
  const unlocked = isUnlocked()
  const items = data ?? []
  const total = useMemo(() => items.reduce((n, it) => n + estimate(it), 0), [items])
  const insured = items.filter((i) => i.policy).length

  function warrantyColor(s: VaultItem['warrantyStatus']) {
    return s === 'active' ? t.colors.good : s === 'expiring' ? t.colors.warn : t.colors.textMuted
  }

  function afterPrivacy() { setPrivacy(null); rePrivacy(); reload() }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <View style={{ padding: t.space.x4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>Gear Vault</Txt>
        <Button label="+ Add" onPress={() => setAdding(true)} style={{ paddingVertical: t.space.x2 }} />
      </View>

      <View style={{ paddingHorizontal: t.space.x4, paddingBottom: t.space.x2 }}>
        <PrivacyBar
          e2ee={e2ee}
          unlocked={unlocked}
          onSetup={() => setPrivacy('setup')}
          onUnlock={() => setPrivacy('unlock')}
          onRecover={() => setPrivacy('recover')}
          onChange={() => setPrivacy('change')}
          onDisable={() => setPrivacy('disable')}
          onLock={() => { lockVault(); rePrivacy() }}
        />
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
            const cost = shownCost(item)
            const serial = shownSerial(item)
            const locked = hasLockedFields(item)
            return (
              <Card style={{ flexDirection: 'row', gap: t.space.x3, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{item.modelLabel}</Txt>
                  {locked ? (
                    <Txt style={{ color: t.colors.warn, fontSize: t.size.xs, marginTop: 2 }}>🔒 Locked — unlock to see price &amp; serial</Txt>
                  ) : cost != null && (
                    <Muted size={t.size.xs}>
                      Bought {money(cost)}{item.purchaseDate ? ` · ${dateOnly(item.purchaseDate)}` : ''}
                      {serial ? ` · ser ••${serial.slice(-4)}` : ''}
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

      {adding && (
        <AddModal
          e2ee={e2ee}
          unlocked={unlocked}
          onNeedUnlock={() => { setAdding(false); setPrivacy('unlock') }}
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); reload() }}
        />
      )}
      {insuring && <InsureModal item={insuring} onClose={() => setInsuring(null)} onBought={() => { setInsuring(null); reload() }} />}
      {privacy && <PrivacySheet mode={privacy} items={items} onDone={afterPrivacy} onClose={() => setPrivacy(null)} />}
    </View>
  )
}

// -- privacy -------------------------------------------------------------------

function PrivacyBar({ e2ee, unlocked, onSetup, onUnlock, onRecover, onChange, onDisable, onLock }: {
  e2ee: boolean; unlocked: boolean
  onSetup: () => void; onUnlock: () => void; onRecover: () => void
  onChange: () => void; onDisable: () => void; onLock: () => void
}) {
  const t = useTheme()
  const wrap = (border: string, bg: string) => ({
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    gap: t.space.x2, borderWidth: 1, borderColor: border, backgroundColor: bg,
    borderRadius: t.radius.md, paddingVertical: 8, paddingHorizontal: 12,
  })
  if (!e2ee) {
    return (
      <View style={wrap(t.colors.border, t.colors.bgRaised)}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm, flex: 1 }}>🔓 Standard privacy — only you see your details</Txt>
        <Button label="Add a PIN" variant="ghost" onPress={onSetup} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
      </View>
    )
  }
  if (!unlocked) {
    return (
      <View style={wrap(t.colors.warn, t.colors.bgRaised)}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm, flex: 1 }}>🔒 Vault locked</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button label="Unlock" onPress={onUnlock} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
          <Button label="Forgot?" variant="ghost" onPress={onRecover} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
        </View>
      </View>
    )
  }
  return (
    <View style={wrap(t.colors.good, t.colors.bgRaised)}>
      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm, flex: 1 }}>🔓 Unlocked · PIN protected</Txt>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Button label="Lock" variant="ghost" onPress={onLock} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
        <Button label="Change" variant="ghost" onPress={onChange} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
        <Button label="Off" variant="ghost" onPress={onDisable} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
      </View>
    </View>
  )
}

function PrivacySheet({ mode, items, onDone, onClose }: {
  mode: PrivacyMode; items: VaultItem[]; onDone: () => void; onClose: () => void
}) {
  const t = useTheme()
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<string | null>(null)

  const needsNewPin = mode === 'setup' || mode === 'change' || mode === 'recover'
  const pinOk = /^\d{4,}$/.test(pin)
  const title = {
    setup: 'Turn on extra privacy', unlock: 'Unlock your vault', change: 'Change your PIN',
    recover: 'Recover your vault', disable: 'Turn off extra privacy',
  }[mode]

  async function run() {
    setBusy(true); setErr(null)
    try {
      if (needsNewPin && pin !== pin2) throw new Error('PINs do not match')
      if (mode === 'setup') { setRecovery(await enableE2ee(pin, items)); return }
      if (mode === 'change') { setRecovery(await changePin(pin)); return }
      if (mode === 'recover') { setRecovery(await recoverVault(code, pin)); return }
      if (mode === 'unlock') { await unlockVault(pin); onDone(); return }
      if (mode === 'disable') { await disableE2ee(); onDone(); return }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message
        : mode === 'unlock' ? 'That PIN is not right'
        : mode === 'recover' ? 'That recovery code or PIN is not right'
        : (e as Error).message || 'That did not work')
    } finally { setBusy(false) }
  }

  const disabled = busy || (mode === 'unlock' ? pin.length < 4 : needsNewPin ? !pinOk : false) || (mode === 'recover' && !code.trim())

  return (
    <Sheet title={title} onClose={onClose}>
      {recovery ? (
        <>
          <Muted size={t.size.sm}>Save this recovery code somewhere safe. It is the only way back if you forget your PIN — we can’t reset it for you.</Muted>
          <View style={{ backgroundColor: t.colors.bgSunken, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, padding: t.space.x4 }}>
            <Txt selectable style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, textAlign: 'center', letterSpacing: 1 }}>{recovery}</Txt>
          </View>
          <Button label="I’ve saved it" onPress={onDone} />
        </>
      ) : mode === 'disable' ? (
        <>
          <Muted size={t.size.sm}>This clears the encrypted details (serial, price, notes) you can no longer read, and returns the vault to standard encryption. Your items, values and warranties are kept. Use this only if you’ve lost both your PIN and recovery code.</Muted>
          {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
          <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
            <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button label={busy ? 'Working…' : 'Reset & turn off'} onPress={run} loading={busy} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <>
          {mode === 'setup' && <Muted size={t.size.sm}>Your serial numbers, prices and notes will be encrypted with a PIN only you know — not even TrueGlaz can read them. You’ll need it to view those details.</Muted>}
          {mode === 'recover' && (
            <Field label="Recovery code" placeholder="ABCD-EF12-…" value={code} onChangeText={setCode} autoFocus />
          )}
          <Field label={mode === 'unlock' ? 'Vault PIN' : 'New Vault PIN (4+ digits)'} placeholder="••••"
            secureTextEntry keyboardType="numeric" value={pin} onChangeText={setPin} autoFocus={mode === 'unlock'} />
          {needsNewPin && (
            <Field label="Confirm PIN" placeholder="••••" secureTextEntry keyboardType="numeric" value={pin2} onChangeText={setPin2} />
          )}
          {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
          <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
            <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label={busy ? 'Working…' : mode === 'unlock' ? 'Unlock' : mode === 'recover' ? 'Recover' : mode === 'change' ? 'Change PIN' : 'Turn on'}
              onPress={run} disabled={disabled} loading={busy} style={{ flex: 1 }}
            />
          </View>
        </>
      )}
    </Sheet>
  )
}

// -- add gear ------------------------------------------------------------------

function AddModal({ e2ee, unlocked, onNeedUnlock, onClose, onAdded }: {
  e2ee: boolean; unlocked: boolean; onNeedUnlock: () => void; onClose: () => void; onAdded: () => void
}) {
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

  const costMinor = cost ? Math.round(parseFloat(cost) * 100) : null
  const hasPrivate = !!serial.trim() || costMinor != null

  async function submit() {
    // In PIN mode, private fields must be encrypted on this device — that needs the key.
    if (e2ee && hasPrivate && !unlocked) { onNeedUnlock(); return }
    setBusy(true); setErr(null)
    try {
      const base = {
        productModelId: model?.id ?? null,
        modelFreeText: model ? null : q.trim() || null,
        purchaseDate: date.trim() || null,
      }
      if (e2ee) {
        await api.addGear({
          ...base,
          serialCipher: serial.trim() ? encField(serial.trim()) : null,
          costCipher: costMinor != null ? encField(String(costMinor)) : null,
        })
      } else {
        await api.addGear({ ...base, serial: serial.trim() || null, costMinor })
      }
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
      <Field label="Serial number" placeholder={e2ee ? 'Encrypted with your PIN' : 'Kept private & sealed'} value={serial} onChangeText={setSerial} />
      <Field label="What you paid (₹)" placeholder="e.g. 130000" keyboardType="numeric" value={cost} onChangeText={setCost} />
      <Field label="Purchase date (YYYY-MM-DD)" placeholder="2024-06-15" value={date} onChangeText={setDate} />
      <Muted size={t.size.xs}>We’ll estimate its value from our market and work out the warranty from the purchase date.</Muted>
      {e2ee && hasPrivate && !unlocked && <Txt style={{ color: t.colors.warn, fontSize: t.size.xs }}>🔒 Unlock your vault to save the serial and price privately.</Txt>}
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
