import { AlertTriangle, CheckCircle2, OctagonAlert, Percent, type LucideIcon } from 'lucide-react'
import { formatCurrency, formatPercent } from '../../lib/format'

interface Level {
  label: string
  color: string
  badgeClass: string
  icon: LucideIcon
}

// Umbrales orientativos de deuda total / ingresos del mes.
const THRESHOLDS = [0.3, 0.5]

function levelFor(ratio: number): Level {
  if (ratio < 0.3) {
    return {
      label: 'Saludable',
      color: 'var(--color-status-good)',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
      icon: CheckCircle2,
    }
  }
  if (ratio < 0.5) {
    return {
      label: 'Moderado',
      color: 'var(--color-status-warning)',
      badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
      icon: AlertTriangle,
    }
  }
  return {
    label: 'Alto',
    color: 'var(--color-status-critical)',
    badgeClass: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
    icon: OctagonAlert,
  }
}

interface DebtMeterProps {
  ratio: number | null
  totalDebt: number
}

/** Medidor del nivel de endeudamiento con diseño estilizado y micro-interacciones. */
export function DebtMeter({ ratio, totalDebt }: DebtMeterProps) {
  const level = ratio === null ? null : levelFor(ratio)

  return (
    <div className="card-hover-effect relative overflow-hidden rounded-2xl border border-hairline bg-surface p-4 sm:p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
          Endeudamiento
        </span>
        <div className="grid size-8 shrink-0 place-items-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600">
          <Percent className="size-4" aria-hidden />
        </div>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-ink tabular-nums">
          {ratio === null ? '—' : formatPercent(ratio)}
        </p>
        {level && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${level.badgeClass}`}>
            <level.icon className="size-3" aria-hidden />
            {level.label}
          </span>
        )}
      </div>

      {level && ratio !== null ? (
        <div className="mt-3">
          <div className="relative">
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/50"
              role="meter"
              aria-label="Nivel de endeudamiento"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ratio * 100)}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, ratio * 100)}%`,
                  backgroundColor: level.color,
                }}
              />
            </div>
            {/* Umbrales: hasta 30 % saludable, hasta 50 % moderado. */}
            {THRESHOLDS.map((t) => (
              <span
                key={t}
                className="absolute -top-0.5 h-3 w-0.5 -translate-x-1/2 rounded-full bg-surface ring-1 ring-ink-muted/60"
                style={{ left: `${t * 100}%` }}
                aria-hidden
              />
            ))}
          </div>
          <div className="relative mt-1 h-3.5 text-[10px] font-medium text-ink-muted tabular-nums" aria-hidden>
            {THRESHOLDS.map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: `${t * 100}%` }}>
                {formatPercent(t)}
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Deuda total: <span className="font-semibold text-ink-secondary">{formatCurrency(totalDebt)}</span>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-muted">Sin ingresos registrados este mes</p>
      )}
    </div>
  )
}
