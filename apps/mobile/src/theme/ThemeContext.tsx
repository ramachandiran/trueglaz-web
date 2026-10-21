import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { themes, type Theme, type ThemeName } from '@trueglaz/core'

export type ThemeMode = 'system' | ThemeName

interface Ctx {
  theme: Theme
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
}

const ThemeCtx = createContext<Ctx>({ theme: themes.light, mode: 'system', setMode: () => {} })

const KEY = 'trueglaz.theme'

/**
 * The mobile half of the shared token file.
 *
 * React Native has no CSS variables, so instead of the browser resolving
 * var(--tg-*) this hands the same token object down through context. Replacing
 * the palette is still a change to packages/core/src/theme/tokens.ts alone.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v) setModeState(v as ThemeMode) })
      .catch(() => { /* unreadable storage just means the default */ })
  }, [])

  const value = useMemo<Ctx>(() => {
    const resolved = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode
    return {
      theme: themes[resolved] ?? themes.light,
      mode,
      setMode: (m) => {
        setModeState(m)
        AsyncStorage.setItem(KEY, m).catch(() => {})
      },
    }
  }, [mode, system])

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx).theme
export const useThemeMode = () => useContext(ThemeCtx)
