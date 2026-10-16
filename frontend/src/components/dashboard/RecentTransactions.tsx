import type { RecentTransaction } from '../../types'
import { EmptyState } from '../EmptyState'
import { MovementContent } from '../transactions/MovementContent'

export function RecentTransactions({ items }: { items: RecentTransaction[] }) {
  if (items.length === 0) return <EmptyState text="Sin movimientos todavía" />

  return (
    <ul className="divide-y divide-hairline">
      {items.map((tx) => (
        <li key={tx.id} className="flex items-center gap-3 py-3">
          <MovementContent tx={tx} showDate />
        </li>
      ))}
    </ul>
  )
}
