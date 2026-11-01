import { cx } from '../../lib/cx'

// Variants are a tiny map onto the .btn classes in styles/components.css — no cva.
// buttonClass() is also handy for a <Link> that should look like a button.
export type ButtonVariant = 'default' | 'primary' | 'danger' | 'warn' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const VARIANT: Record<ButtonVariant, string> = {
  default: '',
  primary: 'btn-primary',
  danger: 'btn-danger',
  warn: 'btn-warn',
  ghost: 'btn-ghost',
}

export function buttonClass(variant: ButtonVariant = 'default', size: ButtonSize = 'md', extra?: string) {
  return cx('btn', VARIANT[variant], size === 'sm' && 'btn-sm', extra)
}

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'think' | 'accent'
