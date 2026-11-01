import { lazy, type ComponentType } from 'react'

// Guards shared with the index.html boot watchdog. TWO keys on purpose, so the two recovery
// paths never stack into a reload loop:
//   CHUNK_GUARD — a route chunk failed to import (this module owns it)
//   BOOT_GUARD  — the app never mounted at all (the index.html watchdog owns it)
export const CHUNK_GUARD = 'ote:chunk-reloaded'
export const BOOT_GUARD = 'ote:boot-reloaded'

// Route chunks have hashed names. After a redeploy a tab still holding the OLD index.html asks
// for hashes that no longer exist → the import rejects → blank route. On failure reload ONCE
// (guarded) to get fresh index.html + chunks; clear the guard on success so a later, unrelated
// failure gets a fresh budget; if it still fails, rethrow so RootErrorBoundary shows a manual
// Reload. No in-page retry: the browser caches a failed module by URL. (EAP, verbatim logic.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors React.lazy's own signature
export function lazyWithReload<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory()
      try {
        sessionStorage.removeItem(CHUNK_GUARD)
      } catch {
        /* storage blocked */
      }
      return mod
    } catch (err) {
      try {
        if (sessionStorage.getItem(CHUNK_GUARD) !== '1') {
          sessionStorage.setItem(CHUNK_GUARD, '1')
          window.location.reload()
          return await new Promise<never>(() => {}) // hold render until the reload takes over
        }
      } catch {
        /* sessionStorage blocked — fall through to the boundary */
      }
      throw err
    }
  })
}
