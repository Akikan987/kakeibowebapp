import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { StoreProvider } from './store'
import { setupOffline } from './offline'
import { AppThemeProvider } from './theme'
import './index.css'
import { isHybridNative } from './native/runtime'
import { BrowserNativeApproval, NativeIntegration } from './components/NativeIntegration'

const root = createRoot(document.getElementById('root')!)
// Only in dev: no account store, auth requests, AI calls or service worker in this preview.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('design-preview') === '1') {
  void import('./dev/DesignPreview').then(({ default: DesignPreview }) => {
    root.render(<StrictMode><AppThemeProvider><DesignPreview /></AppThemeProvider></StrictMode>)
  })
} else {
  if (!isHybridNative()) setupOffline()
  root.render(
    <StrictMode>
      <AppThemeProvider>
        <StoreProvider>
          <BrowserNativeApproval />
          <App />
          <NativeIntegration />
          {!isHybridNative() && <PwaUpdatePrompt />}
        </StoreProvider>
      </AppThemeProvider>
    </StrictMode>,
  )
}
