import type { ComponentType, SVGProps } from 'react'
import type { LucideProps } from 'lucide-react'

// One icon wrapper so size/stroke stay consistent: <Icon icon={Plus} />.
// Icons are NAMED imports from lucide-react (tree-shaken per icon) — never `import * as`.
// When lucide lacks a glyph, add a component to components/icons/ with the same props
// (size, strokeWidth, className) and pass it the same way.

export type IconComponent = ComponentType<LucideProps> | ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>

export function Icon({
  icon: Glyph,
  size = 16,
  strokeWidth = 1.75,
  label,
  className,
}: {
  icon: IconComponent
  size?: number
  strokeWidth?: number
  /** Give a label only when the icon stands alone and carries meaning. */
  label?: string
  className?: string
}) {
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  )
}
