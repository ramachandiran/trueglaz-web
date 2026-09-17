import { useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'trueglaz.theme'

/**
 * Sets data-theme on <html>; the token file does the rest. Nothing here knows
 * any colour, so a replacement theme inherits the toggle for free.
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem(KEY) as ThemeMode) ?? 'system'
    } catch {
      return 'system'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', mode)
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      /* storage unavailable — the theme still applies for this session */
    }
  }, [mode])

  return { mode, setMode }
}
