import { useRef } from 'react'
import {
  Animated, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View,
  type DimensionValue,
} from 'react-native'
import { useTheme } from '../theme/ThemeContext'

/**
 * Every bottom sheet in the app, so they all close the same three ways:
 * tap the dimmed area, swipe the sheet down, or the phone's back button (TG-100).
 *
 * The swipe is caught on the way down (capture), so it works over chips,
 * buttons and fields as well as the grab bar — but only while any scrolling
 * content is at its top, so a long sheet still scrolls up and down normally
 * and only a pull past the top closes it. Starting a swipe, or tapping an
 * empty part of the sheet, puts the keyboard away.
 */
export function BottomSheet({
  visible = true, onClose, children, header, footer, scroll = false, maxHeight = '90%', background, padded = true, gap,
}: {
  visible?: boolean
  onClose: () => void
  children: React.ReactNode
  /** Stays pinned above scrolling content. */
  header?: React.ReactNode
  /** Space between the scrolling children. */
  gap?: number
  /** Stays pinned under scrolling content: the sheet's main actions. */
  footer?: React.ReactNode
  /** Wrap the content in a ScrollView (long sheets). */
  scroll?: boolean
  maxHeight?: DimensionValue
  background?: string
  padded?: boolean
}) {
  const t = useTheme()
  const drag = useRef(new Animated.Value(0)).current
  const scrollTop = useRef(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const settle = () => Animated.spring(drag, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start()
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5 && scrollTop.current <= 0,
    onPanResponderGrant: () => Keyboard.dismiss(),
    onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 0.9) {
        closeRef.current()
        // The modal slides away from where the finger left it; reset for next time.
        setTimeout(() => drag.setValue(0), 350)
      } else settle()
    },
    onPanResponderTerminate: settle,
    onPanResponderTerminationRequest: () => false,
  })).current

  const pad = padded ? t.space.x4 : 0
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,18,26,0.5)' }]} onPress={onClose}
          accessibilityRole="button" accessibilityLabel="Close" />
        <Animated.View
          {...pan.panHandlers}
          // An empty part of the sheet was tapped (nothing deeper wanted it): put the keyboard away.
          onStartShouldSetResponder={() => { Keyboard.dismiss(); return false }}
          style={{
            backgroundColor: background ?? t.colors.bgRaised, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg,
            maxHeight, paddingHorizontal: pad, paddingBottom: pad, transform: [{ translateY: drag }],
          }}>
          <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: padded ? 10 : 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.border }} />
          </View>
          {header}
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" scrollEventThrottle={16}
              onScroll={(e) => { scrollTop.current = e.nativeEvent.contentOffset.y }}
              contentContainerStyle={{ gap: gap ?? t.space.x3, paddingBottom: t.space.x2 }}>
              {children}
            </ScrollView>
          ) : children}
          {footer && <View style={{ gap: 10, paddingTop: t.space.x3 }}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
