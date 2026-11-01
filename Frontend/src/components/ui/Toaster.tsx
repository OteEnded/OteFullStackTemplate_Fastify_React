import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { dismissToast, getToasts, subscribeToasts, type ToastItem } from '../../lib/toast'
import { Icon } from './Icon'
import { IconButton } from './Button'

// Mount ONCE (App.tsx). Fire toasts with `toast.ok(...)` from lib/toast.
// The stack is a popover="manual": the top layer is the only way to sit ABOVE an open modal
// <dialog> (whose backdrop covers everything else), so it is re-shown on each new toast to
// become the topmost layer. aria-live="polite" announces without stealing focus.

const ICON = { ok: CircleCheck, info: Info, warn: TriangleAlert, danger: CircleAlert }

export function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, getToasts)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof el.showPopover !== 'function') return
    if (items.length === 0) {
      if (el.matches(':popover-open')) el.hidePopover()
      return
    }
    // hide+show moves it to the top of the top-layer stack (above a dialog opened since).
    if (el.matches(':popover-open')) el.hidePopover()
    el.showPopover()
  }, [items])

  return (
    <div ref={ref} popover="manual" className="toasts" role="region" aria-label="Notifications">
      <div aria-live="polite" className="contents">
        {items.map((t) => (
          <Toast key={t.id} item={t} />
        ))}
      </div>
    </div>
  )
}

function Toast({ item }: { item: ToastItem }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(item.id), item.timeoutMs)
    return () => window.clearTimeout(timer)
  }, [item.id, item.timeoutMs])

  return (
    <div className={`toast toast-${item.tone}`} role={item.tone === 'danger' ? 'alert' : 'status'}>
      <Icon icon={ICON[item.tone]} size={16} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{item.title}</div>
        {item.body && <div className="text-xs text-muted">{item.body}</div>}
      </div>
      <IconButton icon={X} label="Dismiss" size="sm" onClick={() => dismissToast(item.id)} />
    </div>
  )
}
