import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
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
        <PwaUpdatePrompt />
      </StoreProvider>
    </AppThemeProvider>
  </StrictMode>,
)
