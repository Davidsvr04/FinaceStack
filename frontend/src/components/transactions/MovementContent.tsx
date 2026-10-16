import { formatCurrency, formatDate } from '../../lib/format'
import { describeMovement } from './transfer'

type Movement = Parameters<typeof describeMovement>[0] & { amount: number; date: string }

/** Contenido de una fila de movimiento (icono, título, detalle e importe). */
export function MovementContent({ tx, showDate = false }: { tx: Movement; showDate?: boolean }) {
  const { icon: Icon, title, detail, tag } = describeMovement(tx)
  const sign = tx.type === 'income' ? '+' : '−'

  return (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/5 text-ink-secondary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-ink-muted">
          {showDate && `${formatDate(tx.date)} · `}
          {detail}
        </span>
      </span>
      <span className="text-right">
        <span className={`block text-sm font-semibold tabular-nums ${tag ? 'text-ink-secondary' : ''}`}>
          {sign}
          {formatCurrency(Number(tx.amount))}
        </span>
        {tag && <span className="block text-[11px] text-ink-muted">{tag}</span>}
      </span>
    </>
  )
}
