import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import type { Tone } from './variants'

// Chip = a small status pill (OSM .chip-*). StatusBadge maps a domain value → tone + label
// through a META table, so the colour rule lives in one place per feature:
//   const META = { active: { tone: 'ok', label: 'Active' }, … }
//   <StatusBadge value={row.status} meta={META} />

const TONE: Record<Tone, string> = {
  neutral: '',
  ok: 'chip-ok',
  warn: 'chip-warn',
  danger: 'chip-danger',
  info: 'chip-info',
  think: 'chip-think',
  accent: 'chip-accent',
}

export function Chip({ tone = 'neutral', dot = false, className, children, title }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode; title?: string }) {
  return (
    <span className={cx('chip', TONE[tone], dot && 'chip-dot', className)} title={title}>
      {children}
    </span>
  )
}

export type StatusMeta = Record<string, { tone: Tone; label: string }>

export function StatusBadge({ value, meta }: { value: string; meta: StatusMeta }) {
  const m = meta[value] ?? { tone: 'neutral' as Tone, label: value }
  return (
    <Chip tone={m.tone} dot>
      {m.label}
    </Chip>
  )
}
