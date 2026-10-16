import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router'
import { formatCurrency, formatPercent } from '../../lib/format'
import type { GoalSummary } from '../../types'
import { ProgressBar } from '../ui'

const MAX_GOALS = 4

/** Progreso de las metas de ahorro (las más próximas a vencer primero). */
export function SavingsGoalsSummary({ goals }: { goals: GoalSummary[] }) {
  if (goals.length === 0) {
    return (
      <p className="text-sm text-ink-secondary">
        Aún no tienes metas.{' '}
        <Link to="/ahorros" className="font-medium text-brand-strong hover:underline">
          Crea una meta de ahorro
        </Link>
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {goals.slice(0, MAX_GOALS).map((goal) => {
          const done = goal.progress >= 1
          return (
            <li key={goal.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{goal.name}</span>
                <span className="shrink-0 text-xs text-ink-secondary tabular-nums">
                  {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                </span>
              </div>
              <ProgressBar
                value={goal.progress}
                label={`Progreso de ${goal.name}`}
                color={done ? 'var(--color-status-good)' : undefined}
              />
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                {done ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-status-good" aria-hidden />
                    Meta cumplida
                  </>
                ) : (
                  formatPercent(goal.progress)
                )}
              </p>
            </li>
          )
        })}
      </ul>
      <Link to="/ahorros" className="block text-sm font-medium text-brand-strong hover:underline">
        {goals.length > MAX_GOALS ? `Ver las ${goals.length} metas` : 'Ir a ahorros'}
      </Link>
    </div>
  )
}
