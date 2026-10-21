import { AlertCircle, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const inputClass =
  'w-full rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60 shadow-xs'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-brand to-brand-strong text-white shadow-xs hover:brightness-105 active:scale-[0.98]',
  secondary:
    'border border-hairline bg-surface text-ink hover:bg-ink/[0.03] shadow-xs active:scale-[0.98]',
  ghost:
    'text-ink-secondary hover:bg-ink/[0.05] hover:text-ink',
  danger:
    'border border-status-critical/30 bg-status-critical/5 text-status-critical hover:bg-status-critical/10 active:scale-[0.98]',
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function IconButton({
  label,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-8.5 place-items-center rounded-xl text-ink-muted transition-all hover:bg-ink/[0.05] hover:text-ink active:scale-95 disabled:opacity-40 ${className}`}
      {...props}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="block text-xs font-semibold tracking-wider text-ink-secondary uppercase">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-hairline bg-surface p-5 md:p-6 shadow-xs transition-shadow hover:shadow-sm ${className}`}>
      {children}
    </section>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-xl border border-status-critical/30 bg-status-critical/5 p-3.5 text-sm text-status-critical shadow-xs"
    >
      <div className="flex items-center gap-2.5">
        <AlertCircle className="size-4.5 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-semibold text-brand hover:underline"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <div className="flex items-center gap-1.5 text-xs font-medium text-status-critical mt-1">
      <AlertCircle className="size-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  ) : null
}

/** Barra de progreso 0..1 estilizada. */
export function ProgressBar({
  value,
  color = 'var(--color-brand)',
  label,
}: {
  value: number
  color?: string
  label: string
}) {
  const pct = Math.max(0, Math.min(100, value * 100))
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/50"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className="h-full rounded-full transition-all duration-500 ease-out shadow-xs"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

/** Hoja inferior en móvil, diálogo centrado en escritorio con desenfoque de fondo. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-xs md:items-center md:p-4 animate-in fade-in duration-150"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-2xl md:max-w-md md:rounded-2xl border border-hairline animate-in zoom-in-95 duration-150"
      >
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-hairline pb-4">
          <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2.5 pt-4 border-t border-hairline mt-4">{children}</div>
}

interface PanelProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

/** Tarjeta con título, subtítulo y acción opcional para gráficas y listas. */
export function Panel({ title, subtitle, action, className = '', children }: PanelProps) {
  return (
    <section className={`rounded-2xl border border-hairline bg-surface p-5 sm:p-6 shadow-xs ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3 border-b border-hairline/60 pb-3">
        <div>
          <h2 className="font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </header>
      {children}
    </section>
  )
}
