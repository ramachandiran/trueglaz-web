import { useEffect } from 'react'
import { Platform, Pressable, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import {
  ActorProvider, api, setApiOrigin, setStorage, useActor, useApi, type Storage,
} from '@trueglaz/core'
import { Txt } from './src/components/Txt'
import { ThemeProvider, useTheme, useThemeMode } from './src/theme/ThemeContext'
import { CatalogScreen } from './src/screens/CatalogScreen'
import { ListingDetailScreen } from './src/screens/ListingDetailScreen'
import { ItemsScreen } from './src/screens/ItemsScreen'
import { ItemDetailScreen } from './src/screens/ItemDetailScreen'

/** The React Native adapter for core's storage port. */
const nativeStorage: Storage = {
  async get(key) {
    try { return await AsyncStorage.getItem(key) } catch { return null }
  },
  async set(key, value) {
    try { await AsyncStorage.setItem(key, value) } catch { /* ignore */ }
  },
  async remove(key) {
    try { await AsyncStorage.removeItem(key) } catch { /* ignore */ }
  },
}
setStorage(nativeStorage)

// Native fetch has no same-origin policy and no dev proxy, so the API's absolute
// origin has to be configured. A simulator cannot reach the host's "localhost";
// set this to the machine's LAN address in app.json when running on a device.
setApiOrigin(
  process.env.EXPO_PUBLIC_API_ORIGIN ??
    (Constants.expoConfig?.extra as { apiOrigin?: string } | undefined)?.apiOrigin ??
    'http://localhost:8080',
)

const Stack = createNativeStackNavigator()
const Tabs = createBottomTabNavigator()

function BrowseStack() {
  const t = useTheme()
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.bgRaised },
        headerTintColor: t.colors.text,
        contentStyle: { backgroundColor: t.colors.bg },
      }}
    >
      <Stack.Screen name="Catalog" component={CatalogScreen} options={{ title: 'Browse' }} />
      <Stack.Screen name="Listing" component={ListingDetailScreen} options={{ title: 'Listing' }} />
      <Stack.Screen name="Item" component={ItemDetailScreen} options={{ title: 'Item' }} />
    </Stack.Navigator>
  )
}

function TrackStack() {
  const t = useTheme()
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.bgRaised },
        headerTintColor: t.colors.text,
        contentStyle: { backgroundColor: t.colors.bg },
      }}
    >
      <Stack.Screen name="Items" component={ItemsScreen} options={{ title: 'Track items' }} />
      <Stack.Screen name="Item" component={ItemDetailScreen} options={{ title: 'Item' }} />
      <Stack.Screen name="Listing" component={ListingDetailScreen} options={{ title: 'Listing' }} />
    </Stack.Navigator>
  )
}

/**
 * Stands in for signing in, exactly as on web: the API identifies callers by
 * header, so the app has to say who it is. Replaced wholesale when OTP lands.
 */
function ActorBar() {
  const t = useTheme()
  const { actor, setActor } = useActor()
  const { mode, setMode } = useThemeMode()
  const { data } = useApi((a) => api.actors(a), [])

  // Without an actor most endpoints refuse, so default to the seeded seller.
  useEffect(() => {
    if (!actor && data?.length) {
      const seller = data.find((h) => h.email?.startsWith('seller')) ?? data[0]
      setActor({ userId: seller.userId, role: seller.suggestedRoleHeader, displayName: seller.displayName })
    }
  }, [actor, data, setActor])

  const cycleActor = () => {
    if (!data?.length) return
    const i = data.findIndex((h) => h.userId === actor?.userId)
    const next = data[(i + 1) % data.length]
    setActor({ userId: next.userId, role: next.suggestedRoleHeader, displayName: next.displayName })
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: t.space.x4,
        paddingVertical: t.space.x2,
        backgroundColor: t.colors.bgSunken,
      }}
    >
      <Pressable onPress={cycleActor}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>
          Acting as {actor?.displayName ?? '…'}{actor ? ` · ${actor.role}` : ''} ⇄
        </Txt>
      </Pressable>
      <Pressable onPress={() => setMode(mode === 'dark' ? 'light' : mode === 'light' ? 'midnight' : 'dark')}>
        <Txt style={{ color: t.colors.accent, fontSize: t.size.xs }}>Theme: {mode}</Txt>
      </Pressable>
    </View>
  )
}

function Shell() {
  const t = useTheme()
  const navTheme = {
    ...(t.name === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.name === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: t.colors.bg,
      card: t.colors.bgRaised,
      text: t.colors.text,
      border: t.colors.border,
      primary: t.colors.accent,
    },
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={t.name === 'dark' ? 'light' : 'dark'} />
      <ActorBar />
      <Tabs.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.colors.accent,
          tabBarInactiveTintColor: t.colors.textMuted,
          tabBarStyle: {
            backgroundColor: t.colors.bgRaised,
            borderTopColor: t.colors.border,
            // Web via react-native-web has no safe-area inset to pad for.
            height: Platform.OS === 'web' ? 56 : undefined,
          },
        }}
      >
        <Tabs.Screen name="Browse" component={BrowseStack} />
        <Tabs.Screen name="Track" component={TrackStack} />
      </Tabs.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ActorProvider>
          <Shell />
        </ActorProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
