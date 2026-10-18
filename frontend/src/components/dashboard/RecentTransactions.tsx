import { Link } from 'react-router'
import type { RecentTransaction } from '../../types'
import { EmptyState } from '../EmptyState'
import { MovementContent } from '../transactions/MovementContent'

export function RecentTransactions({ items }: { items: RecentTransaction[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Sin movimientos registrados"
        text="Aún no has registrado transacciones recientes en tus cuentas."
      />
    )
  }

  return (
    <ul className="divide-y divide-hairline">
      {items.map((tx) => (
        <li key={tx.id}>
          <Link
            to={`/movimientos?mes=${tx.date.slice(0, 7)}`}
            className="-mx-2 flex items-center gap-3.5 rounded-xl px-2.5 py-3 transition-all hover:bg-slate-50 active:bg-slate-100/60"
          >
            <MovementContent tx={tx} showDate />
          </Link>
        </li>
      ))}
    </ul>
  )
}
