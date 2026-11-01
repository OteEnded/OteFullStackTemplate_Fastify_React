import { LayoutDashboard, Settings, Shapes } from 'lucide-react'
import { ListChecks } from 'lucide-react' // @demo
import type { IconComponent } from './components/ui/Icon'

// The console's side nav — ONE config, grouped by the job people come to do (OSM groups by
// Observe / Expose / …). List only what exists. `can` hides an item the user may not use
// (Portal StaffShell): the check receives useAuth().can — with auth off, everything shows.
// The topbar title comes from here too (the longest matching `to`).

export type NavItem = {
  to: string
  label: string
  icon: IconComponent
  /** Match exactly (for the console home). */
  end?: boolean
  /** Permission key checked with useAuth().can(); omit = everyone. */
  permission?: string
  /** Dev-only pages (vite dev server), absent from the production build. */
  devOnly?: boolean
}

export type NavGroup = { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ to: '/console', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Data',
    items: [
      { to: '/console/items', label: 'Template items', icon: ListChecks }, // @demo
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/console/settings', label: 'Settings', icon: Settings },
      { to: '/console/ui', label: 'UI kit', icon: Shapes, devOnly: true },
    ],
  },
]

/** Groups the current user may see (empty groups dropped). */
export function visibleNav(can: (permission: string) => boolean): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.devOnly || import.meta.env.DEV) && (!i.permission || can(i.permission))),
  })).filter((g) => g.items.length > 0)
}

/** The nav item for a path (longest prefix wins) — used for the topbar title. */
export function navItemFor(pathname: string): NavItem | undefined {
  let best: NavItem | undefined
  for (const g of NAV) {
    for (const i of g.items) {
      const hit = i.end ? pathname === i.to || pathname === `${i.to}/` : pathname === i.to || pathname.startsWith(`${i.to}/`)
      if (hit && (!best || i.to.length > best.to.length)) best = i
    }
  }
  return best
}
