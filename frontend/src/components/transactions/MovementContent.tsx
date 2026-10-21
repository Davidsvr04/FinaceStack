import { formatCurrency, formatDate } from '../../lib/format'
import { describeMovement, isGoalPayment } from './transfer'

type Movement = Parameters<typeof describeMovement>[0] & { amount: number; date: string }

/** Contenido estilizado de una fila de movimiento (icono con color temático, detalle e importe). */
export function MovementContent({ tx, showDate = false }: { tx: Movement; showDate?: boolean }) {
  const { icon: Icon, title, detail, tag } = describeMovement(tx)
  // Pagar la tarjeta con ahorro es un ingreso en la tarjeta, pero dinero que sale de la meta.
  const isIncome = tx.type === 'income' && !isGoalPayment(tx)

  // Tema de color según tipo de movimiento
  let iconTheme = 'bg-slate-100 text-slate-600 border border-slate-200'
  let amountTheme = 'text-ink'

  if (isIncome) {
    iconTheme = 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
    amountTheme = 'text-status-good font-bold'
  } else if (tx.savings_goal) {
    iconTheme = 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/20'
  } else if (tx.transfer_id) {
    iconTheme = 'bg-blue-500/10 text-brand border border-brand/20'
  } else {
    iconTheme = 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
  }

  const sign = isIncome ? '+' : '−'

  return (
    <>
      <span className={`grid size-9.5 shrink-0 place-items-center rounded-xl ${iconTheme} shadow-2xs`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-ink-muted">
          {showDate && `${formatDate(tx.date)} · `}
          {detail}
        </span>
      </span>
      <span className="text-right shrink-0">
        <span className={`block text-sm font-semibold tabular-nums ${amountTheme}`}>
          {sign} {formatCurrency(Number(tx.amount), tx.account?.currency)}
        </span>
        {tag && (
          <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-ink-secondary mt-0.5">
            {tag}
          </span>
        )}
      </span>
    </>
  )
}
