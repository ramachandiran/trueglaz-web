import { uploadPhoto } from '../media/uploadPhoto'
import { FormScroll } from '../components/FormScroll'
import { useEffect, useMemo, useRef, useState, type ElementRef } from 'react'
import { Image, Pressable, ScrollView, Switch, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import type * as ImagePicker from 'expo-image-picker'
import { openSettings, pickPhotos, type PhotoSource } from '../media/pickPhotos'
import { SelectField } from '../components/SelectField'
import { api, useApi, type ProductModel } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Card, Loading, Muted, SectionTitle } from '../components/ui'

/** How many photos one item can carry. */
const MAX_PHOTOS = 12

export function NewItemScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const reasonRef = useRef<ElementRef<typeof TextInput> | null>(null)
  const serialRef = useRef<ElementRef<typeof TextInput> | null>(null)
  // Created on the first save rather than on opening the form (TG-9).
  const submissionId = useRef<string | null>(route.params?.submissionId ?? null)
  // Once the item exists, a retry must not create it again: it only finishes
  // the photo uploads that failed (TG-14).
  const created = useRef<{ id: string; uploaded: number } | null>(null)
  // TG-138: opened from the review page's Edit — the same form, filled in,
  // saving over the draft instead of adding a new one.
  const editItemId: string | null = route.params?.editItemId ?? null
  const editing = useApi(() => (editItemId ? api.item(editItemId) : Promise.resolve(null)), [editItemId])
  const editPhotos = useApi(() => (editItemId ? api.itemMedia(editItemId) : Promise.resolve([])), [editItemId])
  const filled = useRef(false)

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
  const [photoError, setPhotoError] = useState<{ text: string; settings?: boolean } | null>(null)
  const scroller = useRef<{ scrollTo: (o: { y: number; animated?: boolean }) => void } | null>(null)
  const cardY = useRef(0)
  const modelY = useRef(0)

  useEffect(() => { if (editItemId) navigation.setOptions({ title: 'Edit item' }) }, [editItemId, navigation])

  // Fill the form from the draft, once.
  useEffect(() => {
    const it = editing.data?.item
    if (!it || filled.current) return
    filled.current = true
    setCategoryId(it.categoryId); setBrandId(it.brandId)
    setProductModelId(it.productModelId)
    setModelFreeText(it.modelFreeText ?? models.data?.content.find((m) => m.id === it.productModelId)?.name ?? '')
    setDescription((it.description ?? '').replace(/[ \t]*[\r\n]+[ \t]*/g, ' ')); setReasonToSell(it.reasonToSell ?? ''); setSerialNumber(it.serialNumber ?? '')
    setDeclaredGradeCode(it.declaredGradeCode)
    setAsking(String(Math.round(it.askingAmountMinor / 100)))
    setFloor(it.floorAmountMinor != null ? String(Math.round(it.floorAmountMinor / 100)) : '')
    setUnderWarranty(!!it.underWarranty); setHasBill(it.hasBill); setHasBox(it.hasBox); setHasAccessories(it.hasAccessories)
  }, [editing.data, models.data])

  // Default the type to Cameras — the most common consignment — once the
  // categories load, matching the web form.
  useEffect(() => {
    if (editItemId || categoryId || !categories.data) return
    const cam = categories.data.find((c) => c.slug === 'cameras') ?? categories.data.find((c) => /camera/i.test(c.name))
    if (cam) setCategoryId(cam.id)
  }, [categories.data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Camera or library (TG-187): the iPhone library picker has no camera in it.
  const addPhotos = async (source: PhotoSource) => {
    setPhotoError(null)
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) return
    const got = await pickPhotos(source, { multiple: true, limit: room })
    if (got.error) { setPhotoError({ text: got.error, settings: got.needsSettings }); return }
    if (got.assets.length) setPhotos((prev) => [...prev, ...got.assets].slice(0, MAX_PHOTOS))
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
    const body = {
      productModelId, modelFreeText: modelFreeText.trim(), categoryId, brandId,
      description: description.replace(/\s+/g, ' ').trim(), reasonToSell: reasonToSell.replace(/\s+/g, ' ').trim(),
      underWarranty, hasBill, hasBox, hasAccessories,
      serialNumber: serialNumber.trim(), declaredGradeCode,
      askingAmountMinor: askingMinor, floorAmountMinor: floorMinor,
    }
    if (editItemId && !created.current) {
      try {
        await api.updateDraftItem(route.params.submissionId, editItemId, body)
        created.current = { id: editItemId, uploaded: 0 }
      } catch (e) { setError((e as Error).message); setBusy(false); return }
    }
    try {
      if (!created.current) {
        if (!submissionId.current) submissionId.current = (await api.createSubmission('guided')).id
        const item = await api.addItem(submissionId.current, body)
        created.current = { id: item.id, uploaded: 0 }
      }
      const c = created.current
      // Upload any photos onto the new item before leaving, so it never reaches
      // the queue without the pictures the seller meant to send. Resumes where a
      // failed attempt stopped.
      for (let i = c.uploaded; i < photos.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}…`)
        await uploadPhoto(photos[i], { ownerType: 'item', ownerId: c.id, role: 'seller_submission' })
        c.uploaded = i + 1
      }
      setProgress(null)
      // TG-138: the next page is the review — check it, edit it, or submit it.
      if (editItemId) navigation.goBack()
      else navigation.replace('SellerItem', { id: c.id })
    } catch (e) {
      const msg = (e as Error).message
      setError(created.current
        ? `Your item is saved, but a photo didn't upload (${msg}). Tap the button again to finish uploading.`
        : msg)
    } finally { setBusy(false); setProgress(null) }
  }

  if (categories.loading || brands.loading || grades.loading || (editItemId && !editing.data)) {
    return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  }

  return (
    <FormScroll ref={scroller as never} style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Type</SectionTitle>
        <ChipRow options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} selected={categoryId} onSelect={(v) => { setCategoryId(v); setProductModelId(null) }} />
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        {/* A drop-down with search, not a wall of chips (TG-186). */}
        <SelectField label="Brand" title="Choose a brand" placeholder="Choose a brand" value={brandId}
          options={[...(brands.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((b) => ({ value: b.id, label: b.name }))}
          onChange={(v) => { if (v !== brandId) { setBrandId(v); setProductModelId(null) } }} />
      </Card>

      {/* zIndex: the suggestions open upwards over the cards above (TG-138). */}
      <View style={{ zIndex: 10, elevation: 10 }} onLayout={(e) => { cardY.current = e.nativeEvent.layout.y }}>
      <Card style={{ gap: t.space.x3 }}>
        <View style={{ gap: t.space.x1 }} onLayout={(e) => { modelY.current = e.nativeEvent.layout.y }}>
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
        {/* One paragraph each: Enter moves on to the next field instead of adding a line (TG-159). */}
        <Field label="Description" value={description} onChangeText={setDescription} oneParagraph
          onSubmitEditing={() => reasonRef.current?.focus()} placeholder="Condition, shutter count, anything a buyer should know" />
        <Field label="Reason for selling" value={reasonToSell} onChangeText={setReasonToSell} oneParagraph fieldRef={reasonRef}
          onSubmitEditing={() => serialRef.current?.focus()} />
        <Field label="Serial number" value={serialNumber} onChangeText={setSerialNumber} autoCapitalize="characters" fieldRef={serialRef} />
      </Card>
      </View>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Condition you think it is</SectionTitle>
        <ChipRow options={(grades.data ?? []).filter((g) => g.isActive).sort((a, b) => b.rank - a.rank).map((g) => ({ value: g.code, label: g.code }))} selected={declaredGradeCode} onSelect={setDeclaredGradeCode} />
        <Muted size={t.size.xs}>We'll inspect and grade it independently — this is just your estimate.</Muted>
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Photos</SectionTitle>
        {(editPhotos.data?.length ?? 0) > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
            {editPhotos.data!.map((m) => (
              <Image key={m.id} source={{ uri: m.sizes[200] ?? m.url }} style={{ width: 88, height: 88, borderRadius: t.radius.md }} resizeMode="cover" />
            ))}
          </View>
        )}
        <Muted size={t.size.xs}>Add clear photos of the actual item — buyers trust a listing with real pictures.</Muted>
        {photos.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
            {photos.map((p, i) => (
              <View key={p.uri + i} style={{ position: 'relative' }}>
                <Image source={{ uri: p.uri }} style={{ width: 88, height: 88, borderRadius: t.radius.md }} resizeMode="cover" />
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} hitSlop={11}
                  style={{ position: 'absolute', top: -6, right: -6, backgroundColor: t.colors.bad, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt style={{ color: '#fff', fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>✕</Txt>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {photos.length < MAX_PHOTOS ? (
          <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
            <PhotoButton icon="camera-outline" label="Take photo" onPress={() => addPhotos('camera')} />
            <PhotoButton icon="images-outline" label="From library" onPress={() => addPhotos('library')} />
          </View>
        ) : <Muted size={t.size.xs}>That's the maximum of {MAX_PHOTOS} photos.</Muted>}
        {photos.length > 0 && <Muted size={t.size.xs}>{photos.length} of {MAX_PHOTOS} photos added</Muted>}
        {photoError && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, flexWrap: 'wrap' }}>
            <Txt style={{ color: t.colors.bad, fontSize: t.size.sm, flexShrink: 1 }}>{photoError.text}</Txt>
            {photoError.settings && (
              <Pressable onPress={openSettings} accessibilityRole="button" hitSlop={8}>
                <Txt style={{ color: t.colors.accentText, fontSize: t.size.sm, fontWeight: t.weight.bold as never, textDecorationLine: 'underline' }}>Open Settings</Txt>
              </Pressable>
            )}
          </View>
        )}
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
        <Muted size={t.size.xs}>Switch on everything that comes with it. Complete kits sell faster.</Muted>
        <Toggle icon="shield-checkmark-outline" label="Under warranty" hint="The maker's warranty is still running" value={underWarranty} onChange={setUnderWarranty} />
        <Toggle icon="receipt-outline" label="Original bill" hint="The purchase invoice" value={hasBill} onChange={setHasBill} />
        <Toggle icon="cube-outline" label="Original box" hint="The box it came in" value={hasBox} onChange={setHasBox} />
        {/* Not tied to the box any more (TG-189). */}
        <Toggle icon="bag-handle-outline" label="Accessories" hint="Strap, caps, charger and the like, with or without the box" value={hasAccessories} onChange={setHasAccessories} last />
      </Card>

      {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
      {progress && <Muted size={t.size.xs}>{progress}</Muted>}
      <Button label={created.current ? 'Finish uploading photos' : editItemId ? 'Save and review' : 'Review'} variant="cta" loading={busy} onPress={save} />
    </FormScroll>
  )
}

function ModelAutocomplete({
  value, models, brands, brandId, categoryId, onChangeText, onPick, onFocus,
}: {
  value: string
  models: ProductModel[]
  brands: { id: string; name: string }[]
  brandId: string | null
  categoryId: string | null
  onChangeText: (text: string) => void
  onPick: (m: ProductModel) => void
  onFocus?: () => void
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

  // TG-138: the keyboard covers whatever is below the field, so the
  // suggestions open upwards, over the cards above, closest match nearest the
  // finger. The list scrolls inside itself past four rows.
  return (
    <View>
      {open && matches.length > 0 && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: 6, zIndex: 20, elevation: 12,
          borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, overflow: 'hidden', backgroundColor: t.colors.bgRaised,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: t.space.x3, paddingVertical: 6, backgroundColor: t.colors.bgSunken }}>
            <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>{matches.length} MATCH{matches.length === 1 ? '' : 'ES'}</Txt>
            <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close suggestions">
              <Txt style={{ color: t.colors.accentText, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>Close</Txt>
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 4 * 56 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {[...matches].reverse().map((m) => (
              <Pressable accessibilityRole="button" key={m.id} onPress={() => { onPick(m); setOpen(false) }}
                style={({ pressed }) => ({ paddingHorizontal: t.space.x3, paddingVertical: 10, minHeight: 56, justifyContent: 'center',
                  borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: pressed ? t.colors.accentSoft : 'transparent' })}>
                <Txt style={{ color: t.colors.text }}>{m.name}</Txt>
                <Muted size={t.size.xs}>{brandName.get(m.brandId ?? '') ?? ''}</Muted>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      <Field value={value} onChangeText={(x) => { onChangeText(x); setOpen(true) }}
        onFocus={() => { setOpen(true); onFocus?.() }} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Start typing — e.g. R6, 70-200, X-T5" />
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
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: !!on }} key={o.value} onPress={() => onSelect(o.value)}
            style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: on ? t.colors.accentSoft : t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }}>
            <Txt style={{ color: on ? t.colors.accentText : t.colors.text, fontSize: t.size.sm, fontWeight: (on ? t.weight.bold : t.weight.normal) as never }}>{o.label}</Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * One "what's included" choice (TG-188). The switch is drawn so both states
 * show on the cream card: a dark track when off (the old pale one all but
 * disappeared), orange when on, a white knob either way, and iOS's own
 * off colour set to match.
 */
function Toggle({ icon, label, hint, value, onChange, last }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean
}) {
  const t = useTheme()
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} accessibilityHint={hint}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3, paddingVertical: t.space.x3, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.colors.border }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: value ? t.colors.accentSoft : t.colors.bgSunken }}>
        <Ionicons name={icon} size={18} color={value ? t.colors.accent : t.colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={{ color: t.colors.text, fontWeight: t.weight.medium as never }}>{label}</Txt>
        {hint && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{hint}</Txt>}
      </View>
      <Switch value={value} onValueChange={onChange} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        trackColor={{ true: t.colors.cta, false: t.colors.borderInput }} ios_backgroundColor={t.colors.borderInput} thumbColor="#ffffff"
        {...({ activeThumbColor: '#ffffff' } as object) /* the browser build's name for it */} />
    </Pressable>
  )
}

function PhotoButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48,
        borderRadius: t.radius.md, borderWidth: 1.5, borderColor: t.colors.accent, borderStyle: 'dashed',
        backgroundColor: pressed ? t.colors.accentSoft : 'transparent' })}>
      <Ionicons name={icon} size={18} color={t.colors.accent} />
      <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{label}</Txt>
    </Pressable>
  )
}
