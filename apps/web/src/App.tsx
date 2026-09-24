import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isAdmin, isOps, useSession } from '@trueglaz/core'
import { AppShell } from './components/AppShell'
import { Guard } from './components/Guard'
import { Loading } from './components/ui'
import { AdminPage } from './pages/AdminPage'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { FulfilmentPage } from './pages/FulfilmentPage'
import { InspectPage } from './pages/InspectPage'
import { InventoryDashboard } from './pages/InventoryDashboard'
import { ItemDetailPage } from './pages/ItemDetailPage'
import { ItemsPage } from './pages/ItemsPage'
import { ListingDetailPage } from './pages/ListingDetailPage'
import { NewSubmissionPage } from './pages/NewSubmissionPage'
import { OpsPage } from './pages/OpsPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProfilePage } from './pages/ProfilePage'
import { SellPage } from './pages/SellPage'
import { WantedPage } from './pages/WantedPage'
import { SignInPage } from './pages/SignInPage'

/**
 * Smart home page that redirects based on user role.
 * - Ops/staff → Inventory dashboard
 * - Admin → Money page
 * - Everyone else → Public catalog
 */
function SmartHome() {
  const { session, ready } = useSession()

  if (!ready) return <Loading label="Loading" />

  if (session) {
    if (isAdmin(session)) return <Navigate to="/admin" replace />
    if (isOps(session)) return <Navigate to="/inventory" replace />
  }

  return <CatalogPage />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* Smart home: redirects ops/staff to inventory dashboard */}
          <Route path="/" element={<SmartHome />} />
          
          {/* Public storefront */}
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
          <Route path="/wanted" element={<WantedPage />} />
          <Route path="/sign-in" element={<SignInPage />} />

          {/* Buyer */}
          <Route path="/checkout/:listingId" element={<Guard need="signed-in"><CheckoutPage /></Guard>} />
          <Route path="/orders" element={<Guard need="signed-in"><OrdersPage /></Guard>} />
          <Route path="/profile" element={<Guard need="signed-in"><ProfilePage /></Guard>} />

          {/* Seller */}
          <Route path="/sell" element={<Guard need="signed-in"><SellPage /></Guard>} />
          <Route path="/sell/new" element={<Guard need="signed-in"><NewSubmissionPage /></Guard>} />
          <Route path="/sell/:id" element={<Guard need="signed-in"><NewSubmissionPage /></Guard>} />
          <Route path="/items/:id" element={<Guard need="signed-in"><ItemDetailPage /></Guard>} />

          {/* Operations */}
          <Route path="/inventory" element={<Guard need="ops"><InventoryDashboard /></Guard>} />
          <Route path="/ops" element={<Guard need="ops"><OpsPage /></Guard>} />
          <Route path="/ops/inspect/:itemId" element={<Guard need="ops"><InspectPage /></Guard>} />
          <Route path="/ops/items" element={<Guard need="ops"><ItemsPage /></Guard>} />
          <Route path="/ops/fulfilment" element={<Guard need="staff"><FulfilmentPage /></Guard>} />

          {/* Money */}
          <Route path="/admin" element={<Guard need="admin"><AdminPage /></Guard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
