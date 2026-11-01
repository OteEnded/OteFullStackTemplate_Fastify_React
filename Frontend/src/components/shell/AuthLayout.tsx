import type { ReactNode } from 'react'
import { getAppConfig } from '../../config'
import { BrandMark } from '../icons/BrandMark'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from '../ui/ThemeToggle'

// Centred card for sign-in / reset / consent (Oteracount AuthCard). The theme toggle sits in
// the corner so people can fix a too-bright screen before signing in.
export function AuthLayout({ title, blurb, children, footer }: { title: ReactNode; blurb?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const { name } = getAppConfig().app
  return (
    <div className="auth">
      <div className="auth-corner">
        <ThemeToggle />
      </div>
      <main className="auth-card">
        <p className="kicker flex items-center gap-2">
          <span className="brand-mark size-5 rounded-sm" aria-hidden="true">
            <Icon icon={BrandMark} size={12} strokeWidth={2.2} />
          </span>
          {name}
        </p>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">{title}</h1>
          {blurb && <p className="text-sm text-muted">{blurb}</p>}
        </div>
        {children}
        {footer && <div className="mt-1 border-t border-line pt-3 text-sm text-muted">{footer}</div>}
      </main>
    </div>
  )
}
