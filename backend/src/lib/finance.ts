/** Utilidades de cálculo financiero sin dependencias de Supabase. */

export const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Filtro PostgREST (.or) para listar cada transferencia una sola vez: de las
 * transferencias entre cuentas (pago a tarjeta) se muestra solo la pata de
 * salida; los movimientos de ahorro tienen una sola pata y siempre se ven.
 */
export const ONE_ROW_PER_TRANSFER = 'transfer_id.is.null,type.eq.expense,savings_goal_id.not.is.null'

/** Próxima fecha (hoy incluido) en que cae un día del mes; ajusta meses cortos. */
export function nextDayOfMonth(day: number, from = new Date()): string {
  const today = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()))
  for (let offset = 0; offset < 2; offset++) {
    const year = today.getUTCFullYear()
    const month = today.getUTCMonth() + offset
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const candidate = new Date(Date.UTC(year, month, Math.min(day, lastDay)))
    if (candidate >= today) return candidate.toISOString().slice(0, 10)
  }
  throw new Error('unreachable')
}

export interface PayoffSimulation {
  months: number | null
  total_paid: number
  total_interest: number
  schedule: { month: number; payment: number; interest: number; balance: number }[]
}

/**
 * Simula el pago de una deuda con cuota fija mensual e interés compuesto
 * mensual. `months` es null si la cuota no cubre los intereses.
 */
export function simulatePayoff(
  debt: number,
  monthlyRate: number,
  monthlyPayment: number,
  maxMonths = 360,
): PayoffSimulation {
  const schedule: PayoffSimulation['schedule'] = []
  let balance = debt
  let totalPaid = 0
  let totalInterest = 0

  if (debt > 0 && monthlyPayment <= debt * monthlyRate) {
    return { months: null, total_paid: 0, total_interest: 0, schedule }
  }

  for (let month = 1; balance > 0 && month <= maxMonths; month++) {
    const interest = round2(balance * monthlyRate)
    const payment = round2(Math.min(monthlyPayment, balance + interest))
    balance = round2(balance + interest - payment)
    totalPaid += payment
    totalInterest += interest
    schedule.push({ month, payment, interest, balance })
  }

  return {
    months: balance > 0 ? null : schedule.length,
    total_paid: round2(totalPaid),
    total_interest: round2(totalInterest),
    schedule,
  }
}

/** Primer día del mes `YYYY-MM` desplazado `offset` meses, como `YYYY-MM-DD`. */
export function monthStart(month: string, offset = 0): string {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year!, m! - 1 + offset, 1)).toISOString().slice(0, 10)
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
