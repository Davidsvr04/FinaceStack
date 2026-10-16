import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { DebtMeter } from '../components/dashboard/DebtMeter'
import { ExpensesByCategoryChart } from '../components/dashboard/ExpensesByCategoryChart'
import { IncomeVsExpenseChart } from '../components/dashboard/IncomeVsExpenseChart'
import { RecentTransactions } from '../components/dashboard/RecentTransactions'
import { StatCard } from '../components/dashboard/StatCard'
import { Spinner } from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { currentMonth, formatCurrency, formatMonth } from '../lib/format'
import type { DashboardSummary } from '../types'

export function DashboardPage() {
  const { profile } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const { data, error, loading, reload } = useApi<DashboardSummary>(`/dashboard/summary?month=${month}`)

  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {firstName ? `Hola, ${firstName}` : 'Resumen'}
          </h1>
          <p className="text-sm text-ink-secondary capitalize">{formatMonth(month)}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          Mes
          <input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-ink"
          />
        </label>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-status-critical/30 bg-status-critical/5 p-4 text-sm">
          <span>No se pudo cargar el resumen: {error}</span>
          <button type="button" onClick={reload} className="font-medium text-brand-strong">
            Reintentar
          </button>
        </div>
      )}

      {loading && !data && <Spinner />}

      {data && isEmpty(data) && (
        <section className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm md:p-5">
          <h2 className="font-semibold">Empieza en dos pasos</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-secondary">
            <li>
              <Link to="/cuentas" className="font-medium text-brand-strong hover:underline">
                Crea una cuenta
              </Link>{' '}
              (banco, efectivo o tarjeta de crédito).
            </li>
            <li>
              <Link to="/movimientos" className="font-medium text-brand-strong hover:underline">
                Registra tus ingresos y gastos
              </Link>{' '}
              y aquí verás tu resumen.
            </li>
          </ol>
        </section>
      )}

      {data && (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Ingresos del mes" value={formatCurrency(data.income)} />
            <StatCard
              label="Gastos del mes"
              value={formatCurrency(data.expense)}
              hint={`Balance del mes: ${formatCurrency(data.net)}`}
            />
            <StatCard
              label="Saldo disponible"
              value={formatCurrency(data.available_balance)}
              hint="Cuentas bancarias y efectivo"
            />
            <DebtMeter ratio={data.debt_to_income} totalDebt={data.total_debt} />
          </section>

          <section className="grid gap-4 lg:grid-cols-5">
            <Panel title="Ingresos vs gastos" subtitle="Últimos 6 meses" className="lg:col-span-3">
              <IncomeVsExpenseChart data={data.trend} />
            </Panel>
            <Panel title="Gastos por categoría" subtitle="Mes seleccionado" className="lg:col-span-2">
              <ExpensesByCategoryChart data={data.expenses_by_category} />
            </Panel>
          </section>

          <Panel title="Últimos movimientos">
            <RecentTransactions items={data.recent_transactions} />
          </Panel>
        </div>
      )}
    </div>
  )
}

/** Sin movimientos ni saldos: usuario nuevo. */
function isEmpty(data: DashboardSummary): boolean {
  return (
    data.recent_transactions.length === 0 &&
    data.available_balance === 0 &&
    data.total_debt === 0
  )
}

interface PanelProps {
  title: string
  subtitle?: string
  className?: string
  children: ReactNode
}

function Panel({ title, subtitle, className = '', children }: PanelProps) {
  return (
    <section className={`rounded-xl border border-hairline bg-surface p-4 md:p-5 ${className}`}>
      <header className="mb-3">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}
