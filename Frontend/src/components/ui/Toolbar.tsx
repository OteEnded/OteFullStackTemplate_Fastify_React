import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { cx } from '../../lib/cx'
import { Icon } from './Icon'
import { buttonClass } from './variants'

// List-page header row: filters on the left, actions on the right; wraps on a phone.
//   <Toolbar actions={<Button variant="primary">New</Button>}><SearchInput …/><Select …/></Toolbar>
export function Toolbar({ children, actions, className }: { children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// Soft refresh — re-fetch without a page reload. The icon keeps spinning for at least 450 ms
// so an instant (cached) fetch still registers as an action (EAP RefreshButton).
export function RefreshButton({ onRefresh, label = 'Refresh', showLabel = false }: { onRefresh: () => void | Promise<void>; label?: string; showLabel?: boolean }) {
  const [spinning, setSpinning] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const run = async () => {
    if (spinning) return
    setSpinning(true)
    const started = Date.now()
    try {
      await onRefresh()
    } finally {
      timer.current = window.setTimeout(() => setSpinning(false), Math.max(0, 450 - (Date.now() - started)))
    }
  }
  return (
    <button
      type="button"
      className={buttonClass('default', 'md', showLabel ? undefined : 'btn-icon')}
      aria-label={showLabel ? undefined : label}
      title={label}
      aria-busy={spinning || undefined}
      disabled={spinning}
      onClick={() => void run()}
    >
      <Icon icon={RefreshCw} size={15} className={spinning ? 'spin' : undefined} />
      {showLabel && label}
    </button>
  )
}
