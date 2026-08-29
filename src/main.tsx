import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './store'
import { setupOffline } from './offline'
import { AppThemeProvider } from './theme'
import './index.css'

setupOffline()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </AppThemeProvider>
  </StrictMode>,
)
