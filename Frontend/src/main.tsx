import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { getAppConfig, initAppConfig } from './config'
import { initTheme } from './lib/theme'

// index.html has already painted the theme; this syncs theme-color from the stylesheet.
initTheme()

// Runtime config (/config.json, 3 s timeout, falls back to defaults) before the first render,
// so the app name is right from the first frame.
await initAppConfig()
document.title = getAppConfig().app.name

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
