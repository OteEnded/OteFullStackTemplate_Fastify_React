import type { SVGProps } from 'react'

// Custom icons live in this folder — for glyphs lucide doesn't have. Same props as a lucide
// icon (size, strokeWidth, className) so <Icon icon={BrandMark} /> works unchanged.
// This one is the template's placeholder brand mark: replace it with your product's.
export function BrandMark({ size = 16, strokeWidth = 1.75, ...props }: SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
      <path d="M12 12 4 7.5M12 12l8-4.5M12 12v9" />
    </svg>
  )
}
