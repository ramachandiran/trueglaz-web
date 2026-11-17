/**
 * One message carried across sign-out (TG-125). Confirming a deletion ends
 * every session, so the screen that confirmed it is gone a moment later; the
 * sign-in screen picks this up and tells the person what happens next.
 */
let message: string | null = null

export function setFarewell(m: string) { message = m }

/** Read once: the second sign-in screen of the day should not repeat it. */
export function takeFarewell(): string | null {
  const m = message
  message = null
  return m
}
