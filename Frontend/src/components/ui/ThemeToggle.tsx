import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePref } from '../../lib/theme'
import { cx } from '../../lib/cx'
import { Icon } from './Icon'
import { buttonClass } from './variants'

// One button that cycles dark → light → system. The aria-label says what it IS and what a
// press DOES (Portal ThemeButton) — the icon alone doesn't.
const NEXT: Record<ThemePref, ThemePref> = { dark: 'light', light: 'system', system: 'dark' }
const NAME: Record<ThemePref, string> = { dark: 'Dark', light: 'Light', system: 'System' }
const GLYPH = { dark: Moon, light: Sun, system: Monitor }

export function ThemeToggle({ showLabel = false, className }: { showLabel?: boolean; className?: string }) {
  const { pref, setPref } = useTheme()
  const label = `Theme: ${NAME[pref]}. Switch to ${NAME[NEXT[pref]]}`
  return (
    <button
      type="button"
      className={buttonClass('ghost', 'md', cx(!showLabel && 'btn-icon', className))}
      aria-label={label}
      title={label}
      data-ui="theme-toggle"
      onClick={() => setPref(NEXT[pref])}
    >
      <Icon icon={GLYPH[pref]} size={16} />
      {showLabel && NAME[pref]}
    </button>
  )
}
