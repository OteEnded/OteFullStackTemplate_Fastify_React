import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronRight, LogIn, LogOut, Menu as MenuIcon } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { navItemFor, visibleNav } from '../../nav'
import { backdropPointerDown, backdropPointerUp } from '../../lib/overlay'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/Button'
import { buttonClass } from '../ui/variants'
import { ThemeToggle } from '../ui/ThemeToggle'
import { PageLoading } from '../ui/Spinner'
import { Brand } from './Brand'

// Console shell (Oteracount layout.tsx shape + Portal StaffShell permission filter):
// grouped sticky side nav from NAV (nav.ts), a topbar with the page title / theme / user,
// and the content column. Below 900px the side nav is an off-canvas drawer.

export function ConsoleLayout() {
  const { user, can, signOut } = useAuth()
  const { pathname } = useLocation()
  const groups = visibleNav(can)
  const current = navItemFor(pathname)
  const [drawer, setDrawer] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const sideRef = useRef<HTMLElement>(null)

  const closeDrawer = () => {
    setDrawer(false)
    toggleRef.current?.focus()
  }

  // Drawer: Esc closes it; opening moves focus into it.
  useEffect(() => {
    if (!drawer) return
    sideRef.current?.querySelector<HTMLElement>('a.nav-link')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawer(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  return (
    <div className="console" data-drawer={drawer ? 'open' : 'closed'}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside ref={sideRef} id="console-nav" className="console-side" aria-label="Console">
        <Brand to="/console" />
        <nav aria-label="Console sections" className="flex flex-col">
          {groups.map((g) => (
            <div key={g.label} className="nav-group">
              <span className="nav-group-label" aria-hidden="true">
                {g.label}
              </span>
              {g.items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={() => setDrawer(false)}>
                  <Icon icon={n.icon} size={16} />
                  {n.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="nav-spacer" />
        <Link to="/" className="nav-link">
          <Icon icon={ArrowLeft} size={16} />
          Public page
        </Link>
      </aside>
      <div className="drawer-scrim" aria-hidden="true" onPointerDown={backdropPointerDown} onPointerUp={(e) => backdropPointerUp(e) && closeDrawer()} />

      <div className="console-main">
        <header className="topbar">
          <div className="topbar-title">
            <IconButton
              ref={toggleRef}
              icon={MenuIcon}
              label="Open navigation"
              className="drawer-toggle"
              aria-expanded={drawer}
              aria-controls="console-nav"
              onClick={() => setDrawer(true)}
            />
            {/* Where am I (the page's own PageHeader carries the h1). */}
            <nav aria-label="Breadcrumb" className="crumbs">
              <Link to="/console">Console</Link>
              {current && current.to !== '/console' && (
                <>
                  <Icon icon={ChevronRight} size={14} className="text-faint" />
                  <span aria-current="page">{current.label}</span>
                </>
              )}
            </nav>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            {user ? (
              <>
                <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
                <IconButton icon={LogOut} label="Sign out" onClick={() => void signOut()} />
              </>
            ) : (
              <Link to="/login" className={buttonClass('default', 'sm')}>
                <Icon icon={LogIn} size={14} />
                Sign in
              </Link>
            )}
          </div>
        </header>
        <main id="main" className="console-content" tabIndex={-1}>
          {/* Pages are lazy chunks: the shell stays put while one loads. */}
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
