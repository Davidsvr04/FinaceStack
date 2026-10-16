import { AlertTriangle, CheckCircle2, OctagonAlert, type LucideIcon } from 'lucide-react'
import { formatCurrency, formatPercent } from '../../lib/format'

interface Level {
  label: string
  color: string
  icon: LucideIcon
}

// Umbrales orientativos de deuda total / ingresos del mes.
function levelFor(ratio: number): Level {
  if (ratio < 0.3) return { label: 'Saludable', color: 'var(--color-status-good)', icon: CheckCircle2 }
  if (ratio < 0.5) return { label: 'Moderado', color: 'var(--color-status-warning)', icon: AlertTriangle }
  return { label: 'Alto', color: 'var(--color-status-critical)', icon: OctagonAlert }
}

interface DebtMeterProps {
  ratio: number | null
  totalDebt: number
}

/** Medidor del nivel de endeudamiento. El estado siempre lleva icono + texto. */
export function DebtMeter({ ratio, totalDebt }: DebtMeterProps) {
  const level = ratio === null ? null : levelFor(ratio)

  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-sm text-ink-secondary">Nivel de endeudamiento</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {ratio === null ? '—' : formatPercent(ratio)}
      </p>

      {level && ratio !== null ? (
        <>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-hairline"
            role="meter"
            aria-label="Nivel de endeudamiento"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: level.color }}
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-secondary">
            <level.icon className="size-3.5" style={{ color: level.color }} aria-hidden />
            {level.label} · deuda {formatCurrency(totalDebt)}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-ink-muted">Sin ingresos registrados este mes</p>
      )}
    </div>
  )
}
