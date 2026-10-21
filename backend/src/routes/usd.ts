import { Router } from 'express'
import { z } from 'zod'
import { currentMonth, monthStart, round2 } from '../lib/finance.js'
import { dbError, getCtx, parse } from '../lib/http.js'

// Apartado de dólares: resumen de las cuentas en USD, separado del dashboard
// en pesos. Los movimientos se listan con /transactions?currency=USD.
const router = Router()

const summarySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato esperado: YYYY-MM')
    .default(currentMonth),
})

interface UsdTxRow {
  type: 'income' | 'expense'
  amount: number
  transfer_id: string | null
  exchange_rate: number | null
}

router.get('/summary', async (req, res) => {
  const { supabase } = getCtx(req)
  const { month } = parse(summarySchema, req.query)

  const [accountsResult, monthResult, purchasesResult] = await Promise.all([
    supabase.from('accounts').select('balance').eq('currency', 'USD'),
    supabase
      .from('transactions')
      .select('type, amount, transfer_id, exchange_rate, account:accounts!inner(currency)')
      .eq('account.currency', 'USD')
      .gte('date', monthStart(month))
      .lt('date', monthStart(month, 1))
      .overrideTypes<UsdTxRow[], { merge: false }>(),
    // Todas las compras de dólares, para el precio promedio de compra.
    // Para volúmenes grandes conviene mover esta suma a una función SQL.
    supabase
      .from('transactions')
      .select('amount, exchange_rate, account:accounts!inner(currency)')
      .eq('account.currency', 'USD')
      .eq('type', 'income')
      .not('exchange_rate', 'is', null),
  ])

  if (accountsResult.error) throw dbError(accountsResult.error)
  if (monthResult.error) throw dbError(monthResult.error)
  if (purchasesResult.error) throw dbError(purchasesResult.error)

  let income = 0
  let expense = 0
  let bought = 0
  let sold = 0
  for (const tx of monthResult.data) {
    const amount = Number(tx.amount)
    if (tx.exchange_rate !== null) {
      // En la cuenta en dólares, la compra entra (income) y la venta sale (expense).
      if (tx.type === 'income') bought += amount
      else sold += amount
    } else if (!tx.transfer_id) {
      if (tx.type === 'income') income += amount
      else expense += amount
    }
  }

  let purchasedUsd = 0
  let purchasedCop = 0
  for (const tx of purchasesResult.data) {
    purchasedUsd += Number(tx.amount)
    purchasedCop += Number(tx.amount) * Number(tx.exchange_rate)
  }

  res.json({
    month,
    balance: round2(accountsResult.data.reduce((sum, a) => sum + Number(a.balance), 0)),
    accounts: accountsResult.data.length,
    income: round2(income),
    expense: round2(expense),
    net: round2(income - expense),
    bought: round2(bought),
    sold: round2(sold),
    // Pesos pagados por dólar en promedio (ponderado); null si nunca compró.
    average_purchase_rate: purchasedUsd > 0 ? round2(purchasedCop / purchasedUsd) : null,
  })
})

export default router
