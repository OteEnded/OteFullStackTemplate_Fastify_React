import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Icon, type IconComponent } from './Icon'
import { buttonClass, type ButtonSize, type ButtonVariant } from './variants'

// Buttons: .btn + a variant (styles/components.css). Icon-only buttons MUST use IconButton,
// which requires a label.
type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconComponent
  /** Shows a spinner, disables the button and sets aria-busy — the label stays (no layout jump). */
  loading?: boolean
  children?: ReactNode
}

export function Button({ variant, size, icon, loading = false, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" /> : icon ? <Icon icon={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  )
}

type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  icon: IconComponent
  /** Required: an icon-only button needs an accessible name (also shown as the tooltip). */
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
}

export function IconButton({ icon, label, variant = 'ghost', size, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, cx('btn-icon', className))} aria-label={label} title={label} {...rest}>
      <Icon icon={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  )
}
