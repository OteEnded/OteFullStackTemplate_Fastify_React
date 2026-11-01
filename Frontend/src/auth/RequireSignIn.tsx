import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { PageLoading } from '../components/ui/Spinner'
import { useAuth } from './AuthContext'

// Gate for the console. With auth OFF on the server it lets everyone through (the console is
// open, as configured); with auth ON a signed-out visitor goes to /login?next=<where they were>.
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { status, enabled } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoading />
  if (enabled && status !== 'signed-in') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <>{children}</>
}
