import {
  ArrowLeftRight,
  Calendar,
  Plus,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { DebtMeter } from '../components/dashboard/DebtMeter'
import { ExpensesByCategoryChart } from '../components/dashboard/ExpensesByCategoryChart'
import { IncomeVsExpenseChart } from '../components/dashboard/IncomeVsExpenseChart'
import { RecentTransactions } from '../components/dashboard/RecentTransactions'
import { SavingsGoalsSummary } from '../components/dashboard/SavingsGoalsSummary'
import { StatCard } from '../components/dashboard/StatCard'
import { Spinner } from '../components/Spinner'
import { Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { currentMonth, formatCurrency, formatMonth, formatPercent } from '../lib/format'
import type { DashboardSummary } from '../types'

export function DashboardPage() {
  const { profile } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const { data, error, loading, reload } = useApi<DashboardSummary>(`/dashboard/summary?month=${month}`)

  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="space-y-7">
      {/* ========================================================= */}
      {/* CABECERA PRINCIPAL CON SALUDO Y SELECTOR DE MES           */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-hairline/60">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand mb-1">
            <Sparkles className="size-3.5" />
            <span>Panel Financiero Inteligente</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            {firstName ? `Hola, ${firstName} ` : 'Resumen Financiero'}
          </h1>
          <p className="mt-0.5 text-sm text-ink-secondary capitalize">
            {formatMonth(month)} · Análisis en tiempo real
          </p>
        </div>

        {/* Acciones y Selector de Mes */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <Calendar className="absolute left-3 size-4 text-ink-muted pointer-events-none" />
            <input
              type="month"
              value={month}
              max={currentMonth()}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="rounded-xl border border-hairline bg-surface pl-9 pr-3 py-2 text-sm font-semibold text-ink outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-xs"
              aria-label="Seleccionar mes"
            />
          </div>

          <Link to="/movimientos">
            <Button className="shadow-sm">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nuevo</span> Movimiento
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-status-critical/30 bg-status-critical/5 p-4 text-sm text-status-critical shadow-xs">
          <span>No se pudo cargar el resumen: {error}</span>
          <button type="button" onClick={reload} className="font-semibold text-brand hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Spinner de Carga Inicial */}
      {loading && !data && (
        <div className="grid h-64 place-items-center">
          <Spinner label="Cargando tu información financiera…" />
        </div>
      )}

      {/* Guía de bienvenida para nuevos usuarios */}
      {data && isEmpty(data) && (
        <section className="relative overflow-hidden rounded-3xl border border-brand/20 bg-gradient-to-br from-brand/5 via-surface to-brand/10 p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="grid size-10 place-items-center rounded-xl bg-brand text-white shadow-md shadow-brand/20">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">¡Comienza tu gestión financiera en 2 sencillos pasos!</h2>
              <p className="text-xs text-ink-secondary">Sigue esta guía rápida para desbloquear gráficos y métricas automáticas.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              to="/cuentas"
              className="group flex items-start gap-3 rounded-2xl border border-hairline bg-surface p-4 transition-all hover:border-brand/40 hover:shadow-sm"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand group-hover:scale-105 transition-transform">
                <Wallet className="size-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink group-hover:text-brand transition-colors">1. Agrega tus cuentas</p>
                <p className="mt-0.5 text-xs text-ink-muted">Crea cuentas de banco, efectivo o tarjetas de crédito con su saldo inicial.</p>
              </div>
            </Link>

            <Link
              to="/movimientos"
              className="group flex items-start gap-3 rounded-2xl border border-hairline bg-surface p-4 transition-all hover:border-brand/40 hover:shadow-sm"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-status-good group-hover:scale-105 transition-transform">
                <ArrowLeftRight className="size-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink group-hover:text-status-good transition-colors">2. Registra movimientos</p>
                <p className="mt-0.5 text-xs text-ink-muted">Anota tus primeros ingresos o gastos diarios para ver balances y tendencias.</p>
              </div>
            </Link>
          </div>
        </section>
      )}

      {data && (
        <div className={`space-y-7 transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`}>
          {/* ===================================================== */}
          {/* SECCIÓN 1: FLUJO DEL MES SELECCIONADO                 */}
          {/* ===================================================== */}
          <section aria-labelledby="kpi-month" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="kpi-month" className="text-xs font-bold tracking-wider text-ink-muted uppercase">
                Rendimiento de {formatMonth(month)}
              </h2>
              <span className="text-xs text-ink-muted font-medium">Flujo mensual</span>
            </div>
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              <StatCard label="Ingresos" value={formatCurrency(data.income)} />
              <StatCard
                label="Gastos"
                value={formatCurrency(data.expense)}
                hint={`Balance neto: ${formatCurrency(data.net)}`}
              />
              <StatCard
                label="Ahorrado"
                value={formatCurrency(data.saved_this_month)}
                hint={
                  data.savings_rate !== null
                    ? `${formatPercent(data.savings_rate)} de tus ingresos`
                    : 'Abonos menos retiros a metas'
                }
              />
              <DebtMeter ratio={data.debt_to_income} totalDebt={data.total_debt} />
            </div>
          </section>

          {/* ===================================================== */}
          {/* SECCIÓN 2: POSICIÓN FINANCIERA HOY                    */}
          {/* ===================================================== */}
          <section aria-labelledby="kpi-position" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="kpi-position" className="text-xs font-bold tracking-wider text-ink-muted uppercase">
                Tu Posición Patrimonial Hoy
              </h2>
              <span className="text-xs text-ink-muted font-medium">Consolidado general</span>
            </div>
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              <StatCard
                label="Saldo disponible"
                value={formatCurrency(data.available_balance)}
                hint="En bancos y efectivo"
              />
              <StatCard
                label="Ahorros totales"
                value={formatCurrency(data.total_saved)}
                hint={
                  data.total_savings_target > 0
                    ? `${formatPercent(Math.min(1, data.total_saved / data.total_savings_target))} de ${formatCurrency(data.total_savings_target)} en metas`
                    : 'Sin metas activas'
                }
              />
              <StatCard label="Deuda en tarjetas" value={formatCurrency(data.total_debt)} />
              <StatCard
                label="Patrimonio neto"
                value={formatCurrency(data.net_worth)}
                hint="Disponible + ahorros − deudas"
              />
            </div>
          </section>

          {/* ===================================================== */}
          {/* SECCIÓN 3: GRÁFICOS INTERACTIVOS                      */}
          {/* ===================================================== */}
          <section className="grid gap-5 lg:grid-cols-5">
            <Panel title="Ingresos, gastos y ahorro" subtitle="Tendencia semestral histórica" className="lg:col-span-3">
              <IncomeVsExpenseChart data={data.trend} />
            </Panel>
            <Panel title="Gastos por categoría" subtitle="Distribución en este mes" className="lg:col-span-2">
              <ExpensesByCategoryChart data={data.expenses_by_category} />
            </Panel>
          </section>

          {/* ===================================================== */}
          {/* SECCIÓN 4: MOVIMIENTOS RECIENTES Y METAS              */}
          {/* ===================================================== */}
          <section className="grid gap-5 lg:grid-cols-5">
            <Panel
              title="Últimos movimientos"
              subtitle="Transacciones más recientes registradas"
              action={
                <Link to="/movimientos" className="text-xs font-semibold text-brand hover:underline">
                  Ver todos
                </Link>
              }
              className="lg:col-span-3"
            >
              <RecentTransactions items={data.recent_transactions} />
            </Panel>
            <Panel
              title="Metas de ahorro"
              subtitle="Progreso hacia tus objetivos"
              action={
                <Link to="/ahorros" className="text-xs font-semibold text-brand hover:underline">
                  Gestionar metas
                </Link>
              }
              className="lg:col-span-2"
            >
              <SavingsGoalsSummary goals={data.savings_goals} />
            </Panel>
          </section>
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
    data.total_debt === 0 &&
    data.total_saved === 0
  )
}

interface PanelProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

function Panel({ title, subtitle, action, className = '', children }: PanelProps) {
  return (
    <section className={`rounded-2xl border border-hairline bg-surface p-5 sm:p-6 shadow-xs ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3 border-b border-hairline/60 pb-3">
        <div>
          <h2 className="font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </header>
      {children}
    </section>
  )
}
