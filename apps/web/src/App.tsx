import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isOps, isSeller, isStaff, useSession } from '@trueglaz/core'
import { AppShell } from './components/AppShell'
import { StaffShell } from './components/StaffShell'
import { storedMarketView } from './state/useMarketView'
import { Guard } from './components/Guard'
import { BalanceSheetPage } from './pages/BalanceSheetPage'
import { AuditPage } from './pages/AuditPage'
import { Loading } from './components/ui'
import { AdminPage } from './pages/AdminPage'
import { AdminModelsPage } from './pages/AdminModelsPage'
import { SettingsLayout } from './pages/settings/SettingsLayout'
import { SettingsOverview } from './pages/settings/SettingsOverview'
import { SettingsGroupPage } from './pages/settings/SettingsGroupPage'
import { FeesSettingsPage } from './pages/settings/FeesSettingsPage'
import { CompanySettingsPage } from './pages/settings/CompanySettingsPage'
import { CatalogueSettingsPage } from './pages/settings/CatalogueSettingsPage'
import { StaffUsersPage } from './pages/StaffUsersPage'
import { StaffUserDetailPage } from './pages/StaffUserDetailPage'
import { CatalogPage } from './pages/CatalogPage'
import { HomePage } from './pages/HomePage'
import { CheckoutPage } from './pages/CheckoutPage'
import { FulfilmentPage } from './pages/FulfilmentPage'
import { ReturnsPage } from './pages/ReturnsPage'
import { StaffHomePage } from './pages/StaffHomePage'
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
import { SellerHomePage } from './pages/SellerHomePage'
import { VaultPage } from './pages/VaultPage'
import { WantedPage } from './pages/WantedPage'
import { SignInPage } from './pages/SignInPage'

/**
 * Smart home page that redirects based on user role.
 * - Staff / Admin → the admin console home (/admin): what is waiting, how the shelf is doing, what just moved
 * - Technician → Operations, which is the whole of their job
 * - Seller → Selling
 * - Everyone else → Public catalog
 */
function SmartHome() {
  const { session, ready } = useSession()

  if (!ready) return <Loading label="Loading" />

  if (session) {
    // Staff and admin share one landing page, the console home at /admin.
    if (isStaff(session)) return <Navigate to="/admin" replace />
    // A technician is an ops user but not a staff one, and Inventory is a staff
    // screen: they inspect what is on their bench, they do not browse the shelf.
    if (isOps(session)) return <Navigate to="/admin/operations" replace />
    // A seller lands on their selling home, unless they last switched to
    // Buying on this device: then the switch would bounce straight back.
    if (isSeller(session) && storedMarketView() !== 'buying') return <Navigate to="/sell" replace />
  }

  return <HomePage />
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
          <Route path="/vault" element={<Guard need="signed-in"><VaultPage /></Guard>} />
          <Route path="/profile" element={<Guard need="signed-in"><ProfilePage /></Guard>} />

          {/* Seller */}
          <Route path="/sell" element={<Guard need="signed-in"><SellerHomePage /></Guard>} />
          <Route path="/sell/manage" element={<Guard need="signed-in"><SellPage /></Guard>} />
          <Route path="/sell/new" element={<Guard need="signed-in"><NewSubmissionPage /></Guard>} />
          <Route path="/sell/:id" element={<Guard need="signed-in"><NewSubmissionPage /></Guard>} />
          <Route path="/items/:id" element={<Guard need="signed-in"><ItemDetailPage /></Guard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        {/* The admin / staff console, all under /admin, in its own sidebar shell.
            The URL prefix is organisational, not a permission: each screen
            keeps its own role guard, so a technician reaching /admin/operations
            is let in and /admin/money is not. /admin itself is the console
            home (what used to be /today), open to staff and admin alike. */}
        <Route element={<StaffShell />}>
          <Route path="/admin" element={<Guard need="staff"><StaffHomePage /></Guard>} />
          <Route path="/admin/inventory" element={<Guard need="staff"><InventoryDashboard /></Guard>} />
          <Route path="/admin/operations" element={<Guard need="ops"><OpsPage /></Guard>} />
          <Route path="/admin/operations/inspect/:itemId" element={<Guard need="ops"><InspectPage /></Guard>} />
          <Route path="/admin/operations/items" element={<Guard need="ops"><ItemsPage /></Guard>} />
          {/* Ops, not staff: the bench check on a returned unit is a technician's. */}
          <Route path="/admin/returns" element={<Guard need="ops"><ReturnsPage /></Guard>} />
          <Route path="/admin/fulfilment" element={<Guard need="staff"><FulfilmentPage /></Guard>} />
          <Route path="/admin/people" element={<Guard need="staff"><StaffUsersPage /></Guard>} />
          <Route path="/admin/people/:id" element={<Guard need="staff"><StaffUserDetailPage /></Guard>} />

          <Route path="/admin/money" element={<Guard need="admin"><AdminPage /></Guard>} />
          <Route path="/admin/settings" element={<Guard need="admin"><SettingsLayout /></Guard>}>
            <Route index element={<SettingsOverview />} />
            <Route path="selling" element={<SettingsGroupPage key="selling" group="selling" />} />
            <Route path="fees" element={<FeesSettingsPage />} />
            <Route path="payouts" element={<SettingsGroupPage key="payouts" group="payouts" />} />
            <Route path="company" element={<CompanySettingsPage />} />
            <Route path="catalogue" element={<CatalogueSettingsPage />} />
            <Route path="security" element={<SettingsGroupPage key="security" group="security" />} />
            <Route path="notifications" element={<SettingsGroupPage key="notifications" group="notifications" />} />
            <Route path="models" element={<AdminModelsPage />} />
          </Route>
          <Route path="/admin/models" element={<Navigate to="/admin/settings/models" replace />} />
          <Route path="/admin/balance-sheet" element={<Guard need="admin"><BalanceSheetPage /></Guard>} />
          <Route path="/admin/audit" element={<Guard need="admin"><AuditPage /></Guard>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
