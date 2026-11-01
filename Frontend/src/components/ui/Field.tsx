import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cx } from '../../lib/cx'
import { Icon } from './Icon'

// Field = label + control + hint + error, wired for screen readers: the label's htmlFor,
// aria-describedby (hint + error) and aria-invalid are set on the ONE child control.
//   <Field label="Name" hint="Shown in lists" error={errors.name}><Input value=… /></Field>

type ControlProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false'; required?: boolean }

export function Field({
  label,
  hint,
  error,
  optional = false,
  className,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Adds a quiet "(optional)" after the label. */
  optional?: boolean
  className?: string
  children: ReactElement<ControlProps>
}) {
  const auto = useId()
  const id = (isValidElement(children) && children.props.id) || auto
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const control = cloneElement(children, {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  })
  return (
    <div className={cx('field', className)}>
      <label className="field-label" htmlFor={id}>
        {label}
        {optional && <span className="field-optional"> (optional)</span>}
      </label>
      {control}
      {hint && !error && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('input', className)} {...props} />
}

export function Textarea({ className, rows = 3, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('input', className)} rows={rows} {...props} />
}

export type SelectOption = { value: string; label: string; disabled?: boolean }

/** Native <select> (keyboard + mobile pickers for free), restyled with a chevron. */
export function Select({
  options,
  className,
  wrapClassName,
  placeholder,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[]; wrapClassName?: string; placeholder?: string }) {
  return (
    <span className={cx('select-wrap', wrapClassName)}>
      <select className={cx('input', className)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon icon={ChevronDown} size={14} className="select-chevron" />
    </span>
  )
}

export function Checkbox({ label, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }) {
  return (
    <label className={cx('check', className)}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  )
}

/** On/off setting. A real checkbox with role="switch" — announced as "on/off". */
export function Switch({ label, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & { label: ReactNode }) {
  return (
    <label className={cx('switch', className)}>
      <input type="checkbox" role="switch" {...props} />
      <span>{label}</span>
    </label>
  )
}

/** Search box with a leading icon; `type="search"` gives Esc-to-clear for free. */
export function SearchInput({ className, wrapClassName, ...props }: InputHTMLAttributes<HTMLInputElement> & { wrapClassName?: string }) {
  return (
    <span className={cx('input-icon-wrap', wrapClassName)}>
      <Icon icon={Search} size={15} className="input-icon" />
      <input type="search" className={cx('input', className)} {...props} />
    </span>
  )
}
