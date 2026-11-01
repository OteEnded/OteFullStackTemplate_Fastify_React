import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getJson, onUnauthorized, postJson } from '../api'
import { AuthContext, type AuthMethods, type AuthState, type User } from './AuthContext'

// Talks to the backend's optional auth module. On mount it asks GET /api/auth/me:
//   { enabled:false }          → auth is off on this server: no sign-in, the console is open
//   { enabled:true, user }     → signed in (user) or signed out (null)
// Any API call that comes back 401 (session expired / account disabled) signs the user out
// here too (api.ts onUnauthorized), and the console gate sends them to /login.

type Me = { enabled: boolean; user: User | null; methods: AuthMethods }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null) // null while loading

  useEffect(() => {
    let alive = true
    getJson<Me>('/api/auth/me', { skipAuthHook: true })
      .then((data) => alive && setMe(data))
      // An older backend without the module (404) or an unreachable one: behave as "auth off"
      // rather than locking the console behind a sign-in that can't work.
      .catch(() => alive && setMe({ enabled: false, user: null, methods: {} }))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => onUnauthorized(() => setMe((prev) => (prev ? { ...prev, user: null } : prev))), [])

  const signIn = useCallback(async (username: string, password: string) => {
    const { user } = await postJson<{ user: User }>('/api/auth/login', { username, password }, { skipAuthHook: true })
    setMe((prev) => ({ enabled: true, methods: prev?.methods ?? {}, user }))
  }, [])

  const signOut = useCallback(async () => {
    const { redirect } = await postJson<{ redirect: string | null }>('/api/auth/logout', undefined, { skipAuthHook: true })
    setMe((prev) => (prev ? { ...prev, user: null } : prev))
    // Signed in with Oteracount: end that session too (it comes back to /login).
    if (redirect) window.location.assign(redirect)
  }, [])

  const value = useMemo<AuthState>(() => {
    const enabled = me?.enabled ?? false
    const user = me?.user ?? null
    return {
      user,
      status: me === null ? 'loading' : user ? 'signed-in' : 'signed-out',
      enabled,
      methods: me?.methods ?? {},
      signIn,
      signOut,
      can: (permission) => !enabled || Boolean(user && (user.permissions.includes('*') || user.permissions.includes(permission))),
    }
  }, [me, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
