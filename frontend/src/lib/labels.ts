import { CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react'
import type { AccountType, TransactionType } from '../types'

export const ACCOUNT_TYPES: Record<AccountType, { label: string; icon: LucideIcon }> = {
  bank: { label: 'Banco', icon: Landmark },
  cash: { label: 'Efectivo', icon: Wallet },
  credit_card: { label: 'Tarjeta de crédito', icon: CreditCard },
}

/** Opciones habituales de cuotas en tarjetas de crédito. */
export const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 6, 9, 12, 18, 24, 36, 48]

export const TRANSACTION_TYPES: Record<TransactionType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
}
