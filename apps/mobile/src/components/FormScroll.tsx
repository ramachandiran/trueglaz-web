import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, type ElementRef } from 'react'
import { Keyboard, Platform, ScrollView, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native'

/**
 * A scroll view that keeps the field being typed in on screen (TG-141, TG-142).
 *
 * Edge to edge, Android no longer resizes the window for the keyboard; the
 * screen's KeyboardAvoidingView pads the bottom instead. The scroll view
 * shrinks, but it does not move, so a field that was in the lower half when
 * it was tapped ends up behind the keyboard (or behind a button pinned above
 * it). Every Field reports its focus here; when the field is out of the
 * visible part of this scroll view — on focus, and again whenever the scroll
 * view changes size because the keyboard came up — it is scrolled just into
 * view with a little room around it.
 *
 * It also lets a tap on a button go through while the keyboard is open
 * (keyboardShouldPersistTaps="handled"): without that, the first tap only put
 * the keyboard away and people pressed Save twice.
 */
type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void; isFocused?: () => boolean }
type Reveal = (input: Measurable | null) => void

const RevealCtx = createContext<Reveal | null>(null)

/** For Field and other inputs: call with the input when it gains focus. */
export function useRevealOnFocus(): Reveal | null { return useContext(RevealCtx) }

const ROOM = 24

type ScrollRef = ElementRef<typeof ScrollView>

export const FormScroll = forwardRef<ScrollRef, ScrollViewProps>(function FormScroll(
  { onScroll, onLayout, children, keyboardShouldPersistTaps = 'handled', scrollEventThrottle = 16, ...rest }, ref,
) {
  const scroll = useRef<ScrollRef>(null)
  const offset = useRef(0)
  const focused = useRef<Measurable | null>(null)
  useImperativeHandle(ref, () => scroll.current as ScrollRef)

  const frame = (cb: (top: number, height: number) => void) => {
    const sv = scroll.current as unknown as Measurable & { getScrollableNode?: () => unknown }
    if (Platform.OS === 'web') {
      const node = sv?.getScrollableNode?.() as HTMLElement | undefined
      if (node?.getBoundingClientRect) { const r = node.getBoundingClientRect(); cb(r.top, Math.min(r.height, window.innerHeight - r.top)); return }
    }
    sv?.measureInWindow?.((_x, y, _w, h) => cb(y, h))
  }

  const run = useCallback(() => {
    const input = focused.current
    if (!input?.measureInWindow || (input.isFocused && !input.isFocused())) return
    frame((top, height) => {
      input.measureInWindow!((_x, y, _w, h) => {
        const visibleTop = top + ROOM
        const visibleBottom = top + height - ROOM
        let delta = 0
        if (y + h > visibleBottom) delta = y + h - visibleBottom
        else if (y < visibleTop) delta = y - visibleTop
        // A field taller than the room left (a long note): show its top.
        if (h > visibleBottom - visibleTop) delta = y - visibleTop
        if (Math.abs(delta) > 2) scroll.current?.scrollTo({ y: Math.max(0, offset.current + delta), animated: true })
      })
    })
  }, [])

  const reveal = useCallback<Reveal>((input) => {
    focused.current = input
    // Once the focus has settled, and once more after the keyboard has finished arriving.
    setTimeout(run, 80)
    setTimeout(run, 420)
  }, [run])

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTimeout(run, 120))
    return () => show.remove()
  }, [run])

  return (
    <RevealCtx.Provider value={reveal}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        scrollEventThrottle={scrollEventThrottle}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { offset.current = e.nativeEvent.contentOffset.y; onScroll?.(e) }}
        // The keyboard arriving shrinks this view: bring the field back into what is left.
        onLayout={(e: LayoutChangeEvent) => { setTimeout(run, 60); onLayout?.(e) }}
        {...rest}
      >
        {children}
      </ScrollView>
    </RevealCtx.Provider>
  )
})
