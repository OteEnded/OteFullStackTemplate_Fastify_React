// Toast store — call `toast.ok('Saved')` from anywhere (no hook, no provider); <Toaster/>
// (components/ui/Toaster.tsx, mounted once in App) renders the stack. Shape from OSM's
// Activity toasts, extracted from its activity system.

export type ToastTone = 'ok' | 'info' | 'warn' | 'danger'
export type ToastItem = { id: number; tone: ToastTone; title: string; body?: string; timeoutMs: number }

let items: ToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

export function subscribeToasts(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getToasts(): ToastItem[] {
  return items
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

function show(tone: ToastTone, title: string, body?: string, timeoutMs?: number) {
  const id = ++seq
  // Errors stay longer: people need time to read what went wrong.
  const ms = timeoutMs ?? (tone === 'danger' ? 8000 : 4000)
  items = [...items.slice(-4), { id, tone, title, body, timeoutMs: ms }]
  emit()
  return id
}

export const toast = {
  ok: (title: string, body?: string, timeoutMs?: number) => show('ok', title, body, timeoutMs),
  info: (title: string, body?: string, timeoutMs?: number) => show('info', title, body, timeoutMs),
  warn: (title: string, body?: string, timeoutMs?: number) => show('warn', title, body, timeoutMs),
  error: (title: string, body?: string, timeoutMs?: number) => show('danger', title, body, timeoutMs),
  dismiss: dismissToast,
}
