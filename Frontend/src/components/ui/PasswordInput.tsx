import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cx } from '../../lib/cx'
import { Icon } from './Icon'

// ⭐ Ote (Oteracount, 2026-10-05): the eye shows what was typed for PEEK_SECONDS with a
// countdown, then hides it again by itself; clicking during the countdown hides it at once.
// A real <button type="button"> (keyboard + screen readers; never submits the form).
const PEEK_SECONDS = 5

export function PasswordInput({ className, wrapClassName, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { wrapClassName?: string }) {
  const [left, setLeft] = useState(0) // seconds still shown; 0 = hidden
  const shown = left > 0

  useEffect(() => {
    if (!shown) return
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left, shown])

  const label = shown ? `Hide password (hides by itself in ${left} s)` : `Show password for ${PEEK_SECONDS} seconds`
  return (
    <div className={cx('pw-wrap', wrapClassName)}>
      <input {...props} type={shown ? 'text' : 'password'} className={cx('input', className)} spellCheck={false} autoCapitalize="off" />
      <button type="button" className="pw-peek" onClick={() => setLeft(shown ? 0 : PEEK_SECONDS)} aria-label={label} aria-pressed={shown} title={label}>
        {shown && (
          <span className="num" aria-hidden="true">
            {left}s
          </span>
        )}
        <Icon icon={shown ? EyeOff : Eye} size={16} />
      </button>
    </div>
  )
}
