import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  Mail,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword'

const STORAGE_KEY_REMEMBER_EMAIL = 'finacestack_saved_email'

export function LoginPage() {
  const { session, loading, signIn, signUp, resetPassword } = useAuth()
  const location = useLocation()

  const [mode, setMode] = useState<AuthMode>('signIn')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_REMEMBER_EMAIL) || ''
    } catch {
      return ''
    }
  })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY_REMEMBER_EMAIL))
    } catch {
      return false
    }
  })

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Redirigir si ya tiene sesión activa
  if (!loading && session) {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  // Medidor de fortaleza de contraseña (en modo registro)
  const passwordStrength = (() => {
    if (!password) return { score: 0, label: 'Sin ingresar', color: 'bg-hairline' }
    let score = 0
    if (password.length >= 6) score++
    if (password.length >= 10) score++
    if (/[0-9]/.test(password) && /[a-zA-Z]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 1) return { score: 1, label: 'Débil (mín. 6 caracteres)', color: 'bg-status-critical' }
    if (score === 2) return { score: 2, label: 'Aceptable (agrega números)', color: 'bg-status-warning' }
    if (score === 3) return { score: 3, label: 'Buena', color: 'bg-brand' }
    return { score: 4, label: 'Muy segura', color: 'bg-status-good' }
  })()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)

    try {
      // Guardar o borrar correo recordado
      if (rememberMe && email.trim()) {
        localStorage.setItem(STORAGE_KEY_REMEMBER_EMAIL, email.trim())
      } else {
        localStorage.removeItem(STORAGE_KEY_REMEMBER_EMAIL)
      }

      if (mode === 'signIn') {
        await signIn(email.trim(), password)
      } else if (mode === 'signUp') {
        await signUp(email.trim(), password, fullName.trim())
        setNotice('¡Cuenta creada exitosamente! Revisa tu bandeja de correo para verificarla si tu proyecto lo solicita.')
      } else if (mode === 'forgotPassword') {
        await resetPassword(email.trim())
        setNotice('Enlace de recuperación enviado. Revisa tu correo electrónico para restablecer tu contraseña.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo completar la operación'
      // Traducir mensajes comunes de Supabase Auth
      if (msg.includes('Invalid login credentials')) {
        setError('Correo o contraseña incorrectos. Por favor verifica tus credenciales.')
      } else if (msg.includes('Email not confirmed')) {
        setError('Debes confirmar tu correo electrónico antes de ingresar.')
      } else if (msg.includes('User already registered')) {
        setError('Este correo electrónico ya está registrado. Intenta iniciar sesión.')
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const isSignUp = mode === 'signUp'
  const isForgot = mode === 'forgotPassword'

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-page text-ink selection:bg-brand/20">
      {/* ======================================================== */}
      {/* PANEL IZQUIERDO: Showcase Fintech Visual (Desktop lg+)    */}
      {/* ======================================================== */}
      <div className="relative hidden lg:flex lg:w-[48%] xl:w-[52%] overflow-hidden bg-gradient-to-br from-[#0c1427] via-[#0f1d38] to-[#080d1a] text-white p-12 flex-col justify-between">
        {/* Luces ambientales y mallas de gradiente decorativas */}
        <div
          aria-hidden="true"
          className="absolute -top-32 -left-32 size-96 rounded-full bg-brand/25 blur-3xl pointer-events-none animate-pulse-soft"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -right-24 size-96 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/3 size-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none animate-pulse-soft"
        />

        {/* Cabecera de marca con insignia */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-tr from-brand to-cyan-400 text-white shadow-lg shadow-brand/30 ring-1 ring-white/20">
              <Wallet className="size-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">FinaceStack</span>
              <span className="ml-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-cyan-300">
                PRO
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/60 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>Cifrado bancario 256-bit</span>
          </div>
        </div>

        {/* Tarjetas interactivas flotantes en vivo (Showcase) */}
        <div className="relative z-10 my-auto py-8 space-y-6 max-w-lg">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-medium text-cyan-300 backdrop-blur-md mb-4">
              <Sparkles className="size-3.5" />
              Gestión Financiera Inteligente
            </div>
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight text-white">
              Toma el control absoluto de tus finanzas personales y cuotas.
            </h2>
            <p className="mt-3 text-sm xl:text-base text-white/70 leading-relaxed">
              Consolida tus cuentas bancarias, monitorea consumos en tarjetas de crédito y alcanza tus metas de ahorro con una interfaz clara y en tiempo real.
            </p>
          </div>

          {/* Tarjeta 1: Vista previa de Balance y Métricas */}
          <div className="animate-float-slow rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-medium tracking-wider text-white/60">Balance Total Disponible</p>
                <p className="mt-1 text-2xl xl:text-3xl font-extrabold tracking-tight text-white">$ 14,850,200 <span className="text-xs font-normal text-white/60">COP</span></p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                <TrendingUp className="size-3.5" />
                +8.4% este mes
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-white/10 text-xs">
              <div>
                <span className="text-white/50 block">Cuentas</span>
                <span className="font-semibold text-white/90">3 Activas</span>
              </div>
              <div>
                <span className="text-white/50 block">Tarjetas</span>
                <span className="font-semibold text-white/90">2 Vinculadas</span>
              </div>
              <div>
                <span className="text-white/50 block">Ahorro activo</span>
                <span className="font-semibold text-cyan-300">$ 4.2M</span>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Meta de ahorro con barra */}
          <div className="animate-float-reverse rounded-xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-lg shadow-lg max-w-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <PiggyBank className="size-5" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-white/90">Fondo de Emergencia</span>
                  <span className="text-emerald-400">72%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: '72%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer del panel visual */}
        <div className="relative z-10 flex items-center justify-between text-xs text-white/50 pt-4 border-t border-white/10">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><CreditCard className="size-3.5 text-cyan-400" /> Control de Cuotas</span>
            <span className="flex items-center gap-1.5"><Wallet className="size-3.5 text-emerald-400" /> Presupuestos</span>
          </div>
          <span>FinaceStack © {new Date().getFullYear()}</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PANEL DERECHO: Formulario de Autenticación                */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-12 relative overflow-y-auto">
        {/* Fondo sutil con destello de marca en móvil */}
        <div
          aria-hidden="true"
          className="lg:hidden absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-brand/10 blur-3xl rounded-full pointer-events-none"
        />

        <div className="w-full max-w-md">
          {/* Logo y Encabezado en móvil y desktop */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-brand/10 border border-brand/20 text-brand-strong mb-4 shadow-sm">
              <Wallet className="size-7 text-brand" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              {isForgot
                ? 'Recupera tu acceso'
                : isSignUp
                  ? 'Crea tu cuenta en FinaceStack'
                  : 'Bienvenido de nuevo'}
            </h1>
            <p className="mt-2 text-sm text-ink-secondary">
              {isForgot
                ? 'Ingresa tu correo para recibir un enlace de restablecimiento seguro.'
                : isSignUp
                  ? 'Empieza a gestionar tus ingresos, gastos y tarjetas hoy mismo.'
                  : 'Ingresa tus credenciales para acceder a tu panel financiero.'}
            </p>
          </div>

          {/* Selector de Pestañas (Segmented control) si no está en modo recuperación */}
          {!isForgot && (
            <div className="mb-6 grid grid-cols-2 p-1 rounded-xl bg-hairline/60 border border-hairline text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  setMode('signIn')
                  setError(null)
                  setNotice(null)
                }}
                className={`py-2 rounded-lg transition-all duration-200 text-center ${
                  !isSignUp
                    ? 'bg-surface text-ink font-semibold shadow-sm'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signUp')
                  setError(null)
                  setNotice(null)
                }}
                className={`py-2 rounded-lg transition-all duration-200 text-center ${
                  isSignUp
                    ? 'bg-surface text-ink font-semibold shadow-sm'
                    : 'text-ink-secondary hover:text-ink'
                }`}
              >
                Registrarse
              </button>
            </div>
          )}

          {/* Mensajes de Alerta y Notificación */}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-status-critical/30 bg-status-critical/5 p-3.5 text-sm text-status-critical animate-in fade-in"
            >
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-status-critical/70 hover:text-status-critical text-xs font-semibold ml-2"
                aria-label="Cerrar alerta"
              >
                ✕
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-5 flex items-start gap-3 rounded-xl border border-status-good/30 bg-status-good/5 p-3.5 text-sm text-status-good animate-in fade-in"
            >
              <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{notice}</div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-status-good/70 hover:text-status-good text-xs font-semibold ml-2"
                aria-label="Cerrar notificación"
              >
                ✕
              </button>
            </div>
          )}

          {/* Formulario Principal */}
          <div className="rounded-2xl border border-hairline bg-surface p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo Nombre Completo (Solo en Registro) */}
              {isSignUp && (
                <div>
                  <label htmlFor="fullName" className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary mb-1.5">
                    Nombre completo
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 size-4 text-ink-muted pointer-events-none" />
                    <input
                      id="fullName"
                      required
                      type="text"
                      placeholder="Ej. David Rivera"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      className="w-full rounded-xl border border-hairline bg-surface pl-10 pr-3.5 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                </div>
              )}

              {/* Campo Correo Electrónico */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 size-4 text-ink-muted pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full rounded-xl border border-hairline bg-surface pl-10 pr-3.5 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>

              {/* Campo Contraseña (No visible en modo forgotPassword) */}
              {!isForgot && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                      Contraseña
                    </label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgotPassword')
                          setError(null)
                          setNotice(null)
                        }}
                        className="text-xs font-medium text-brand-strong hover:underline hover:text-brand"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3.5 size-4 text-ink-muted pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder={isSignUp ? 'Crea una contraseña segura' : 'Tu contraseña actual'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      className="w-full rounded-xl border border-hairline bg-surface pl-10 pr-11 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 p-1 text-ink-muted hover:text-ink transition-colors"
                      title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>

                  {/* Medidor de Fortaleza en Modo Registro */}
                  {isSignUp && password.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink-muted">Seguridad:</span>
                        <span className="font-semibold text-ink-secondary">{passwordStrength.label}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 h-1.5">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`rounded-full transition-all duration-300 ${
                              passwordStrength.score >= step ? passwordStrength.color : 'bg-hairline'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Casilla "Recordar mi correo" (Solo en login) */}
              {!isSignUp && !isForgot && (
                <div className="flex items-center pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-ink-secondary hover:text-ink">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="size-4 rounded border-hairline text-brand focus:ring-brand/30 accent-brand cursor-pointer"
                    />
                    <span>Recordar mi correo en este dispositivo</span>
                  </label>
                </div>
              )}

              {/* Botón de Envío */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white shadow-sm hover:bg-brand-strong active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin size-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Procesando…
                  </span>
                ) : (
                  <>
                    <span>
                      {isForgot
                        ? 'Enviar enlace de recuperación'
                        : isSignUp
                          ? 'Crear mi cuenta gratuita'
                          : 'Iniciar sesión'}
                    </span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>

            {/* Alternar modo desde el pie de la tarjeta */}
            {isForgot ? (
              <button
                type="button"
                onClick={() => {
                  setMode('signIn')
                  setError(null)
                  setNotice(null)
                }}
                className="mt-5 flex items-center justify-center gap-2 w-full text-center text-sm font-medium text-ink-secondary hover:text-ink"
              >
                <ArrowLeft className="size-4" />
                <span>Volver al inicio de sesión</span>
              </button>
            ) : (
              <div className="mt-5 pt-5 border-t border-hairline text-center">
                <p className="text-sm text-ink-secondary">
                  {isSignUp ? '¿Ya tienes una cuenta registrada?' : '¿Aún no tienes cuenta en FinaceStack?'}
                  <button
                    type="button"
                    onClick={() => {
                      setMode(isSignUp ? 'signIn' : 'signUp')
                      setError(null)
                      setNotice(null)
                    }}
                    className="ml-1.5 font-semibold text-brand-strong hover:underline hover:text-brand"
                  >
                    {isSignUp ? 'Inicia sesión aquí' : 'Regístrate gratis'}
                  </button>
                </p>
              </div>
            )}
          </div>

          {/* Garantías de seguridad y privacidad al pie */}
          <div className="mt-6 text-center text-xs text-ink-muted space-y-1">
            <p className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="size-3.5 text-status-good" />
              <span>Conexión protegida de extremo a extremo mediante Supabase Auth</span>
            </p>
            <p>Tus finanzas y credenciales están aisladas y resguardadas bajo cifrado estándar bancario.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
