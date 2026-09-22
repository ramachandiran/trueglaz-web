import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Guard } from './components/Guard'
import { AdminPage } from './pages/AdminPage'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { FulfilmentPage } from './pages/FulfilmentPage'
import { InspectPage } from './pages/InspectPage'
import { ItemDetailPage } from './pages/ItemDetailPage'
import { ItemsPage } from './pages/ItemsPage'
import { ListingDetailPage } from './pages/ListingDetailPage'
import { NewSubmissionPage } from './pages/NewSubmissionPage'
import { OpsPage } from './pages/OpsPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProfilePage } from './pages/ProfilePage'
import { SellPage } from './pages/SellPage'
import { SignInPage } from './pages/SignInPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* Public storefront */}
          <Route path="/" element={<CatalogPage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
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
