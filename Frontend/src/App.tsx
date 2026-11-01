import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ConsoleLayout } from './components/shell/ConsoleLayout'
import { PublicLayout } from './components/shell/PublicLayout'
import { Toaster } from './components/ui/Toaster'
import { lazyWithReload } from './lib/lazyWithReload'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'

// Routes:
//   /            public page (PublicLayout)          /login   sign-in card (AuthLayout)
//   /console/*   the console (ConsoleLayout) — open without signing in until Slice 8's auth
// Console pages are code-split; lazyWithReload recovers from stale chunks after a redeploy.

const DashboardPage = lazyWithReload(() => import('./pages/DashboardPage'))
const SettingsPage = lazyWithReload(() => import('./pages/SettingsPage'))
const ItemsPage = lazyWithReload(() => import('./features/template-items/ItemsPage')) // @demo
// Dev-only kit: `import.meta.env.DEV` is false in a build, so the chunk isn't even emitted.
const KitchenSinkPage = import.meta.env.DEV ? lazyWithReload(() => import('./pages/KitchenSinkPage')) : null

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/console" element={<ConsoleLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="items" element={<ItemsPage />} /> {/* @demo */}
            <Route path="settings" element={<SettingsPage />} />
            {KitchenSinkPage && <Route path="ui" element={<KitchenSinkPage />} />}
            <Route path="*" element={<NotFoundPage inConsole />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  )
}
