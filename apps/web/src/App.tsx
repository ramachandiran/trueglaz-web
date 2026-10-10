import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isAdmin, isOps, isSeller, isStaff, useSession } from '@trueglaz/core'
import { AppShell } from './components/AppShell'
import { storedMarketView } from './state/useMarketView'
import { useParams } from 'react-router-dom'
import { Guard } from './components/Guard'
import { BalanceSheetPage } from './pages/BalanceSheetPage'
import { Loading } from './components/ui'
import { AdminPage } from './pages/AdminPage'
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
import { WantedPage } from './pages/WantedPage'
import { SignInPage } from './pages/SignInPage'

/**
 * Smart home page that redirects based on user role.
 * - Staff → Today: what is waiting on them, how the shelf is doing, what just moved
 * - Technician → Operations, which is the whole of their job
 * - Admin → Money page
 * - Seller → Selling
 * - Everyone else → Public catalog
 */
function SmartHome() {
  const { session, ready } = useSession()

  if (!ready) return <Loading label="Loading" />

  if (session) {
    if (isAdmin(session)) return <Navigate to="/admin" replace />
    // A technician is an ops user but not a staff one, and Inventory is a staff
    // screen: they inspect what is on their bench, they do not browse the shelf.
    if (isStaff(session)) return <Navigate to="/today" replace />
    if (isOps(session)) return <Navigate to="/ops" replace />
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
          <Route path="/profile" element={<Guard need="signed-in"><ProfilePage /></Guard>} />

          {/* Seller */}
          <Route path="/sell" element={<Guard need="signed-in"><SellerHomePage /></Guard>} />
          <Route path="/sell/manage" element={<Guard need="signed-in"><SellPage /></Guard>} />
          <Route path="/sell/new" element={<Guard need="signed-in"><NewSubmissionPage /></Guard>} />
          <Route path="/sell/:id" element={<Guard need="signed-in"><NewSubmissionPage /></Guard>} />
          <Route path="/items/:id" element={<Guard need="signed-in"><ItemDetailPage /></Guard>} />

          {/* Operations */}
          {/* Staff, not ops: a technician's whole job is the Operations queue, and
              the shelf-wide view is not part of it. The guard sends them home,
              and home sends them to /ops, so a typed URL lands somewhere useful
              rather than on a 403. */}
          <Route path="/today" element={<Guard need="staff"><StaffHomePage /></Guard>} />
          <Route path="/inventory" element={<Guard need="staff"><InventoryDashboard /></Guard>} />
          <Route path="/ops" element={<Guard need="ops"><OpsPage /></Guard>} />
          <Route path="/ops/inspect/:itemId" element={<Guard need="ops"><InspectPage /></Guard>} />
          <Route path="/ops/items" element={<Guard need="ops"><ItemsPage /></Guard>} />

          {/* People and Fulfilment are their own screens, not pages of the
              Operations one — nothing nests, and they are gated on staff where
              /ops is gated on ops. They lived under /ops/ only because that
              prefix had become shorthand for "a staff screen". The old paths
              redirect so anything already bookmarked still lands. */}
          <Route path="/fulfilment" element={<Guard need="staff"><FulfilmentPage /></Guard>} />
          {/* Ops, not staff: the bench check on a returned unit is a technician's. */}
          <Route path="/returns" element={<Guard need="ops"><ReturnsPage /></Guard>} />
          <Route path="/people" element={<Guard need="staff"><StaffUsersPage /></Guard>} />
          <Route path="/people/:id" element={<Guard need="staff"><StaffUserDetailPage /></Guard>} />
          <Route path="/ops/fulfilment" element={<Navigate to="/fulfilment" replace />} />
          <Route path="/ops/users" element={<Navigate to="/people" replace />} />
          <Route path="/ops/users/:id" element={<RedirectPerson />} />

          {/* Money */}
          <Route path="/admin" element={<Guard need="admin"><AdminPage /></Guard>} />
          <Route path="/balance-sheet" element={<Guard need="admin"><BalanceSheetPage /></Guard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

/** Keeps a bookmarked person's old link working, id and all. */
function RedirectPerson() {
  const { id = '' } = useParams()
  return <Navigate to={`/people/${id}`} replace />
}
