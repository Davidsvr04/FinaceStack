/** Utilidades de cálculo financiero sin dependencias de Supabase. */

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Zona horaria de la app (la misma que usa el job de cuotas de manejo). */
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE ?? 'America/Bogota'

/** Fecha de hoy 'YYYY-MM-DD' en la zona de la app (el servidor corre en UTC). */
export function localToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(new Date())
}

/**
 * Filtro PostgREST (.or) para listar cada transferencia una sola vez: de las
 * transferencias entre cuentas (pago a tarjeta) se muestra solo la pata de
 * salida; los movimientos de ahorro tienen una sola pata y siempre se ven.
 */
export const ONE_ROW_PER_TRANSFER = 'transfer_id.is.null,type.eq.expense,savings_goal_id.not.is.null'

// ---------------------------------------------------------------------------
// Fechas como 'YYYY-MM-DD' (sin hora) para evitar desfases de zona horaria.
// ---------------------------------------------------------------------------

/** Fecha con ese día en el mes dado (month puede desbordar); ajusta meses cortos (31 -> 30/28). */
function dayInMonth(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

function parts(isoDate: string): [number, number] {
  const [year, month] = isoDate.split('-').map(Number)
  return [year!, month! - 1]
}

/** Primera fecha con ese día del mes estrictamente posterior a `after`. */
export function firstDayAfter(day: number, after: string): string {
  const [year, month] = parts(after)
  const candidate = dayInMonth(year, month, day)
  return candidate > after ? candidate : dayInMonth(year, month + 1, day)
}

/** Primera fecha con ese día del mes igual o posterior a `from`. */
export function firstDayOnOrAfter(day: number, from: string): string {
  const [year, month] = parts(from)
  const candidate = dayInMonth(year, month, day)
  return candidate >= from ? candidate : dayInMonth(year, month + 1, day)
}

/**
 * Último corte ya cerrado (estrictamente antes de hoy) y próximo corte (hoy
 * incluido: el extracto cierra al final del día de corte).
 */
export function cutOffDates(cutOffDay: number, today: string): { last: string; next: string } {
  const [year, month] = parts(today)
  const thisMonth = dayInMonth(year, month, cutOffDay)
  return thisMonth < today
    ? { last: thisMonth, next: dayInMonth(year, month + 1, cutOffDay) }
    : { last: dayInMonth(year, month - 1, cutOffDay), next: thisMonth }
}

/** Reparte un monto en n cuotas iguales; la última absorbe el redondeo. */
export function splitInstallments(amount: number, n: number): number[] {
  const count = Math.max(1, Math.floor(n))
  const base = Math.floor((amount / count) * 100) / 100
  return Array.from({ length: count }, (_, i) => (i < count - 1 ? base : round2(amount - base * (count - 1))))
}

export interface CardStatementInput {
  /** Deuda actual (positiva = se debe). */
  debt: number
  cutOffDay: number | null
  paymentDueDay: number | null
  /** Fecha de registro de la tarjeta. */
  createdOn: string
  /** Plan de la deuda que ya existía al registrar la tarjeta. */
  opening: {
    /** Ya facturado (extracto cerrado sin pagar). */
    billed: number
    /** Del resto, cuánto se cobra en el próximo extracto; null = todo. */
    nextCharge: number | null
    /** En cuántos meses se cobra lo que queda después del próximo extracto. */
    laterInstallments: number
  }
  /**
   * Movimientos de la tarjeta: delta > 0 = compra (con sus cuotas),
   * delta < 0 = pago o devolución.
   */
  movements: { date: string; delta: number; installments?: number }[]
  today: string
}

export interface UpcomingStatement {
  cut_off_date: string
  /** Fecha límite para pagar lo facturado en ese corte (null sin día de pago). */
  payment_date: string | null
  amount: number
}

export interface CardStatement {
  /** Deuda que existía al registrar la tarjeta (reconstruida desde los movimientos). */
  opening_debt: number
  /** Facturado en cortes ya cerrados y aún sin pagar (incluye vencido). */
  billed: number
  /** Cuotas y compras que se facturarán en cortes futuros. */
  unbilled: number
  last_cut_off_date: string | null
  next_cut_off_date: string | null
  /**
   * Pago mínimo: lo facturado pendiente o, si no hay, lo que se facturará en el
   * próximo corte con cobro.
   * due: facturado con fecha límite futura; overdue: ya venció;
   * estimated: aún no facturado.
   */
  next_payment: { date: string; amount: number; status: 'due' | 'overdue' | 'estimated' } | null
  /** Cobros por corte a partir del próximo (máximo 12), ya descontados los pagos adelantados. */
  upcoming_statements: UpcomingStatement[]
}

const MAX_UPCOMING = 12

/**
 * Estado de cuenta de una tarjeta por ciclo de facturación con cuotas:
 * cada compra se reparte en sus cuotas, una por corte a partir del primer
 * corte igual o posterior a la fecha de compra; lo facturado en un corte se
 * paga en la fecha límite siguiente. Los pagos se aplican primero a lo
 * facturado más antiguo y el excedente adelanta cuotas futuras.
 */
export function cardStatement(input: CardStatementInput): CardStatement {
  const { debt, cutOffDay, paymentDueDay, today } = input
  const owed = Math.max(0, debt)
  const opening = round2(debt - input.movements.reduce((sum, m) => sum + m.delta, 0))

  if (!cutOffDay) {
    // Sin día de corte no hay ciclos: solo se puede ubicar el próximo día de pago.
    return {
      opening_debt: opening,
      billed: 0,
      unbilled: round2(owed),
      last_cut_off_date: null,
      next_cut_off_date: null,
      next_payment:
        paymentDueDay && owed > 0
          ? { date: firstDayOnOrAfter(paymentDueDay, today), amount: round2(owed), status: 'estimated' }
          : null,
      upcoming_statements: [],
    }
  }

  // Corte que incluye una fecha (el día de corte entra en ese corte) y desplazamiento por meses.
  const cutFor = (date: string) => firstDayOnOrAfter(cutOffDay, date)
  const shiftCut = (cut: string, months: number) => {
    const [year, month] = parts(cut)
    return dayInMonth(year, month + months, cutOffDay)
  }

  const charges = new Map<string, number>()
  const charge = (cut: string, amount: number) => {
    if (amount > 0) charges.set(cut, (charges.get(cut) ?? 0) + amount)
  }
  let credits = 0

  // Deuda inicial según el plan indicado por el usuario.
  if (opening > 0) {
    const firstCut = cutFor(input.createdOn)
    const billedPart = Math.min(Math.max(0, input.opening.billed), opening)
    charge(shiftCut(firstCut, -1), billedPart)
    const unbilledPart = opening - billedPart
    const nextPart =
      input.opening.nextCharge === null ? unbilledPart : Math.min(Math.max(0, input.opening.nextCharge), unbilledPart)
    charge(firstCut, nextPart)
    splitInstallments(round2(unbilledPart - nextPart), input.opening.laterInstallments).forEach((amount, i) =>
      charge(shiftCut(firstCut, i + 1), amount),
    )
  } else {
    credits += -opening // saldo a favor inicial
  }

  for (const movement of input.movements) {
    if (movement.delta > 0) {
      const firstCut = cutFor(movement.date)
      splitInstallments(movement.delta, movement.installments ?? 1).forEach((amount, i) =>
        charge(shiftCut(firstCut, i), amount),
      )
    } else {
      credits += -movement.delta
    }
  }

  const { last, next } = cutOffDates(cutOffDay, today)
  const cuts = [...charges.keys()].sort()

  const billedToDate = cuts.filter((cut) => cut <= last).reduce((sum, cut) => sum + charges.get(cut)!, 0)
  const pending = Math.max(0, billedToDate - credits)
  let advance = Math.max(0, credits - billedToDate) // pagos que adelantan cuotas futuras

  const upcoming: UpcomingStatement[] = []
  for (const cut of cuts.filter((c) => c > last)) {
    let amount = charges.get(cut)!
    const used = Math.min(advance, amount)
    amount -= used
    advance -= used
    if (amount > 0.004 && upcoming.length < MAX_UPCOMING) {
      upcoming.push({
        cut_off_date: cut,
        payment_date: paymentDueDay ? firstDayAfter(paymentDueDay, cut) : null,
        amount: round2(amount),
      })
    }
  }

  const billed = Math.min(owed, pending)

  let nextPayment: CardStatement['next_payment'] = null
  if (paymentDueDay && billed > 0.004) {
    const date = firstDayAfter(paymentDueDay, last)
    nextPayment = { date, amount: round2(billed), status: date >= today ? 'due' : 'overdue' }
  } else if (upcoming[0]?.payment_date) {
    nextPayment = { date: upcoming[0].payment_date, amount: upcoming[0].amount, status: 'estimated' }
  }

  return {
    opening_debt: opening,
    billed: round2(billed),
    unbilled: round2(Math.max(0, owed - billed)),
    last_cut_off_date: last,
    next_cut_off_date: next,
    next_payment: nextPayment,
    upcoming_statements: upcoming,
  }
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
