import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'

type Mode = 'signIn' | 'signUp'

export function LoginPage() {
  const { session, loading, signIn, signUp } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('signIn')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      if (mode === 'signIn') {
        await signIn(email, password)
      } else {
        await signUp(email, password, fullName)
        setNotice('Cuenta creada. Revisa tu correo para confirmarla si tu proyecto lo exige.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación')
    } finally {
      setSubmitting(false)
    }
  }

  const isSignUp = mode === 'signUp'
  const inputClass =
    'w-full rounded-lg border border-hairline bg-surface px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">FinaceStack</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {isSignUp ? 'Crea tu cuenta para empezar' : 'Inicia sesión para ver tus finanzas'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {isSignUp && (
            <label className="block space-y-1 text-sm">
              <span className="text-ink-secondary">Nombre completo</span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                className={inputClass}
              />
            </label>
          )}
          <label className="block space-y-1 text-sm">
            <span className="text-ink-secondary">Correo</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-ink-secondary">Contraseña</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className={inputClass}
            />
          </label>

          {error && <p className="text-sm text-status-critical">{error}</p>}
          {notice && <p className="text-sm text-ink-secondary">{notice}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-strong disabled:opacity-60"
          >
            {submitting ? 'Procesando…' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isSignUp ? 'signIn' : 'signUp')
            setError(null)
            setNotice(null)
          }}
          className="mt-4 w-full text-center text-sm text-brand-strong hover:underline"
        >
          {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </button>
      </div>
    </div>
  )
}
