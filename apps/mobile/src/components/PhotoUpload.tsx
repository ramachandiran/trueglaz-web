import { useEffect, useRef } from 'react'
import { Animated, Easing, Image, Pressable, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'
import { MOTION, NATIVE, Pop, useReducedMotion } from './motion'

export type UploadPhase = 'waiting' | 'uploading' | 'done' | 'failed'
export interface UploadStatus { phase: UploadPhase; progress: number }

/**
 * A photo, and how its upload is going (TG-192).
 *
 * Waiting: dimmed with a clock. Uploading: the tile fills from the bottom in
 * the brand orange as the bytes go, a soft light sweeps across it and the
 * percentage counts up. Done: the veil lifts and a green tick pops in with a
 * ring. Failed: a red veil and a retry mark. With "Reduce motion" on, it
 * shows the same states without the movement.
 */
export function PhotoTile({ uri, width = 88, height = 88, status, onRemove, removeLabel, compact }: {
  uri: string; width?: number; height?: number; status?: UploadStatus
  onRemove?: () => void; removeLabel?: string
  /** A small thumbnail: no words, a smaller tick. */
  compact?: boolean
}) {
  const t = useTheme()
  const reduced = useReducedMotion()
  const fill = useRef(new Animated.Value(status?.progress ?? 0)).current
  const veil = useRef(new Animated.Value(status && status.phase !== 'done' ? 1 : 0)).current
  const sweep = useRef(new Animated.Value(0)).current
  const phase = status?.phase

  // The fill follows the progress smoothly rather than in jumps.
  useEffect(() => {
    if (!status) return
    if (reduced) { fill.setValue(status.progress); return }
    Animated.timing(fill, { toValue: status.progress, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start()
  }, [status?.progress, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  // The veil lifts when it is done.
  useEffect(() => {
    const to = phase && phase !== 'done' ? 1 : 0
    if (reduced) { veil.setValue(to); return }
    Animated.timing(veil, { toValue: to, duration: MOTION.slow, delay: to === 0 ? 120 : 0, useNativeDriver: NATIVE }).start()
  }, [phase, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  // A light sweeping across while bytes are moving.
  useEffect(() => {
    if (phase !== 'uploading' || reduced) { sweep.stopAnimation(); return }
    sweep.setValue(0)
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }))
    loop.start()
    return () => loop.stop()
  }, [phase, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  const pct = Math.round((status?.progress ?? 0) * 100)
  const busy = phase === 'waiting' || phase === 'uploading'
  const tick = compact ? 20 : 26
  return (
    <Pop>
      <View accessible accessibilityLabel={phase ? `Photo, ${phase === 'uploading' ? `uploading ${pct}%` : phase === 'done' ? 'uploaded' : phase === 'failed' ? 'upload failed' : 'waiting to upload'}` : 'Photo'}
        style={{ width, height }}>
        <View style={{ width, height, borderRadius: compact ? 10 : 14, overflow: 'hidden', backgroundColor: t.colors.bgSunken }}>
          <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />

          {phase && (
            <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height, opacity: veil }}>
              <View style={{ position: 'absolute', left: 0, top: 0, width, height, backgroundColor: phase === 'failed' ? 'rgba(168,52,42,0.62)' : 'rgba(16,28,36,0.58)' }} />
              {/* The orange rising from the bottom as it uploads. */}
              {phase !== 'failed' && (
                <Animated.View style={{ position: 'absolute', left: 0, top: 0, width, height, backgroundColor: 'rgba(255,107,53,0.42)',
                  transform: [{ translateY: fill.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }} />
              )}
              {phase === 'uploading' && !reduced && (
                <Animated.View style={{ position: 'absolute', top: -height * 0.25, width: 26, height: height * 1.5, backgroundColor: 'rgba(255,255,255,0.22)',
                  transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-40, width + 20] }) }, { rotate: '18deg' }] }} />
              )}
              <View style={{ position: 'absolute', left: 0, top: 0, width, height, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                {phase === 'waiting' && <Ionicons name="time-outline" size={compact ? 14 : 20} color="#fffef3" />}
                {phase === 'uploading' && <Txt maxFontSizeMultiplier={1.2} style={{ color: '#fffef3', fontSize: width > 120 ? 22 : compact ? 11 : 16, fontWeight: t.weight.bold as never }}>{pct}%</Txt>}
                {phase === 'failed' && <Ionicons name="refresh" size={compact ? 16 : 22} color="#fffef3" />}
                {phase === 'waiting' && !compact && <Txt style={{ color: '#fffef3', fontSize: 10 }}>Waiting</Txt>}
              </View>
            </Animated.View>
          )}
        </View>

        {phase === 'done' && (
          <View pointerEvents="none" style={{ position: 'absolute', top: -7, right: -7, width: tick, height: tick, alignItems: 'center', justifyContent: 'center' }}>
            <OncePulse size={tick} color={t.colors.good} />
            <Pop>
              <View style={{ width: tick, height: tick, borderRadius: tick / 2, backgroundColor: t.colors.good, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.colors.bg }}>
                <Ionicons name="checkmark" size={compact ? 11 : 15} color="#fffef3" />
              </View>
            </Pop>
          </View>
        )}

        {onRemove && !busy && phase !== 'done' && (
          <Pressable accessibilityRole="button" accessibilityLabel={removeLabel ?? 'Remove photo'} onPress={onRemove} hitSlop={11}
            style={{ position: 'absolute', top: -6, right: -6, backgroundColor: t.colors.bad, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={14} color="#fffef3" />
          </Pressable>
        )}
      </View>
    </Pop>
  )
}

/**
 * The whole batch at a glance (TG-192): which photo is going, an overall bar
 * that moves continuously (not a jump per photo), and a moment of "all done"
 * before the screen moves on.
 */
export function UploadProgress({ done, total, current, photos }: {
  done: number; total: number; current: number
  /** The photos with their states: shown small inside the card, so the seller (who is down by the button) sees each one go. */
  photos?: { uri: string; status?: UploadStatus }[]
}) {
  const t = useTheme()
  const reduced = useReducedMotion()
  const overall = total ? Math.min(1, (done + current) / total) : 0
  const bar = useRef(new Animated.Value(overall)).current
  const bob = useRef(new Animated.Value(0)).current
  const finished = done >= total && total > 0

  useEffect(() => {
    if (reduced) { bar.setValue(overall); return }
    Animated.timing(bar, { toValue: overall, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: false }).start()
  }, [overall, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (finished || reduced) { bob.setValue(0); return }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(bob, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [finished, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View accessibilityLiveRegion="polite" accessibilityLabel={finished ? 'All photos uploaded' : `Uploading photo ${Math.min(done + 1, total)} of ${total}`}
      style={{ backgroundColor: finished ? t.colors.goodSoft : t.colors.bgRaised, borderWidth: 1, borderColor: finished ? t.colors.good : t.colors.border,
        borderRadius: 16, padding: t.space.x4, gap: t.space.x3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
        <Animated.View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
          backgroundColor: finished ? t.colors.good : t.colors.accentSoft,
          transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}>
          {finished
            ? <Pop><Ionicons name="checkmark" size={22} color="#fffef3" /></Pop>
            : <Ionicons name="cloud-upload-outline" size={21} color={t.colors.accent} />}
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{finished ? 'All photos uploaded' : 'Uploading your photos'}</Txt>
          <Txt style={{ color: finished ? t.colors.good : t.colors.textMuted, fontSize: t.size.xs }}>
            {finished ? `${total} of ${total} safely with us` : `Photo ${Math.min(done + 1, total)} of ${total} · ${Math.round(overall * 100)}%`}
          </Txt>
        </View>
      </View>
      {photos && photos.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
          {photos.map((p, i) => <PhotoTile key={p.uri + i} uri={p.uri} status={p.status} width={48} height={48} compact />)}
        </View>
      )}
      <View style={{ height: 8, borderRadius: 4, backgroundColor: finished ? 'rgba(42,116,76,0.18)' : t.colors.bgSunken, overflow: 'hidden' }}>
        <Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: finished ? t.colors.good : t.colors.cta,
          width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
    </View>
  )
}

/** One ring spreading out and fading: "this just finished", said once. */
function OncePulse({ size, color }: { size: number; color: string }) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) return
    Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start()
  }, [reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  if (reduced) return null
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color,
      opacity: v.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.5, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }] }} />
  )
}
