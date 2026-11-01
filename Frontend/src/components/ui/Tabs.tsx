import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

// Tabs with the WAI-ARIA keyboard model: ←/→ (and Home/End) move AND select, only the
// selected tab is in the Tab order. Controlled: the page owns `value` (put it in the URL
// with useSearchParams if it should survive a reload).

export type TabItem = { value: string; label: ReactNode }

export function Tabs({ items, value, onChange, label, children }: { items: TabItem[]; value: string; onChange: (value: string) => void; label: string; children: ReactNode }) {
  const base = useId()
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = items.findIndex((t) => t.value === value)
    let next = -1
    if (e.key === 'ArrowRight') next = (at + 1) % items.length
    else if (e.key === 'ArrowLeft') next = (at - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(items[next].value)
    listRef.current?.querySelectorAll<HTMLElement>('[role=tab]')[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={listRef} role="tablist" aria-label={label} className="tabs" onKeyDown={onKeyDown}>
        {items.map((t) => {
          const selected = t.value === value
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`${base}-tab-${t.value}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              className="tab"
              onClick={() => onChange(t.value)}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${value}`} tabIndex={0} className="focus-visible:outline-offset-4">
        {children}
      </div>
    </div>
  )
}
