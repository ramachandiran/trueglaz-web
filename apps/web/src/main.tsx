import React from 'react'
import ReactDOM from 'react-dom/client'
import { SessionProvider, setStorage, setApiOrigin, setOnline } from '@trueglaz/core'
import { App } from './App'
import { webStorage } from './state/webStorage'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </React.StrictMode>,
)
