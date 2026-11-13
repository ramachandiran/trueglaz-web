import { Pressable, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { money, type Theme, type VaultItem } from '@trueglaz/core'
import { Txt } from './Txt'
import { lift } from './kit'
import { PulseRing } from './motion'

/**
 * Gear insurance, at the top of the Vault (TG-118, moved off Profile in TG-121): what is not covered, in rupees, and one
 * tap to a free quote for the most valuable uninsured item. Hidden once
 * everything is insured; the value card says so.
 */
export function InsureBanner({ t, gear, onQuote }: {
  t: Theme; gear: VaultItem[]; onQuote: (id: string) => void
}) {
  const value = (i: (typeof gear)[number]) => i.valuation?.midMinor ?? i.costMinor ?? 0
  const open = gear.filter((i) => !i.policy && !i.insuranceRequest)
  const asked = gear.filter((i) => !i.policy && i.insuranceRequest)
  if (!gear.length || (open.length === 0 && asked.length === 0)) return null

  if (open.length === 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.colors.bgRaised, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: t.colors.border }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.warnSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="call-outline" size={20} color={t.colors.warn} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>Insurance quote on its way</Txt>
          <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>A licensed agent will call you with a price.</Txt>
        </View>
      </View>
    )
  }

  const atRisk = open.reduce((n, i) => n + value(i), 0)
  const biggest = [...open].sort((a, b) => value(b) - value(a))[0]
  return (
    <Pressable onPress={() => onQuote(biggest.id)} accessibilityRole="button"
      accessibilityLabel={`Insure your gear. About ${money(atRisk)} is not insured. Get a free quote.`}
      style={[{ borderRadius: 18, padding: 16, backgroundColor: t.colors.bgRaised, borderWidth: 1.5, borderColor: t.colors.cta, gap: 12 }, lift(t)]}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
          <PulseRing size={52} radius={16} color={t.colors.cta} delay={600} spread={1.35} />
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: t.colors.cta, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="shield-checkmark" size={28} color={t.colors.onCta} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Txt style={{ color: t.colors.accent, fontSize: 11, fontWeight: t.weight.bold as never, letterSpacing: 1 }}>GEAR INSURANCE</Txt>
          <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, marginTop: 1 }}>Protect ~{money(atRisk)}</Txt>
          <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>
            {open.length === 1 ? '1 item is' : `${open.length} items are`} not insured
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {['Theft', 'Fire & flood', 'Accidental damage'].map((c) => (
          <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.colors.bgSunken, borderRadius: t.radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
            <Ionicons name="checkmark" size={13} color={t.colors.good} />
            <Txt style={{ color: t.colors.text, fontSize: t.size.xs }}>{c}</Txt>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.colors.cta, borderRadius: t.radius.pill, paddingVertical: 12, paddingHorizontal: 18 }}>
        <Txt style={{ color: t.colors.onCta, fontWeight: t.weight.bold as never }}>Get a free quote</Txt>
        <Ionicons name="arrow-forward" size={18} color={t.colors.onCta} />
      </View>
      <Txt style={{ color: t.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: -4 }}>A licensed agent calls you with a price. Nothing to pay now.</Txt>
    </Pressable>
  )
}
