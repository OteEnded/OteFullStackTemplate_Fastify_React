import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, KeyRound, LogIn } from 'lucide-react'
import { OTERACOUNT_START_URL, useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api'
import { AuthLayout } from '../components/shell/AuthLayout'
import { Button } from '../components/ui/Button'
import { Callout } from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Icon } from '../components/ui/Icon'

// What /api/auth/oteracount/callback can send back in ?error=
const CALLBACK_ERRORS: Record<string, string> = {
  oteracount: 'Signing in with Oteracount didn’t complete. Try again.',
  oteracount_expired: 'The Oteracount sign-in took too long. Try again.',
  account_disabled: 'This account is disabled. Ask an administrator.',
}

// Only same-site paths are followed after sign-in (never an absolute URL from the query).
const safeNext = (value: string | null) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/console')

// Sign-in card for the backend's optional auth module: username + password (config root /
// local users) and, when the server has it configured, "Login with Oteracount".
export default function LoginPage() {
  const { signIn, enabled, status, methods } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(CALLBACK_ERRORS[params.get('error') ?? ''] ?? '')
  const [missing, setMissing] = useState<{ username?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)

  if (status === 'signed-in') return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const m = { username: username.trim() ? undefined : 'Enter your username.', password: password ? undefined : 'Enter your password.' }
    setMissing(m)
    if (m.username || m.password) return
    setBusy(true)
    setError('')
    try {
      await signIn(username.trim(), password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      blurb="Use your account to open the console."
      footer={
        !enabled && status !== 'loading' && (
          <Link to="/console" className="inline-flex items-center gap-1.5 text-accent-deep hover:underline">
            Continue to the console
            <Icon icon={ArrowRight} size={14} />
          </Link>
        )
      }
    >
      {!enabled && status !== 'loading' && (
        <Callout tone="info">Sign-in is off on this server (auth.enabled is false) — the console is open to anyone who can reach it.</Callout>
      )}
      {error && (
        <Callout tone="danger" title="Couldn’t sign you in">
          {error}
        </Callout>
      )}
      {enabled && methods.oteracount && (
        <Button variant="primary" icon={KeyRound} className="btn-block" onClick={() => window.location.assign(OTERACOUNT_START_URL)}>
          Login with Oteracount
        </Button>
      )}
      {enabled && methods.password && (
        <form className="flex flex-col gap-3.5" onSubmit={(e) => void submit(e)} noValidate>
          <Field label="Username" error={missing.username}>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="off" spellCheck={false} autoFocus />
          </Field>
          <Field label="Password" error={missing.password}>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Button type="submit" variant={methods.oteracount ? 'default' : 'primary'} icon={LogIn} loading={busy} className="btn-block mt-1">
            Sign in
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
