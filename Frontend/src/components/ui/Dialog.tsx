import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { backdropPointerDown, backdropPointerUp } from '../../lib/overlay'
import { cx } from '../../lib/cx'
import { IconButton } from './Button'

// Modal dialog on the native <dialog> + showModal():
//   · top layer — no z-index fights; the page behind is inert; nested dialogs stack natively
//     and Esc closes only the TOP one (what Oteracount's manual Esc stack did by hand)
//   · Esc → `cancel` event → onClose (React stays the owner of open/closed)
//   · backdrop closes only when the press STARTS and ENDS on it (lib/overlay — the drag bug
//     Oteracount's Modal regressed to with onClick={onClose})
//   · focus returns to whatever opened it
//   · portalled to <body> so it never inherits a parent's white-space/colour (Oteracount, 2026-10-04)
// Render it only while open: {editing && <Dialog …/>}  — or pass open={…}.
// Initial focus: the element marked data-autofocus, else the first field.

export type DialogProps = {
  title: ReactNode
  description?: ReactNode
  onClose: () => void
  children: ReactNode
  /** Footer actions (right-aligned). */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  open?: boolean
  /** Prevent closing by Esc / backdrop (e.g. while saving). The ✕ is hidden too. */
  dismissible?: boolean
  /** Make the body a <form> so Enter submits; `onSubmit` gets the event (default prevented). */
  onSubmit?: () => void
  className?: string
}

export function Dialog({ open = true, ...props }: DialogProps) {
  if (!open) return null
  return createPortal(<DialogOpen {...props} />, document.body)
}

function DialogOpen({ title, description, onClose, children, footer, size = 'md', dismissible = true, onSubmit, className }: Omit<DialogProps, 'open'>) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()
  const closeRef = useRef(onClose)
  const dismissRef = useRef(dismissible)
  useEffect(() => {
    closeRef.current = onClose
    dismissRef.current = dismissible
  })

  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const opener = document.activeElement as HTMLElement | null
    if (!dialog.open) dialog.showModal()
    // React's autoFocus runs before showModal (when the dialog is still hidden), so focus is
    // placed here: [data-autofocus] first, else the first field, else the browser's default.
    const first =
      dialog.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog.querySelector<HTMLElement>('input:not([type=hidden]):not(:disabled), select, textarea')
    first?.focus()
    const onCancel = (e: Event) => {
      e.preventDefault() // React decides; the dialog closes when the parent unmounts it
      if (dismissRef.current) closeRef.current()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      if (dialog.open) dialog.close()
      // Return focus to the opener (if it still exists and nothing else claimed focus).
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true })
    }
  }, [])

  const head = (
    <div className="dialog-head">
      <div className="min-w-0">
        <h2 className="dialog-title" id={titleId}>
          {title}
        </h2>
        {description && (
          <p className="dialog-desc" id={descId}>
            {description}
          </p>
        )}
      </div>
      {dismissible && <IconButton icon={X} label="Close" size="sm" onClick={() => closeRef.current()} />}
    </div>
  )

  const inner = (
    <>
      {head}
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-foot">{footer}</div>}
    </>
  )

  return (
    <dialog
      ref={ref}
      className={cx('dialog', size === 'sm' && 'dialog-sm', size === 'lg' && 'dialog-lg', className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onPointerDown={backdropPointerDown}
      onPointerUp={(e) => {
        if (backdropPointerUp(e) && dismissRef.current) closeRef.current()
      }}
    >
      {onSubmit ? (
        <form
          className="flex min-h-0 flex-col"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          {inner}
        </form>
      ) : (
        inner
      )}
    </dialog>
  )
}
