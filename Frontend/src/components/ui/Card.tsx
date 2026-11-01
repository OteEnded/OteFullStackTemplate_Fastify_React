import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cx } from '../../lib/cx'
import { Icon, type IconComponent } from './Icon'

// Surfaces: Card, StatCard, PageHeader, EmptyState, Callout.

/** `padded={false}`: the body runs edge to edge (a table inside a card); the title row keeps its padding. */
export function Card({ title, actions, className, children, padded = true }: { title?: ReactNode; actions?: ReactNode; className?: string; children: ReactNode; padded?: boolean }) {
  return (
    <section className={cx('card', padded ? 'card-pad gap-3' : 'overflow-hidden', 'flex flex-col', className)}>
      {(title || actions) && (
        <div className={cx('flex flex-wrap items-center justify-between gap-2', !padded && 'px-[18px] py-3')}>
          {title && <h2 className="card-title">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatCard({ label, value, hint, icon, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: IconComponent; tone?: 'ok' | 'warn' | 'danger' }) {
  return (
    <div className="card stat">
      <span className="stat-label">
        {icon && <Icon icon={icon} size={14} />}
        {label}
      </span>
      <span className={cx('stat-value', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger')}>{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}

/** Page title + one-line description + actions (right, wraps under on a phone). */
export function PageHeader({ title, description, kicker, actions }: { title: ReactNode; description?: ReactNode; kicker?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        {kicker && <span className="kicker">{kicker}</span>}
        <h1 className="text-xl">{title}</h1>
        {description && <p className="max-w-[68ch] text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** `level={1}` when the empty state IS the page (404). */
export function EmptyState({ icon, title, children, action, className, level = 2 }: { icon?: IconComponent; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string; level?: 1 | 2 }) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div className={cx('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      {icon && (
        <span className="mb-1 grid size-11 place-items-center rounded-full border border-line bg-sunken text-muted">
          <Icon icon={icon} size={20} />
        </span>
      )}
      <Heading className={level === 1 ? 'text-lg font-bold' : 'text-base font-semibold'}>{title}</Heading>
      {children && <div className="max-w-[46ch] text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export type CalloutTone = 'info' | 'ok' | 'warn' | 'danger'
const CALLOUT_ICON: Record<CalloutTone, IconComponent> = { info: Info, ok: CircleCheck, warn: TriangleAlert, danger: CircleAlert }

/** Inline notice. Use `danger` for errors the user must act on; it is announced (role=alert). */
export function Callout({ tone = 'info', title, children, action, className }: { tone?: CalloutTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('callout', `callout-${tone}`, className)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon icon={CALLOUT_ICON[tone]} size={16} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && <div className="callout-title">{title}</div>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className="flex-none self-center">{action}</div>}
    </div>
  )
}
