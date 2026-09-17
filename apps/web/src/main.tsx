import React from 'react'
import ReactDOM from 'react-dom/client'
import { SessionProvider, setStorage } from '@trueglaz/core'
import { App } from './App'
import { webStorage } from './state/webStorage'
import './theme/index.css'

// Core is platform-agnostic; the app supplies the storage adapter.
setStorage(webStorage)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </React.StrictMode>,
)
