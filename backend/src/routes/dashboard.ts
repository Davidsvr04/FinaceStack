import { Router } from 'express'
import { z } from 'zod'
import { currentMonth, monthStart, round2 } from '../lib/finance.js'
import { dbError, getCtx, parse } from '../lib/http.js'

const router = Router()

const TREND_MONTHS = 6

const summarySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato esperado: YYYY-MM')
    .default(currentMonth),
})

interface TxRow {
  type: 'income' | 'expense'
  amount: number
  date: string
  category: { name: string } | null
}

/**
 * Resumen financiero del mes: totales, saldo disponible, endeudamiento,
 * gastos por categoría y tendencia de ingresos vs gastos de los últimos meses.
 */
router.get('/summary', async (req, res) => {
  const { supabase } = getCtx(req)
  const { month } = parse(summarySchema, req.query)

  const from = monthStart(month, -(TREND_MONTHS - 1))
  const monthFrom = monthStart(month)
  const to = monthStart(month, 1)

  const [txResult, accountsResult, recentResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('type, amount, date, category:categories(name)')
      .gte('date', from)
      .lt('date', to)
      .is('transfer_id', null)
      .overrideTypes<TxRow[], { merge: false }>(),
    supabase.from('accounts').select('type, balance, credit_limit'),
    supabase
      .from('transactions')
      .select('id, type, amount, date, description, category:categories(name), account:accounts(name)')
      .is('transfer_id', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (txResult.error) throw dbError(txResult.error)
  if (accountsResult.error) throw dbError(accountsResult.error)
  if (recentResult.error) throw dbError(recentResult.error)

  // Tendencia: un bucket por mes, incluidos los meses sin movimientos.
  const trend = Array.from({ length: TREND_MONTHS }, (_, i) => ({
    month: monthStart(month, i - (TREND_MONTHS - 1)).slice(0, 7),
    income: 0,
    expense: 0,
  }))
  const byMonth = new Map(trend.map((bucket) => [bucket.month, bucket]))

  const expensesByCategory = new Map<string, number>()
  let income = 0
  let expense = 0

  for (const tx of txResult.data) {
    const amount = Number(tx.amount)
    const bucket = byMonth.get(tx.date.slice(0, 7))
    if (bucket) bucket[tx.type] += amount

    if (tx.date < monthFrom) continue
    if (tx.type === 'income') {
      income += amount
    } else {
      expense += amount
      const name = tx.category?.name ?? 'Sin categoría'
      expensesByCategory.set(name, (expensesByCategory.get(name) ?? 0) + amount)
    }
  }

  let availableBalance = 0
  let totalDebt = 0
  let totalCreditLimit = 0
  for (const account of accountsResult.data) {
    const balance = Number(account.balance)
    if (account.type === 'credit_card') {
      totalDebt += Math.max(0, -balance)
      totalCreditLimit += Number(account.credit_limit ?? 0)
    } else {
      availableBalance += balance
    }
  }

  res.json({
    month,
    income: round2(income),
    expense: round2(expense),
    net: round2(income - expense),
    available_balance: round2(availableBalance),
    total_debt: round2(totalDebt),
    // Nivel de endeudamiento: deuda total / ingresos del mes.
    // null cuando no hay ingresos en el mes (el ratio no es significativo).
    debt_to_income: income > 0 ? round2(totalDebt / income) : null,
    credit_utilization: totalCreditLimit > 0 ? round2(totalDebt / totalCreditLimit) : null,
    expenses_by_category: [...expensesByCategory]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    trend: trend.map((b) => ({ ...b, income: round2(b.income), expense: round2(b.expense) })),
    recent_transactions: recentResult.data,
  })
})

export default router
