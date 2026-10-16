import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const inputClass =
  'w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong',
  secondary: 'border border-hairline bg-surface text-ink hover:bg-ink/5',
  ghost: 'text-ink-secondary hover:bg-ink/5 hover:text-ink',
  danger: 'border border-status-critical/40 text-status-critical hover:bg-status-critical/5',
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
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
      className={`grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40 ${className}`}
      {...props}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-ink-secondary">{label}</span>
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
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-xl border border-hairline bg-surface p-4 md:p-5 ${className}`}>{children}</section>
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-xl border border-status-critical/30 bg-status-critical/5 p-3 text-sm"
    >
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-medium text-brand-strong">
          Reintentar
        </button>
      )}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p className="text-sm text-status-critical">{message}</p> : null
}

/** Barra de progreso 0..1. */
export function ProgressBar({ value, color = 'var(--color-brand)', label }: { value: number; color?: string; label: string }) {
  const pct = Math.max(0, Math.min(100, value * 100))
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-hairline"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

/** Hoja inferior en móvil, diálogo centrado en escritorio. Cierra con Escape o clic fuera. */
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center md:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl md:max-w-md md:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
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
  return <div className="flex flex-wrap justify-end gap-2 pt-2">{children}</div>
}
