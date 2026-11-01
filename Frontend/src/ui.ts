// Shared Tailwind class strings for page LAYOUT (EAP admin/ui.ts + OSM ui.ts). One source,
// so every page has the same rhythm. Look-and-feel primitives (buttons, inputs, chips…) are
// CSS component classes in styles/components.css; this file is only arrangement.

export const ui = {
  /** Vertical stack for a page's sections. */
  page: 'flex flex-col gap-5',
  /** Stat tiles: as many 150px+ columns as fit (two on a phone). */
  stats: 'grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]',
  /** Two columns on desktop, one on a phone (forms, settings). */
  grid2: 'grid gap-3 sm:grid-cols-2',
  /** Responsive card grid. */
  cards: 'grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]',
  /** Small heading inside a page (above a table or card group). */
  sectionTitle: 'text-base font-semibold',
  /** The quiet line under a section title. */
  sectionNote: 'text-sm text-muted',
  /** Label/value list (About panels). */
  dl: 'grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-sm',
  dt: 'text-muted',
  dd: 'm-0 min-w-0 break-words',
  /** Row of actions inside a table cell. */
  rowActions: 'flex flex-nowrap items-center justify-end gap-1',
}
