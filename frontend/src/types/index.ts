export type Role = 'user' | 'admin'
export type TransactionType = 'income' | 'expense'
export type AccountType = 'bank' | 'cash' | 'credit_card'
/** COP = pesos (lo de siempre); USD = dólares, en un apartado aparte. */
export type Currency = 'COP' | 'USD'

export interface Profile {
  id: string
  role: Role
  full_name: string | null
  /** Activó el apartado de dólares. */
  uses_usd: boolean
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  /** Se fija al crear la cuenta. Las tarjetas siempre son COP. */
  currency: Currency
  /** Con signo: en tarjetas, negativo = deuda. */
  balance: number
  credit_limit: number | null
  cut_off_day: number | null
  payment_due_day: number | null
  /** Fracción mensual: 0.0215 = 2.15 %. */
  monthly_interest_rate: number | null
  /** Tarjetas, plan de la deuda inicial: ya facturado al registrarla. */
  opening_billed_debt: number
  /** Del resto, cuánto se cobra en el próximo extracto (null = todo). */
  opening_next_charge: number | null
  /** En cuántos meses se cobra lo que queda. */
  opening_later_installments: number
  /** Cuota de manejo mensual (null = sin cuota); se genera como gasto automático. */
  handling_fee_amount: number | null
  /** Día del mes en que se cobra la cuota de manejo. */
  handling_fee_day: number | null
  /** Primera fecha de cobro registrada. */
  handling_fee_start: string | null
  created_at: string
}

export interface UpcomingStatement {
  cut_off_date: string
  payment_date: string | null
  amount: number
}

export interface CreditCard extends Account {
  debt: number
  available_credit: number | null
  utilization: number | null
  /** Deuda que había al registrar la tarjeta. */
  opening_debt: number
  /** Facturado en cortes cerrados y sin pagar. */
  billed: number
  /** Cuotas que se facturarán en cortes futuros. */
  unbilled: number
  last_cut_off_date: string | null
  next_cut_off_date: string | null
  /**
   * Pago mínimo. due: facturado con fecha límite futura; overdue: ya venció;
   * estimated: lo que se facturará en el próximo corte.
   */
  next_payment: { date: string; amount: number; status: 'due' | 'overdue' | 'estimated' } | null
  /** Cobros por corte a partir del próximo. */
  upcoming_statements: UpcomingStatement[]
}

export interface Category {
  id: string
  /** null = categoría global, no editable. */
  user_id: string | null
  name: string
  type: TransactionType
}

export interface Transaction {
  id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  date: string
  description: string | null
  /** No nulo = transferencia (pago a tarjeta o ahorro): no es ingreso ni gasto. */
  transfer_id: string | null
  savings_goal_id: string | null
  /** Compras con tarjeta: número de cuotas (1 = de contado). */
  installments: number
  /** Cambio de divisas: pesos por dólar (en ambas patas). null en el resto. */
  exchange_rate: number | null
  account: { id: string; name: string; type: AccountType; currency: Currency } | null
  category: { id: string; name: string; type: TransactionType } | null
  savings_goal: { id: string; name: string } | null
  /** La otra cuenta en una transferencia entre cuentas. */
  counterpart_account: { id: string; name: string; type: AccountType; currency: Currency } | null
  /** Monto de la otra pata (en un cambio de divisas, en la otra moneda). */
  counterpart_amount: number | null
}

/** Plantilla de un movimiento frecuente (transporte, mercado...). */
export interface MovementTemplate {
  id: string
  name: string
  type: TransactionType
  /** null = el monto varía y se escribe al usarla. */
  amount: number | null
  account_id: string | null
  category_id: string | null
  description: string | null
  installments: number
  account: { id: string; name: string; type: AccountType; currency: Currency } | null
  category: { id: string; name: string; type: TransactionType } | null
}

/** Filtro de movimientos: reales (ingreso/gasto) o transferencias. */
export type TransactionKind = TransactionType | 'transfer'

export interface Paginated<T> {
  data: T[]
  total: number
}

export interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  /** Incluye initial_amount + abonos - retiros. */
  current_amount: number
  /** Ahorro previo a la app: no salió de ninguna cuenta. */
  initial_amount: number
  deadline: string | null
  progress: number
  created_at: string
}

export interface PayoffSimulation {
  debt: number
  monthly_interest_rate: number
  monthly_payment: number
  months: number | null
  total_paid: number
  total_interest: number
  schedule: { month: number; payment: number; interest: number; balance: number }[]
}

export interface RecentTransaction {
  id: string
  type: TransactionType
  amount: number
  date: string
  description: string | null
  transfer_id: string | null
  exchange_rate: number | null
  category: { name: string } | null
  account: { name: string; currency: Currency } | null
  savings_goal: { name: string } | null
}

export interface DashboardSummary {
  month: string
  income: number
  expense: number
  net: number
  available_balance: number
  /** En metas de ahorro (abonos + ahorro previo); no está en available_balance. */
  total_saved: number
  total_savings_target: number
  /** Abonos menos retiros del mes. */
  saved_this_month: number
  /** saved_this_month / income; null sin ingresos. */
  savings_rate: number | null
  total_debt: number
  /** available_balance + total_saved - total_debt. */
  net_worth: number
  debt_to_income: number | null
  credit_utilization: number | null
  expenses_by_category: { category: string; amount: number }[]
  trend: TrendPoint[]
  savings_goals: GoalSummary[]
  recent_transactions: RecentTransaction[]
}

/** Resumen del apartado de dólares (montos en USD salvo la tasa). */
export interface UsdSummary {
  month: string
  balance: number
  accounts: number
  income: number
  expense: number
  net: number
  /** Dólares comprados / vendidos en el mes. */
  bought: number
  sold: number
  /** Pesos pagados por dólar en promedio, de todas las compras; null si no hay. */
  average_purchase_rate: number | null
}

export interface TrendPoint {
  month: string
  income: number
  expense: number
  /** Ahorro neto del mes (puede ser negativo si hubo más retiros). */
  saved: number
}

export interface GoalSummary {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
  progress: number
}

export interface AdminTrendPoint {
  month: string
  /** Volumen en pesos (sin transferencias). */
  income: number
  expense: number
  /** Movimientos registrados (una transferencia cuenta una vez). */
  movements: number
  new_users: number
}

export interface AdminMetrics {
  total_users: number
  total_admins: number
  new_users_30d: number
  /** Iniciaron sesión en los últimos 30 días. */
  active_users_30d: number
  total_accounts: number
  /** bank/cash/credit_card en pesos; usd = cuentas en dólares. */
  accounts_by_type: { bank: number; cash: number; credit_card: number; usd: number }
  total_transactions: number
  movements_this_month: number
  month: string
  platform_income: number
  platform_expense: number
  trend: AdminTrendPoint[]
  /** Usuarios que usan cada función. */
  adoption: {
    with_accounts: number
    with_cards: number
    with_goals: number
    with_templates: number
    with_usd: number
  }
}

export interface AdminUser {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  uses_usd: boolean
  accounts_count: number
  movements_count: number
  last_sign_in_at: string | null
  created_at: string
}

export interface AdminUsersPage {
  page: number
  per_page: number
  total: number | null
  has_more: boolean
  users: AdminUser[]
}
