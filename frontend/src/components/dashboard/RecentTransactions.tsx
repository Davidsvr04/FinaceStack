import { Link } from 'react-router'
import type { RecentTransaction } from '../../types'
import { EmptyState } from '../EmptyState'
import { MovementContent } from '../transactions/MovementContent'

export function RecentTransactions({ items }: { items: RecentTransaction[] }) {
  if (items.length === 0) return <EmptyState text="Sin movimientos todavía" />

  return (
    <ul className="divide-y divide-hairline">
      {items.map((tx) => (
        <li key={tx.id}>
          {/* Abre Movimientos en el mes del movimiento, donde se puede editar o eliminar. */}
          <Link
            to={`/movimientos?mes=${tx.date.slice(0, 7)}`}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-ink/[0.03]"
          >
            <MovementContent tx={tx} showDate />
          </Link>
        </li>
      ))}
    </ul>
  )
}
