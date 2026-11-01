import { createContext, useContext } from 'react'

// The whole auth surface the UI depends on. AuthProvider.tsx talks to the backend's optional
// auth module (Backend/app/modules/auth): GET /api/auth/me, POST /api/auth/login|logout,
// GET /api/auth/oteracount/start. Pages only ever use useAuth().

/** Mirrors the backend's user (app/modules/auth/users.js). */
export type User = {
  kind: 'root' | 'local' | 'oteracount'
  uuid: string | null
  username: string | null
  name: string
  role: string
  /** Permission keys; '*' = everything. Checked by can(). */
  permissions: string[]
}

export type AuthMethods = {
  /** Username + password (config root and/or local users). */
  password?: boolean
  /** "Login with Oteracount" is configured on the server. */
  oteracount?: boolean
}

export type AuthState = {
  /** null = signed out (or auth is off on this server). */
  user: User | null
  status: 'loading' | 'signed-in' | 'signed-out'
  /** False when the server runs without the auth module (auth.enabled false): the console is open. */
  enabled: boolean
  methods: AuthMethods
  /** Resolves on success; rejects with a readable message on failure. */
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Permission check for nav items / buttons. With auth off, everything is allowed. */
  can: (permission: string) => boolean
}

/** Where the "Login with Oteracount" button goes (a full-page navigation, not fetch). */
export const OTERACOUNT_START_URL = '/api/auth/oteracount/start'

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth() must be used inside <AuthProvider>')
  return value
}
