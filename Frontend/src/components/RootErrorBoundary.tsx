import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { BOOT_GUARD, CHUNK_GUARD } from '../lib/lazyWithReload'
import { Icon } from './ui/Icon'

// Last line of defence against a blank screen (EAP): catches any render-time crash —
// including a route chunk that still failed after lazyWithReload's one-shot reload — and
// shows a card with a Reload button instead of an empty page.

type Props = { children: ReactNode }
type State = { error: Error | null }

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('RootErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <ErrorFallback error={this.state.error} />
  }
}

export function ErrorFallback({ error }: { error?: Error | null }) {
  return (
    <div className="auth">
      <div className="auth-card items-center text-center" role="alert">
        <span className="grid size-11 place-items-center rounded-full border border-danger-edge bg-danger-soft text-danger">
          <Icon icon={TriangleAlert} size={20} />
        </span>
        <h1 className="text-lg">This page didn’t finish loading</h1>
        <p className="text-sm text-muted">A network hiccup or an app update can cause this. Reloading usually fixes it.</p>
        {import.meta.env.DEV && error && <pre className="code-chip max-w-full overflow-auto p-2 text-left text-2xs whitespace-pre-wrap">{error.message}</pre>}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            // clear both one-shot guards so the manual reload gets a fresh budget
            try {
              sessionStorage.removeItem(BOOT_GUARD)
              sessionStorage.removeItem(CHUNK_GUARD)
            } catch {
              /* storage blocked */
            }
            window.location.reload()
          }}
        >
          <Icon icon={RotateCw} size={15} />
          Reload
        </button>
      </div>
    </div>
  )
}
