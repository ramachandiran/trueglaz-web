import { useState } from 'react'
import { Pressable, ScrollView, Switch, View } from 'react-native'
import { api, useApi } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Card, Loading, Muted, SectionTitle } from '../components/ui'

export function NewItemScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const submissionId: string = route.params.submissionId

  const categories = useApi(() => api.categories(), [])
  const brands = useApi(() => api.brands(), [])
  const grades = useApi(() => api.grades(), [])

  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [modelFreeText, setModelFreeText] = useState('')
  const [description, setDescription] = useState('')
  const [reasonToSell, setReasonToSell] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [declaredGradeCode, setDeclaredGradeCode] = useState<string | null>(null)
  const [asking, setAsking] = useState('')
  const [floor, setFloor] = useState('')
  const [underWarranty, setUnderWarranty] = useState(false)
  const [hasBill, setHasBill] = useState(false)
  const [hasBox, setHasBox] = useState(false)
  const [hasAccessories, setHasAccessories] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const askingMinor = Math.round(Number(asking) * 100)
    const floorMinor = Math.round(Number(floor) * 100)
    if (!categoryId || !brandId) { setError('Pick a type and a brand.'); return }
    if (!modelFreeText.trim()) { setError('Tell us the model.'); return }
    if (!description.trim()) { setError('Add a short description.'); return }
    if (!reasonToSell.trim()) { setError('Why are you selling it?'); return }
    if (!serialNumber.trim()) { setError('The serial number is required.'); return }
    if (!declaredGradeCode) { setError('Pick the condition you think it is.'); return }
    if (!askingMinor || askingMinor <= 0) { setError('Enter an asking price.'); return }
    if (!floorMinor || floorMinor <= 0) { setError('Enter the lowest price you would accept.'); return }
    if (floorMinor > askingMinor) { setError('The floor cannot be above the asking price.'); return }

    setError(null); setBusy(true)
    try {
      const created = await api.addItem(submissionId, {
        modelFreeText: modelFreeText.trim(), categoryId, brandId,
        description: description.trim(), reasonToSell: reasonToSell.trim(),
        underWarranty, hasBill, hasBox, hasAccessories,
        serialNumber: serialNumber.trim(), declaredGradeCode,
        askingAmountMinor: askingMinor, floorAmountMinor: floorMinor,
      })
      // 1:1 flow: land straight on the item (now a draft) to review and submit
      // for pre-approval. replace() so Back goes to the dashboard, not this form.
      navigation.replace('SellerItem', { id: created.id })
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  if (categories.loading || brands.loading || grades.loading) {
    return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Type</SectionTitle>
        <ChipRow options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} selected={categoryId} onSelect={setCategoryId} />
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Brand</SectionTitle>
        <ChipRow options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))} selected={brandId} onSelect={setBrandId} />
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        <Field label="Model" value={modelFreeText} onChangeText={setModelFreeText} placeholder="e.g. Sony A7 III" />
        <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="Condition, shutter count, anything a buyer should know" />
        <Field label="Reason for selling" value={reasonToSell} onChangeText={setReasonToSell} multiline />
        <Field label="Serial number" value={serialNumber} onChangeText={setSerialNumber} autoCapitalize="characters" />
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Condition you think it is</SectionTitle>
        <ChipRow options={(grades.data ?? []).filter((g) => g.isActive).sort((a, b) => b.rank - a.rank).map((g) => ({ value: g.code, label: g.code }))} selected={declaredGradeCode} onSelect={setDeclaredGradeCode} />
        <Muted size={t.size.xs}>We'll inspect and grade it independently — this is just your estimate.</Muted>
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Price (₹)</SectionTitle>
        <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
          <View style={{ flex: 1 }}><Field label="Asking" value={asking} onChangeText={setAsking} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Lowest you'd take" value={floor} onChangeText={setFloor} keyboardType="number-pad" /></View>
        </View>
      </Card>

      <Card style={{ gap: t.space.x1 }}>
        <SectionTitle>What's included</SectionTitle>
        <Toggle label="Under warranty" value={underWarranty} onChange={setUnderWarranty} />
        <Toggle label="Original bill" value={hasBill} onChange={setHasBill} />
        <Toggle label="Original box" value={hasBox} onChange={setHasBox} />
        <Toggle label="Box accessories" value={hasAccessories} onChange={setHasAccessories} />
      </Card>

      {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
      <Button label="Add item" loading={busy} onPress={save} />
    </ScrollView>
  )
}

function ChipRow({ options, selected, onSelect }: { options: { value: string; label: string }[]; selected: string | null; onSelect: (v: string) => void }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
      {options.map((o) => {
        const on = selected === o.value
        return (
          <Pressable key={o.value} onPress={() => onSelect(o.value)}
            style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: on ? t.colors.accentSoft : t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }}>
            <Txt style={{ color: on ? t.colors.accent : t.colors.text, fontSize: t.size.sm }}>{o.label}</Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: t.space.x2 }}>
      <Txt style={{ color: t.colors.text }}>{label}</Txt>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.colors.accent, false: t.colors.border }} thumbColor={t.colors.bgRaised} />
    </View>
  )
}
