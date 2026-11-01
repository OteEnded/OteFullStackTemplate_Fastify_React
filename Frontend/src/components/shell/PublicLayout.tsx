import { Link, Outlet } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { getAppConfig } from '../../config'
import { Icon } from '../ui/Icon'
import { buttonClass } from '../ui/variants'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Brand } from './Brand'

// The public face at "/" (Portal SiteHeader/SiteFooter pattern, re-skinned to the tokens).
// The console lives at /console. Delete this shell + LandingPage if a project has no public page,
// and redirect "/" to "/console" in App.tsx.
export function PublicLayout() {
  const { name } = getAppConfig().app
  return (
    <div className="public">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="public-container public-header">
        <Brand />
        <nav aria-label="Site" className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link to="/console" className={buttonClass('primary')}>
            <Icon icon={LayoutDashboard} size={16} />
            <span>
              Open<span className="hidden sm:inline"> console</span>
            </span>
          </Link>
        </nav>
      </header>
      <main id="main" className="public-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="public-container public-footer">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} {name}
          </span>
          <span>
            <Link to="/login" className="hover:text-ink">
              Sign in
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
