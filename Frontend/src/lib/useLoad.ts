import { useCallback, useEffect, useRef, useState } from 'react'
import { isAbort } from '../api'

// Load data for a page: { data, error, loading, reload }. Each run gets an AbortSignal; a
// newer run (or unmount) cancels the older one, so a slow answer can never overwrite a newer
// one. `deps` re-run it (e.g. a filter). Optional `pollMs` refreshes in the background while
// the tab is visible (usePolling in one place). Errors keep the last good data.

export type LoadState<T> = {
  data: T | undefined
  error: unknown
  loading: boolean
  reload: () => Promise<void>
}

export function useLoad<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[] = [],
  { pollMs }: { pollMs?: number } = {},
): LoadState<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const loadRef = useRef(load)
  const current = useRef<AbortController | null>(null)

  useEffect(() => {
    loadRef.current = load
  })

  const run = useCallback(async () => {
    current.current?.abort()
    const controller = new AbortController()
    current.current = controller
    setLoading(true)
    try {
      const value = await loadRef.current(controller.signal)
      if (controller.signal.aborted) return
      setData(value)
      setError(null)
    } catch (err) {
      if (isAbort(err) || controller.signal.aborted) return
      setError(err)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Scheduled, not called inline: the effect only STARTS the load; its state updates belong
    // to the load (react-hooks/set-state-in-effect).
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void run()
    })
    return () => {
      cancelled = true
      current.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller's deps are the contract
  }, deps)

  useEffect(() => {
    if (!pollMs) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run()
    }, pollMs)
    return () => window.clearInterval(timer)
  }, [pollMs, run])

  return { data, error, loading, reload: run }
}
