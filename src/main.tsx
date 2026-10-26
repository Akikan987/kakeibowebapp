import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { StoreProvider } from './store'
import { setupOffline } from './offline'
import { AppThemeProvider } from './theme'
import './index.css'

const root = createRoot(document.getElementById('root')!)
// Only in dev: no account store, auth requests, AI calls or service worker in this preview.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('design-preview') === '1') {
  void import('./dev/DesignPreview').then(({ default: DesignPreview }) => {
    root.render(<StrictMode><AppThemeProvider><DesignPreview /></AppThemeProvider></StrictMode>)
  })
} else {
  setupOffline()
  root.render(
    <StrictMode>
      <AppThemeProvider>
        <StoreProvider>
          <App />
          <PwaUpdatePrompt />
        </StoreProvider>
      </AppThemeProvider>
    </StrictMode>,
  )
}
