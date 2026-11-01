import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { EmptyState } from '../components/ui/Card'
import { Icon } from '../components/ui/Icon'
import { buttonClass } from '../components/ui/variants'

// 404 for page routes (the backend answers /api/* and missing files itself). Inside the console
// it renders in the console shell with "Back to console"; elsewhere, standalone.
export default function NotFoundPage({ inConsole = false }: { inConsole?: boolean }) {
  const { pathname } = useLocation()
  const body = (
    <EmptyState
      icon={Compass}
      title="Page not found"
      level={1}
      action={
        <Link to={inConsole ? '/console' : '/'} className={buttonClass('primary')}>
          <Icon icon={ArrowLeft} />
          {inConsole ? 'Back to console' : 'Back to home'}
        </Link>
      }
    >
      There is nothing at <code className="code-chip break-all">{pathname}</code>. It may have moved, or the link has a typo.
    </EmptyState>
  )
  return (
    <div data-page="not-found" className={inConsole ? 'card' : 'auth'}>
      {inConsole ? body : <div className="auth-card">{body}</div>}
    </div>
  )
}
