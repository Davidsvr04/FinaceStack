import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { formatCurrency, formatDate } from '../../lib/format'
import type { RecentTransaction } from '../../types'
import { EmptyState } from '../EmptyState'

export function RecentTransactions({ items }: { items: RecentTransaction[] }) {
  if (items.length === 0) return <EmptyState text="Sin movimientos todavía" />

  return (
    <ul className="divide-y divide-hairline">
      {items.map((tx) => {
        const isIncome = tx.type === 'income'
        const Icon = isIncome ? ArrowDownLeft : ArrowUpRight
        return (
          <li key={tx.id} className="flex items-center gap-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/5 text-ink-secondary">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {tx.description || tx.category?.name || (isIncome ? 'Ingreso' : 'Gasto')}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {formatDate(tx.date)} · {tx.account?.name ?? '—'}
                {tx.category && ` · ${tx.category.name}`}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {isIncome ? '+' : '−'}
              {formatCurrency(tx.amount)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
