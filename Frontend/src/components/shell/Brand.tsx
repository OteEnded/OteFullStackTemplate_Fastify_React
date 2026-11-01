import { Link } from 'react-router-dom'
import { getAppConfig } from '../../config'
import { BrandMark } from '../icons/BrandMark'
import { Icon } from '../ui/Icon'

// App name comes from /config.json (set by the wizard) — never hard-coded in a component.
export function Brand({ to = '/', suffix }: { to?: string; suffix?: string }) {
  const { name } = getAppConfig().app
  return (
    <Link to={to} className="brand">
      <span className="brand-mark" aria-hidden="true">
        <Icon icon={BrandMark} size={17} strokeWidth={2} />
      </span>
      <span className="brand-name">
        {name}
        {suffix && <span className="font-medium text-muted"> {suffix}</span>}
      </span>
    </Link>
  )
}
