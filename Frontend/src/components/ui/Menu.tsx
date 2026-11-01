import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cx } from '../../lib/cx'
import { Icon, type IconComponent } from './Icon'
import { buttonClass } from './variants'

// Dropdown / row "⋯" menu on the Popover API (EAP RowMenu, re-based):
//   · popover="auto" → top layer (never clipped by a table's overflow), light-dismiss that
//     only fires when press AND release are outside (drag-safe natively), Esc closes
//   · positioned with getBoundingClientRect (the CSS anchor-positioning fallback): flips above
//     when there's no room below, clamps to the viewport; closes on scroll/resize instead of
//     chasing a moving anchor
//   · role="menu" with arrow-key roving focus; focus returns to the trigger on close

export type MenuItem =
  | {
      label: string
      onSelect: () => void
      icon?: IconComponent
      danger?: boolean
      disabled?: boolean
      /** Skip rendering — lets callers write permission gates inline. */
      hidden?: boolean
    }
  | 'separator'

export function Menu({
  items,
  label = 'More actions',
  trigger,
  triggerClassName,
  align = 'end',
}: {
  items: MenuItem[]
  /** Accessible name of the trigger (and its tooltip when icon-only). */
  label?: string
  /** Trigger content; default is a "⋯" icon. */
  trigger?: ReactNode
  triggerClassName?: string
  align?: 'start' | 'end'
}) {
  // Drop hidden items, then any separator left leading, trailing or doubled.
  const shown = items
    .filter((i) => i === 'separator' || !i.hidden)
    .filter((i, at, list) => i !== 'separator' || (at > 0 && at < list.length - 1 && list[at - 1] !== 'separator'))
  const id = useId()
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  // Position + focus when the popover opens; tidy up when it closes.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === 'open'
      setOpen(isOpen)
      if (isOpen) {
        place()
        panel.querySelector<HTMLElement>('[role=menuitem]:not(:disabled)')?.focus()
      } else if (panel.contains(document.activeElement) || document.activeElement === document.body) {
        btnRef.current?.focus()
      }
    }
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const w = panel.offsetWidth
      const h = panel.offsetHeight
      const below = window.innerHeight - r.bottom
      const top = below < h + 8 && r.top > below ? Math.max(8, r.top - h - 4) : r.bottom + 4
      const wanted = align === 'end' ? r.right - w : r.left
      const left = Math.min(Math.max(8, wanted), window.innerWidth - w - 8)
      panel.style.top = `${top}px`
      panel.style.left = `${left}px`
    }
    panel.addEventListener('toggle', onToggle)
    return () => panel.removeEventListener('toggle', onToggle)
  }, [align])

  useEffect(() => {
    if (!open) return
    const close = () => panelRef.current?.hidePopover()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)') ?? [])]
    if (!list.length) return
    const at = list.indexOf(document.activeElement as HTMLElement)
    const go = (i: number) => {
      e.preventDefault()
      list[(i + list.length) % list.length].focus()
    }
    if (e.key === 'ArrowDown') go(at + 1)
    else if (e.key === 'ArrowUp') go(at - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(list.length - 1)
    else if (e.key === 'Tab') panelRef.current?.hidePopover()
  }

  if (!shown.some((i) => i !== 'separator')) return null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={triggerClassName ?? buttonClass('ghost', 'sm', 'btn-icon')}
        popoverTarget={id}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={trigger ? undefined : label}
        title={trigger ? undefined : label}
      >
        {trigger ?? <Icon icon={MoreHorizontal} size={16} />}
      </button>
      <div ref={panelRef} id={id} popover="auto" role="menu" aria-label={label} className="menu" onKeyDown={onKeyDown}>
        {shown.map((it, i) =>
          it === 'separator' ? (
            <div key={`sep-${i}`} className="menu-sep" role="separator" />
          ) : (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={it.disabled}
              className={cx('menu-item', it.danger && 'menu-item-danger')}
              onClick={() => {
                panelRef.current?.hidePopover()
                it.onSelect()
              }}
            >
              {it.icon && <Icon icon={it.icon} size={15} />}
              {it.label}
            </button>
          ),
        )}
      </div>
    </>
  )
}
