import { Router } from 'express'
import { z } from 'zod'
import { currentMonth, monthStart, ONE_ROW_PER_TRANSFER, round2 } from '../lib/finance.js'
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
  savings_goal_id: string | null
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

  const [txResult, accountsResult, recentResult, goalsResult] = await Promise.all([
    // Ingresos/gastos reales + movimientos de ahorro (los pagos a tarjeta no
    // cuentan para nada de esto). Solo pesos: los dólares tienen su apartado.
    supabase
      .from('transactions')
      .select('type, amount, date, savings_goal_id, category:categories(name), account:accounts!inner(currency)')
      .eq('account.currency', 'COP')
      .gte('date', from)
      .lt('date', to)
      .or('transfer_id.is.null,savings_goal_id.not.is.null')
      .overrideTypes<TxRow[], { merge: false }>(),
    supabase.from('accounts').select('type, balance, credit_limit').eq('currency', 'COP'),
    // Últimos movimientos, incluidas transferencias y ahorros (una fila cada una).
    supabase
      .from('transactions')
      .select(
        'id, type, amount, date, description, transfer_id, exchange_rate, category:categories(name), account:accounts!inner(name, type, currency), savings_goal:savings_goals(name)',
      )
      .eq('account.currency', 'COP')
      .or(ONE_ROW_PER_TRANSFER)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('savings_goals')
      .select('id, name, target_amount, current_amount, deadline')
      .order('deadline', { ascending: true, nullsFirst: false }),
  ])

  if (txResult.error) throw dbError(txResult.error)
  if (accountsResult.error) throw dbError(accountsResult.error)
  if (recentResult.error) throw dbError(recentResult.error)
  if (goalsResult.error) throw dbError(goalsResult.error)

  // Incluye el ahorro previo (initial_amount), que no salió de ninguna cuenta.
  const totalSaved = goalsResult.data.reduce((sum, goal) => sum + Number(goal.current_amount), 0)
  const totalSavingsTarget = goalsResult.data.reduce((sum, goal) => sum + Number(goal.target_amount), 0)

  // Tendencia: un bucket por mes, incluidos los meses sin movimientos.
  const trend = Array.from({ length: TREND_MONTHS }, (_, i) => ({
    month: monthStart(month, i - (TREND_MONTHS - 1)).slice(0, 7),
    income: 0,
    expense: 0,
    saved: 0,
  }))
  const byMonth = new Map(trend.map((bucket) => [bucket.month, bucket]))

  const expensesByCategory = new Map<string, number>()
  let income = 0
  let expense = 0
  let savedThisMonth = 0

  for (const tx of txResult.data) {
    const amount = Number(tx.amount)
    const bucket = byMonth.get(tx.date.slice(0, 7))
    const inMonth = tx.date >= monthFrom

    // Ahorro neto: abono (sale de la cuenta) suma, retiro resta.
    if (tx.savings_goal_id) {
      const delta = tx.type === 'expense' ? amount : -amount
      if (bucket) bucket.saved += delta
      if (inMonth) savedThisMonth += delta
      continue
    }

    if (bucket) bucket[tx.type] += amount
    if (!inMonth) continue
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
    // Dinero en metas (abonos + ahorro previo); no está en available_balance.
    total_saved: round2(totalSaved),
    total_savings_target: round2(totalSavingsTarget),
    // Abonos menos retiros del mes, y qué parte de los ingresos representa.
    saved_this_month: round2(savedThisMonth),
    savings_rate: income > 0 ? round2(savedThisMonth / income) : null,
    total_debt: round2(totalDebt),
    // Patrimonio: lo que tienes (disponible + ahorros) menos lo que debes.
    net_worth: round2(availableBalance + totalSaved - totalDebt),
    // Nivel de endeudamiento: deuda total / ingresos del mes.
    // null cuando no hay ingresos en el mes (el ratio no es significativo).
    debt_to_income: income > 0 ? round2(totalDebt / income) : null,
    credit_utilization: totalCreditLimit > 0 ? round2(totalDebt / totalCreditLimit) : null,
    expenses_by_category: [...expensesByCategory]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    trend: trend.map((b) => ({
      ...b,
      income: round2(b.income),
      expense: round2(b.expense),
      saved: round2(b.saved),
    })),
    savings_goals: goalsResult.data.map((goal) => ({
      id: goal.id,
      name: goal.name,
      target_amount: Number(goal.target_amount),
      current_amount: Number(goal.current_amount),
      deadline: goal.deadline,
      progress: Math.min(1, Number(goal.current_amount) / Number(goal.target_amount)),
    })),
    recent_transactions: recentResult.data,
  })
})

export default router
