import { ChevronLeft, ChevronRight, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { StatCard } from '../components/dashboard/StatCard'
import { Spinner } from '../components/Spinner'
import { Button, ErrorBanner, IconButton, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { useSubmit } from '../hooks/useSubmit'
import { send } from '../lib/api'
import { formatCurrency, formatDateTime, formatMonth } from '../lib/format'
import type { AdminMetrics, AdminUser, AdminUsersPage, Role } from '../types'

const PER_PAGE = 20

export function AdminPage() {
  const metrics = useApi<AdminMetrics>('/admin/metrics')
  const data = metrics.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración Global"
        subtitle="Métricas consolidadas de la plataforma y control de usuarios"
      />

      {metrics.loading && !data && (
        <div className="grid h-48 place-items-center">
          <Spinner label="Cargando métricas de administración…" />
        </div>
      )}
      {metrics.error && <ErrorBanner message={metrics.error} onRetry={metrics.reload} />}

      {data && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Usuarios totales"
            value={String(data.total_users)}
            hint={`${data.new_users_30d} nuevos en 30 días · ${data.total_admins} admin`}
          />
          <StatCard label="Cuentas registradas" value={String(data.total_accounts)} hint="En toda la plataforma" />
          <StatCard label="Transacciones" value={String(data.total_transactions)} hint="Movimientos históricos" />
          <StatCard
            label={`Volumen ${formatMonth(data.month)}`}
            value={formatCurrency(data.platform_income + data.platform_expense)}
            hint={`Ingresos: ${formatCurrency(data.platform_income)} · Gastos: ${formatCurrency(data.platform_expense)}`}
          />
        </section>
      )}

      <UsersTable onChanged={metrics.reload} />
    </div>
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
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-y border-hairline bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">Rol</th>
                <th className="px-5 py-3">Último acceso</th>
                <th className="px-5 py-3">Fecha de Registro</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.users.map((user) => {
                const isMe = user.id === me?.id
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
                      {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : 'Sin ingresos'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-secondary tabular-nums">
                      {formatDateTime(user.created_at)}
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
