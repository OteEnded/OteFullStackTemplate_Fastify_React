import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { writeClipboard } from '../../lib/clipboard'
import { buttonClass } from './variants'
import { Icon } from './Icon'

// Copy a value — works over plain http on a LAN too (lib/clipboard falls back to execCommand).
// `get` may fetch the value first (e.g. a secret revealed on demand). (Oteracount CopyButton.)
export function CopyButton({ text, get, label = 'Copy', iconOnly = false, className }: { text?: string | null; get?: () => Promise<string | null>; label?: string; iconOnly?: boolean; className?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state !== 'copied' && state !== 'failed') return
    const t = window.setTimeout(() => setState('idle'), 2000)
    return () => window.clearTimeout(t)
  }, [state])

  const text2 = state === 'copied' ? 'Copied' : state === 'failed' ? "Couldn't copy" : label
  return (
    <button
      type="button"
      className={buttonClass(iconOnly ? 'ghost' : 'default', 'sm', iconOnly ? `btn-icon ${className ?? ''}` : className)}
      disabled={state === 'busy'}
      aria-label={iconOnly ? text2 : undefined}
      title={iconOnly ? text2 : undefined}
      onClick={async () => {
        setState('busy')
        const value = text ?? (get ? await get() : null)
        setState(value && (await writeClipboard(value)) ? 'copied' : 'failed')
      }}
    >
      <Icon icon={state === 'copied' ? Check : Copy} size={14} className={state === 'copied' ? 'text-ok' : undefined} />
      {!iconOnly && <span aria-live="polite">{text2}</span>}
    </button>
  )
}
