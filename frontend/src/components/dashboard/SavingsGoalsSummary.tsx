import { ArrowRight, PiggyBank, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { formatCurrency, formatPercent } from '../../lib/format'
import type { GoalSummary } from '../../types'
import { Button, ProgressBar } from '../ui'

const MAX_GOALS = 4

/** Progreso de las metas de ahorro en el dashboard. */
export function SavingsGoalsSummary({ goals }: { goals: GoalSummary[] }) {
  if (goals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-hairline p-5 text-center">
        <p className="text-xs text-ink-muted">Aún no tienes metas de ahorro activas.</p>
        <Link to="/ahorros" className="inline-block mt-3">
          <Button variant="secondary" className="text-xs px-3 py-1.5">
            <Plus className="size-3.5" />
            Crear primera meta
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3.5">
        {goals.slice(0, MAX_GOALS).map((goal) => {
          const done = goal.progress >= 1
          return (
            <li key={goal.id} className="rounded-xl bg-slate-50/70 p-3 border border-hairline/60">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="grid size-6 shrink-0 place-items-center rounded-lg bg-cyan-500/10 text-cyan-600">
                    <PiggyBank className="size-3.5" />
                  </div>
                  <span className="truncate text-xs font-bold text-ink">{goal.name}</span>
                </div>
                <span className={`text-[11px] font-bold ${done ? 'text-status-good' : 'text-brand'}`}>
                  {done ? '100%' : formatPercent(goal.progress)}
                </span>
              </div>

              <ProgressBar
                value={goal.progress}
                label={`Progreso de ${goal.name}`}
                color={done ? 'var(--color-status-good)' : 'var(--color-brand)'}
              />

              <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted tabular-nums">
                <span>{formatCurrency(goal.current_amount)}</span>
                <span>Meta: {formatCurrency(goal.target_amount)}</span>
              </div>
            </li>
          )
        })}
      </ul>

      <Link
        to="/ahorros"
        className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/5 hover:border-brand/20 transition-all shadow-2xs"
      >
        <span>{goals.length > MAX_GOALS ? `Ver todas las metas (${goals.length})` : 'Gestionar todas las metas'}</span>
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}
