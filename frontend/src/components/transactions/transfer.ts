import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  PiggyBank,
  type LucideIcon,
} from 'lucide-react'
import { formatCurrency } from '../../lib/format'
import type { Currency } from '../../types'

interface MovementLike {
  type: 'income' | 'expense'
  transfer_id: string | null
  description: string | null
  account: { name: string; type?: string; currency?: Currency } | null
  category: { name: string } | null
  savings_goal: { name: string } | null
  counterpart_account?: { name: string } | null
  installments?: number
  /** Cambio de divisas: pesos por dólar. */
  exchange_rate?: number | null
}

export interface MovementDisplay {
  icon: LucideIcon
  title: string
  /** Origen → destino para transferencias; cuenta · categoría para el resto. */
  detail: string
  /** "Ahorro" / "Transferencia" / "Cambio de divisas"; null para ingresos y gastos normales. */
  tag: string | null
}

/**
 * Pago de tarjeta hecho con dinero de una meta de ahorro: se guarda como un
 * ingreso en la tarjeta (baja la deuda) enlazado a la meta, pero para quien lo
 * ve es dinero que sale del ahorro.
 */
export function isGoalPayment(tx: Pick<MovementLike, 'savings_goal' | 'account'>): boolean {
  return Boolean(tx.savings_goal) && tx.account?.type === 'credit_card'
}

/** Cómo mostrar un movimiento: ingreso, gasto, pago a tarjeta o ahorro. */
export function describeMovement(tx: MovementLike): MovementDisplay {
  const account = tx.account?.name ?? '—'
  const isOut = tx.type === 'expense'

  if (tx.savings_goal && isGoalPayment(tx)) {
    return {
      icon: CreditCard,
      title: tx.description ?? 'Pago de tarjeta con ahorro',
      detail: `Meta ${tx.savings_goal.name} → ${account}`,
      tag: 'Pago con ahorro',
    }
  }

  if (tx.savings_goal) {
    const goal = `Meta ${tx.savings_goal.name}`
    return {
      icon: PiggyBank,
      title: tx.description ?? (isOut ? 'Abono a ahorro' : 'Retiro de ahorro'),
      detail: isOut ? `${account} → ${goal}` : `${goal} → ${account}`,
      tag: 'Ahorro',
    }
  }

  // Compra o venta de dólares: una pata en pesos y otra en dólares.
  if (tx.exchange_rate) {
    const other = tx.counterpart_account?.name
    const route = other ? (isOut ? `${account} → ${other}` : `${other} → ${account}`) : account
    return {
      icon: Banknote,
      title: tx.description ?? 'Cambio de divisas',
      detail: `${route} · ${formatCurrency(Number(tx.exchange_rate))} por dólar`,
      tag: 'Cambio de divisas',
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

  const installments = tx.installments && tx.installments > 1 ? ` · ${tx.installments} cuotas` : ''
  return {
    icon: isOut ? ArrowUpRight : ArrowDownLeft,
    title: tx.description || tx.category?.name || (isOut ? 'Gasto' : 'Ingreso'),
    detail: (tx.category ? `${account} · ${tx.category.name}` : account) + installments,
    tag: null,
  }
}
