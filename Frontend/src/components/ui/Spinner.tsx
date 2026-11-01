import { cx } from '../../lib/cx'

// Loading states. Animations stop under prefers-reduced-motion (styles/base.css).

export function Spinner({ size = 16, label = 'Loading', className }: { size?: number; label?: string; className?: string }) {
  return <span className={cx('spinner', className)} style={{ width: size, height: size }} role="status" aria-label={label} />
}

export function Skeleton({ width = '100%', height = 12, className }: { width?: string | number; height?: number; className?: string }) {
  return <span className={cx('skeleton', className)} style={{ width, height }} aria-hidden="true" />
}

/** Whole-page placeholder for a route that's still loading (lazy chunk or first fetch). */
export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-muted">
      <Spinner label={label} />
      <span>{label}</span>
    </div>
  )
}
