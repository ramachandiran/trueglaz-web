import { useEffect, useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, Switch, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { api, useApi, type ProductModel } from '@trueglaz/core'
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
  const models = useApi(() => api.models(), [])

  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [modelFreeText, setModelFreeText] = useState('')
  const [productModelId, setProductModelId] = useState<string | null>(null)
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
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Default the type to Cameras — the most common consignment — once the
  // categories load, matching the web form.
  useEffect(() => {
    if (categoryId || !categories.data) return
    const cam = categories.data.find((c) => c.slug === 'cameras') ?? categories.data.find((c) => /camera/i.test(c.name))
    if (cam) setCategoryId(cam.id)
  }, [categories.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { setError('Allow photo access to add photos.'); return }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 12, quality: 0.7 })
    if (!res.canceled) setPhotos((prev) => [...prev, ...res.assets].slice(0, 12))
  }

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
        productModelId, modelFreeText: modelFreeText.trim(), categoryId, brandId,
        description: description.trim(), reasonToSell: reasonToSell.trim(),
        underWarranty, hasBill, hasBox, hasAccessories,
        serialNumber: serialNumber.trim(), declaredGradeCode,
        askingAmountMinor: askingMinor, floorAmountMinor: floorMinor,
      })
      // Upload any photos onto the new item before leaving, so it never reaches
      // the queue without the pictures the seller meant to send.
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}…`)
        await api.uploadPhotoRN(photos[i], { ownerType: 'item', ownerId: created.id, role: 'seller_submission' })
      }
      setProgress(null)
      // 1:1 flow: land straight on the item (now a draft) to review and submit.
      navigation.replace('SellerItem', { id: created.id })
    } catch (e) { setError((e as Error).message) } finally { setBusy(false); setProgress(null) }
  }

  if (categories.loading || brands.loading || grades.loading) {
    return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Type</SectionTitle>
        <ChipRow options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} selected={categoryId} onSelect={(v) => { setCategoryId(v); setProductModelId(null) }} />
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Brand</SectionTitle>
        <ChipRow options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))} selected={brandId} onSelect={(v) => { setBrandId(v); setProductModelId(null) }} />
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        <View style={{ gap: t.space.x1 }}>
          <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>Model</Txt>
          <ModelAutocomplete
            value={modelFreeText}
            models={models.data?.content ?? []}
            brands={brands.data ?? []}
            brandId={brandId}
            categoryId={categoryId}
            onChangeText={(text) => { setModelFreeText(text); setProductModelId(null) }}
            onPick={(m) => { setModelFreeText(m.name); setProductModelId(m.id); if (m.brandId) setBrandId(m.brandId) }}
          />
        </View>
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
        <SectionTitle>Photos</SectionTitle>
        <Muted size={t.size.xs}>Add clear photos of the actual item — buyers trust a listing with real pictures.</Muted>
        {photos.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
            {photos.map((p, i) => (
              <View key={p.uri + i} style={{ position: 'relative' }}>
                <Image source={{ uri: p.uri }} style={{ width: 88, height: 88, borderRadius: t.radius.md }} resizeMode="cover" />
                <Pressable onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} hitSlop={6}
                  style={{ position: 'absolute', top: -6, right: -6, backgroundColor: t.colors.bad, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt style={{ color: '#fff', fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>✕</Txt>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <Button label={photos.length ? 'Add more photos' : 'Add photos'} variant="ghost" onPress={addPhotos} />
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
      {progress && <Muted size={t.size.xs}>{progress}</Muted>}
      <Button label="Add item" loading={busy} onPress={save} />
    </ScrollView>
  )
}

function ModelAutocomplete({
  value, models, brands, brandId, categoryId, onChangeText, onPick,
}: {
  value: string
  models: ProductModel[]
  brands: { id: string; name: string }[]
  brandId: string | null
  categoryId: string | null
  onChangeText: (text: string) => void
  onPick: (m: ProductModel) => void
}) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands])

  // The catalogue narrowed by what the form already knows, then token-matched on
  // brand + model name — the same matching the web picker does.
  const matches = useMemo(() => {
    const pool = models.filter((m) => (!brandId || m.brandId === brandId) && (!categoryId || m.categoryId === categoryId))
    const tokens = value.toLowerCase().split(/\s+/).filter(Boolean)
    const exactShown = pool.some((m) => m.name.toLowerCase() === value.trim().toLowerCase())
    if (exactShown && tokens.length) return []
    return pool.filter((m) => {
      if (!tokens.length) return true
      const hay = `${brandName.get(m.brandId ?? '') ?? ''} ${m.name}`.toLowerCase()
      return tokens.every((tok) => hay.includes(tok))
    }).slice(0, 8)
  }, [models, brandId, categoryId, value, brandName])

  return (
    <View>
      <Field value={value} onChangeText={(x) => { onChangeText(x); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Start typing — e.g. R6, 70-200, X-T5" />
      {open && matches.length > 0 && (
        <View style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, marginTop: 4, overflow: 'hidden', backgroundColor: t.colors.bgRaised }}>
          {matches.map((m) => (
            <Pressable key={m.id} onPress={() => { onPick(m); setOpen(false) }}
              style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x3, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
              <Txt style={{ color: t.colors.text }}>{m.name}</Txt>
              <Muted size={t.size.xs}>{brandName.get(m.brandId ?? '') ?? ''}</Muted>
            </Pressable>
          ))}
        </View>
      )}
    </View>
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
