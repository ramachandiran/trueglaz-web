import React from 'react'
import ReactDOM from 'react-dom/client'
import { SessionProvider, setStorage, setApiOrigin, setOnline } from '@trueglaz/core'
import { App } from './App'
import { webStorage } from './state/webStorage'
import { framedByAnotherSite } from './frameGuard'
import './theme/index.css'

// Core is platform-agnostic; the app supplies the storage adapter.
setStorage(webStorage)

// Follow the browser's connection, so paying and saving say "offline" instead
// of failing, and pages fetch again when it comes back (TG-156).
setOnline(navigator.onLine)
window.addEventListener('online', () => setOnline(true))
window.addEventListener('offline', () => setOnline(false))

// Set the API origin for cross-origin requests
if (import.meta.env.VITE_API_ORIGIN) {
  setApiOrigin(import.meta.env.VITE_API_ORIGIN)
}

if (framedByAnotherSite()) {
  // Framed by another site: render nothing clickable, and offer the real page.
  const root = document.getElementById('root')!
  root.textContent = ''
  const a = document.createElement('a')
  a.href = window.location.href
  a.target = '_top'
  a.rel = 'noopener'
  a.textContent = 'Open TrueGlaz in its own window'
  root.appendChild(a)
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <SessionProvider>
        <App />
      </SessionProvider>
    </React.StrictMode>,
  )
}
