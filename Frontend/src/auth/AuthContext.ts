import { createContext, useContext } from 'react'

// ⚠️ SLICE 8 SEAM — the whole auth surface the UI depends on. Today it is a STUB (see
// AuthProvider.tsx): nobody is ever signed in and the console is open. Slice 8's auth module
// replaces AuthProvider's internals with /api/auth/* calls; pages keep using useAuth().

export type User = {
  id: string
  name: string
  /** Permission keys, checked by can(). */
  permissions: string[]
}

export type AuthState = {
  /** null = signed out (or auth not enabled yet). */
  user: User | null
  status: 'loading' | 'signed-in' | 'signed-out'
  /** True once the backend has an auth module. The stub says false. */
  enabled: boolean
  /** Resolves on success; rejects with a readable message on failure. */
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Permission check for nav items / buttons. With auth disabled, everything is allowed. */
  can: (permission: string) => boolean
}

/** What the stub's signIn() says. Delete with the stub. */
export const AUTH_NOT_ENABLED =
  "Sign-in isn't enabled yet — the auth module comes with the template's optional auth (Slice 8)."

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth() must be used inside <AuthProvider>')
  return value
}
