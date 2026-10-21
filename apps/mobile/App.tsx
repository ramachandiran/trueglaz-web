import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  api, setApiOrigin, setStorage, SessionProvider, useApi, useSession, type Storage,
} from '@trueglaz/core'
import { API_ORIGIN } from './src/config'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps } from 'react'
import { Loading } from './src/components/ui'
import { mobileFontAssets, mobileFontFamily } from './src/theme/fonts'
import { ThemeProvider, useTheme } from './src/theme/ThemeContext'
import { SignInScreen } from './src/screens/SignInScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { CatalogScreen } from './src/screens/CatalogScreen'
import { ListingDetailScreen } from './src/screens/ListingDetailScreen'
import { CheckoutScreen } from './src/screens/CheckoutScreen'
import { OrdersScreen } from './src/screens/OrdersScreen'
import { OrderDetailScreen } from './src/screens/OrderDetailScreen'
import { SellScreen } from './src/screens/SellScreen'
import { SellerItemScreen } from './src/screens/SellerItemScreen'
import { SubmissionScreen } from './src/screens/SubmissionScreen'
import { NewItemScreen } from './src/screens/NewItemScreen'
import { StartSellingScreen } from './src/screens/StartSellingScreen'
import { ProfileScreen } from './src/screens/ProfileScreen'
import { NotificationsScreen } from './src/screens/NotificationsScreen'

/** The React Native adapter for core's storage port (web uses localStorage). */
const nativeStorage: Storage = {
  async get(key) { try { return await AsyncStorage.getItem(key) } catch { return null } },
  async set(key, value) { try { await AsyncStorage.setItem(key, value) } catch { /* ignore */ } },
  async remove(key) { try { await AsyncStorage.removeItem(key) } catch { /* ignore */ } },
}
setStorage(nativeStorage)
setApiOrigin(API_ORIGIN)

const Tabs = createBottomTabNavigator()
const Root = createNativeStackNavigator()

type IoniconName = ComponentProps<typeof Ionicons>['name']
/** A tab icon that fills in when the tab is focused and outlines when it isn't. */
function tabIcon(outline: IoniconName, filled: IoniconName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) =>
    <Ionicons name={focused ? filled : outline} size={size ?? 24} color={color} />
}

function MainTabs() {
  const t = useTheme()
  // The unread badge on the Profile tab. One fetch per session; the
  // Notifications screen reloads it when you read something.
  const notif = useApi(() => api.notifications(), [])
  const unread = notif.data?.unread || undefined
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarLabelStyle: { fontFamily: mobileFontFamily.medium, fontSize: 11 },
        tabBarStyle: { backgroundColor: t.colors.bgRaised, borderTopColor: t.colors.border },
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="Shop" component={CatalogScreen} options={{ tabBarIcon: tabIcon('search-outline', 'search') }} />
      <Tabs.Screen name="Sell" component={SellScreen} options={{ tabBarIcon: tabIcon('cube-outline', 'cube') }} />
      <Tabs.Screen name="Orders" component={OrdersScreen} options={{ tabBarIcon: tabIcon('receipt-outline', 'receipt') }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: tabIcon('person-outline', 'person'), tabBarBadge: unread }} />
    </Tabs.Navigator>
  )
}

function AppStack() {
  const t = useTheme()
  return (
    <Root.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.bgRaised },
        headerTintColor: t.colors.text,
        headerTitleStyle: { fontFamily: mobileFontFamily.bold },
        contentStyle: { backgroundColor: t.colors.bg },
      }}
    >
      <Root.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <Root.Screen name="Listing" component={ListingDetailScreen} options={{ title: 'Listing' }} />
      <Root.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
      <Root.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
      <Root.Screen name="SellerItem" component={SellerItemScreen} options={{ title: 'My item' }} />
      <Root.Screen name="Submission" component={SubmissionScreen} options={{ title: 'Submission' }} />
      <Root.Screen name="NewItem" component={NewItemScreen} options={{ title: 'Add an item' }} />
      <Root.Screen name="StartSelling" component={StartSellingScreen} options={{ title: 'Start selling' }} />
      <Root.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Root.Navigator>
  )
}

function AuthStack() {
  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      <Root.Screen name="SignIn" component={SignInScreen} />
    </Root.Navigator>
  )
}

function Routes() {
  const t = useTheme()
  const { session, ready } = useSession()
  const navTheme = {
    ...(t.name === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.name === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: t.colors.bg, card: t.colors.bgRaised, text: t.colors.text,
      border: t.colors.border, primary: t.colors.accent,
    },
  }
  if (!ready) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={t.name === 'dark' ? 'light' : 'dark'} />
      {session ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  )
}

export default function App() {
  const [fontsLoaded] = useFonts(mobileFontAssets)
  if (!fontsLoaded) return null
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <Routes />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
