export type Role = 'user' | 'admin'
export type TransactionType = 'income' | 'expense'
export type AccountType = 'bank' | 'cash' | 'credit_card'

export interface Profile {
  id: string
  role: Role
  full_name: string | null
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  /** Con signo: en tarjetas, negativo = deuda. */
  balance: number
  credit_limit: number | null
  cut_off_day: number | null
  payment_due_day: number | null
  /** Fracción mensual: 0.0215 = 2.15 %. */
  monthly_interest_rate: number | null
  created_at: string
}

export interface CreditCard extends Account {
  debt: number
  available_credit: number | null
  utilization: number | null
  next_cut_off_date: string | null
  next_payment_date: string | null
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
  account: { id: string; name: string; type: AccountType } | null
  category: { id: string; name: string; type: TransactionType } | null
  savings_goal: { id: string; name: string } | null
  /** La otra cuenta en una transferencia entre cuentas. */
  counterpart_account: { id: string; name: string; type: AccountType } | null
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
  category: { name: string } | null
  account: { name: string } | null
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

export interface AdminMetrics {
  total_users: number
  total_admins: number
  new_users_30d: number
  total_accounts: number
  total_transactions: number
  month: string
  platform_income: number
  platform_expense: number
}

export interface AdminUser {
  id: string
  email: string | null
  full_name: string | null
  role: Role
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
