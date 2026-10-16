import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, PiggyBank, type LucideIcon } from 'lucide-react'

interface MovementLike {
  type: 'income' | 'expense'
  transfer_id: string | null
  description: string | null
  account: { name: string } | null
  category: { name: string } | null
  savings_goal: { name: string } | null
  counterpart_account?: { name: string } | null
}

export interface MovementDisplay {
  icon: LucideIcon
  title: string
  /** Origen → destino para transferencias; cuenta · categoría para el resto. */
  detail: string
  /** "Ahorro" / "Transferencia"; null para ingresos y gastos normales. */
  tag: string | null
}

/** Cómo mostrar un movimiento: ingreso, gasto, pago a tarjeta o ahorro. */
export function describeMovement(tx: MovementLike): MovementDisplay {
  const account = tx.account?.name ?? '—'
  const isOut = tx.type === 'expense'

  if (tx.savings_goal) {
    const goal = `Meta ${tx.savings_goal.name}`
    return {
      icon: PiggyBank,
      title: tx.description ?? (isOut ? 'Abono a ahorro' : 'Retiro de ahorro'),
      detail: isOut ? `${account} → ${goal}` : `${goal} → ${account}`,
      tag: 'Ahorro',
    }
  }

  if (tx.transfer_id) {
    const other = tx.counterpart_account?.name
    return {
      icon: ArrowLeftRight,
      title: tx.description ?? 'Transferencia',
      detail: other ? (isOut ? `${account} → ${other}` : `${other} → ${account}`) : account,
      tag: 'Transferencia',
    }
  }

  return {
    icon: isOut ? ArrowUpRight : ArrowDownLeft,
    title: tx.description || tx.category?.name || (isOut ? 'Gasto' : 'Ingreso'),
    detail: tx.category ? `${account} · ${tx.category.name}` : account,
    tag: null,
  }
}
