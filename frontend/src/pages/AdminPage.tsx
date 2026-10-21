import { Activity, ChevronLeft, ChevronRight, Landmark, RefreshCw, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { IncomeVsExpenseChart } from '../components/dashboard/IncomeVsExpenseChart'
import { MonthlyBarChart } from '../components/dashboard/MonthlyBarChart'
import { StatCard } from '../components/dashboard/StatCard'
import { Spinner } from '../components/Spinner'
import { Button, ErrorBanner, IconButton, PageHeader, Panel, ProgressBar } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { useSubmit } from '../hooks/useSubmit'
import { send } from '../lib/api'
import { formatDateTime, formatMonth, formatPercent, formatRelative } from '../lib/format'
import type { AdminMetrics, AdminUser, AdminUsersPage, Role } from '../types'

const PER_PAGE = 20
const ACTIVE_DAYS = 30

const count = (value: number) => new Intl.NumberFormat('es-CO').format(value)
const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`

export function AdminPage() {
  const metrics = useApi<AdminMetrics>('/admin/metrics')
  const data = metrics.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración"
        subtitle="Métricas de la plataforma y gestión de usuarios. Solo datos agregados: nunca movimientos individuales."
        actions={
          <Button variant="secondary" onClick={metrics.reload} disabled={metrics.loading}>
            <RefreshCw className={`size-4 ${metrics.loading ? 'animate-spin' : ''}`} aria-hidden />
            Actualizar
          </Button>
        }
      />

      {metrics.loading && !data && (
        <div className="grid h-48 place-items-center">
          <Spinner label="Cargando métricas de administración…" />
        </div>
      )}
      {metrics.error && <ErrorBanner message={metrics.error} onRetry={metrics.reload} />}

      {data && (
        // Al recargar se mantiene lo anterior atenuado, sin saltos.
        <div className={`space-y-6 transition-opacity duration-200 ${metrics.loading ? 'opacity-60' : ''}`}>
          <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <StatCard
              label="Usuarios"
              value={count(data.total_users)}
              hint={`+${count(data.new_users_30d)} en 30 días · ${plural(data.total_admins, 'admin', 'admins')}`}
            />
            <StatCard
              label={`Activos (${ACTIVE_DAYS} días)`}
              icon={Activity}
              value={count(data.active_users_30d)}
              hint={
                data.total_users > 0
                  ? `${formatPercent(data.active_users_30d / data.total_users)} de los usuarios inició sesión`
                  : 'Sin usuarios'
              }
            />
            <StatCard
              label="Cuentas"
              icon={Landmark}
              value={count(data.total_accounts)}
              hint={[
                plural(data.accounts_by_type.bank, 'banco', 'bancos'),
                `${count(data.accounts_by_type.cash)} efectivo`,
                plural(data.accounts_by_type.credit_card, 'tarjeta', 'tarjetas'),
                ...(data.accounts_by_type.usd > 0 ? [`${count(data.accounts_by_type.usd)} en USD`] : []),
              ].join(' · ')}
            />
            <StatCard
              label="Movimientos del mes"
              value={count(data.movements_this_month)}
              hint={`${count(data.total_transactions)} registros históricos`}
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <Panel title="Nuevos usuarios" subtitle="Registros por mes · últimos 6 meses">
              <MonthlyBarChart
                data={data.trend.map((t) => ({ month: t.month, value: t.new_users }))}
                label="Nuevos usuarios"
              />
            </Panel>
            <Panel title="Movimientos registrados" subtitle="Ingresos, gastos y transferencias de todos los usuarios">
              <MonthlyBarChart
                data={data.trend.map((t) => ({ month: t.month, value: t.movements }))}
                label="Movimientos"
              />
            </Panel>
          </section>

          <section className="grid gap-5 lg:grid-cols-5">
            <Panel
              title="Volumen en la plataforma"
              subtitle={`Ingresos y gastos en pesos de todos los usuarios · foco en ${formatMonth(data.month)}`}
              className="lg:col-span-3"
            >
              <IncomeVsExpenseChart data={data.trend} highlightMonth={data.month} />
            </Panel>
            <Panel
              title="Adopción de funciones"
              subtitle="Qué parte de los usuarios usa cada función"
              className="lg:col-span-2"
            >
              <AdoptionList metrics={data} />
            </Panel>
          </section>
        </div>
      )}

      <UsersTable onChanged={metrics.reload} />
    </div>
  )
}

function AdoptionList({ metrics }: { metrics: AdminMetrics }) {
  const { adoption, total_users: total } = metrics
  const items = [
    { label: 'Crearon al menos una cuenta', value: adoption.with_accounts },
    { label: 'Usan tarjetas de crédito', value: adoption.with_cards },
    { label: 'Tienen metas de ahorro', value: adoption.with_goals },
    { label: 'Usan plantillas', value: adoption.with_templates },
    { label: 'Activaron dólares', value: adoption.with_usd },
  ]

  if (total === 0) return <p className="text-sm text-ink-muted">Aún no hay usuarios registrados.</p>

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const share = item.value / total
        return (
          <li key={item.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-secondary">{item.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-bold text-ink">{formatPercent(share)}</span>
                <span className="text-xs text-ink-muted">
                  {' '}
                  · {count(item.value)} de {count(total)}
                </span>
              </span>
            </div>
            <ProgressBar value={share} label={`${item.label}: ${formatPercent(share)}`} />
          </li>
        )
      })}
    </ul>
  )
}

function UsersTable({ onChanged }: { onChanged: () => void }) {
  const { user: me } = useAuth()
  const [page, setPage] = useState(1)
  const { data, error, loading, reload } = useApi<AdminUsersPage>(`/admin/users?page=${page}&per_page=${PER_PAGE}`)
  const action = useSubmit()

  function changeRole(user: AdminUser, role: Role) {
    void action.run(async () => {
      await send('PATCH', `/admin/users/${user.id}/role`, { role })
      reload()
      onChanged()
    })
  }

  function remove(user: AdminUser) {
    const ok = window.confirm(
      `¿Eliminar a ${user.email ?? user.id}? Se borrarán su cuenta y todos sus datos. Esta acción no se puede deshacer.`,
    )
    if (!ok) return
    void action.run(async () => {
      await send('DELETE', `/admin/users/${user.id}`)
      reload()
      onChanged()
    })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
      <div className="flex items-center justify-between gap-3 p-5 border-b border-hairline/60">
        <div className="flex items-center gap-2">
          <Users className="size-4.5 text-brand" />
          <h2 className="font-bold text-ink">Gestión de Usuarios</h2>
        </div>
        {data?.total != null && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-ink-secondary">
            {data.total} usuarios
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        {error && <ErrorBanner message={error} onRetry={reload} />}
        {action.error && <ErrorBanner message={action.error} />}
        {loading && !data && (
          <div className="grid h-32 place-items-center">
            <Spinner label="Cargando lista de usuarios…" />
          </div>
        )}
      </div>

      {data && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-y border-hairline bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">Rol</th>
                <th className="px-5 py-3">Actividad</th>
                <th className="px-5 py-3">Último acceso</th>
                <th className="px-5 py-3">Registro</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.users.map((user) => {
                const isMe = user.id === me?.id
                const active = isActive(user)
                const initials = (user.full_name || user.email || 'U')
                  .slice(0, 2)
                  .toUpperCase()

                return (
                  <tr key={user.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 place-items-center rounded-xl bg-brand/10 font-bold text-brand text-xs">
                          {initials}
                        </div>
                        <div>
                          <p className="font-bold text-ink">
                            {user.full_name || 'Sin nombre registrado'}
                            {isMe && (
                              <span className="ml-1.5 rounded-full bg-brand/10 px-2 py-0.2 text-[10px] font-bold text-brand">
                                Tú
                              </span>
                            )}
                            {user.uses_usd && (
                              <span className="ml-1.5 rounded-full bg-emerald-500/10 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                                USD
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-ink-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        aria-label={`Rol de ${user.email ?? user.id}`}
                        value={user.role}
                        disabled={isMe || action.submitting}
                        onChange={(e) => changeRole(user, e.target.value as Role)}
                        className="rounded-xl border border-hairline bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink outline-none transition-all focus:border-brand disabled:opacity-60 shadow-2xs"
                      >
                        <option value="user">Usuario normal</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-secondary tabular-nums">
                      <p className="font-semibold text-ink">{plural(user.movements_count, 'movimiento', 'movimientos')}</p>
                      <p>{plural(user.accounts_count, 'cuenta', 'cuentas')}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-secondary">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                        <span
                          className={`size-1.5 rounded-full ${active ? 'bg-status-good' : 'bg-ink-muted'}`}
                          aria-hidden
                        />
                        {active ? 'Activo' : 'Inactivo'}
                      </span>
                      <p title={user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : undefined}>
                        {user.last_sign_in_at ? formatRelative(user.last_sign_in_at) : 'Nunca ha ingresado'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-secondary tabular-nums" title={formatDateTime(user.created_at)}>
                      {formatRelative(user.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <IconButton
                        label={`Eliminar a ${user.email ?? user.id}`}
                        onClick={() => remove(user)}
                        disabled={isMe || action.submitting}
                        className="hover:text-status-critical hover:bg-status-critical/10"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && (page > 1 || data.has_more) && (
        <div className="flex items-center justify-between border-t border-hairline px-5 py-3 bg-slate-50/50">
          <span className="text-xs font-medium text-ink-muted">Página {page}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 text-xs"
            >
              <ChevronLeft className="size-3.5" aria-hidden />
              Anterior
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.has_more || loading}
              className="px-3 py-1.5 text-xs"
            >
              Siguiente
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Inició sesión en los últimos ACTIVE_DAYS días. */
function isActive(user: AdminUser): boolean {
  if (!user.last_sign_in_at) return false
  return Date.now() - new Date(user.last_sign_in_at).getTime() < ACTIVE_DAYS * 86_400_000
}
