import { useMemo, type ReactNode } from 'react'
import { AUTH_NOT_ENABLED, AuthContext, type AuthState } from './AuthContext'

// ⚠️ STUB until Slice 8 (the template's optional auth module). No backend calls: nobody is
// signed in, the console is reachable without signing in, and signIn() explains why it
// can't work yet. To wire real auth, replace ONLY this file:
//   · on mount: GET /api/auth/me → user (or null)        · signIn: POST /api/auth/login
//   · signOut: POST /api/auth/logout (no body)           · onUnauthorized() from ../api → user = null
// and gate /console in App.tsx on `status === 'signed-in'`.

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthState>(
    () => ({
      user: null,
      status: 'signed-out',
      enabled: false,
      signIn: async () => {
        throw new Error(AUTH_NOT_ENABLED)
      },
      signOut: async () => {},
      can: () => true,
    }),
    [],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
