import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { StatCard } from '../components/dashboard/StatCard'
import { Spinner } from '../components/Spinner'
import { Button, Card, ErrorBanner, IconButton, PageHeader } from '../components/ui'
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
      <PageHeader title="Administración" subtitle="Métricas globales y gestión de usuarios" />

      {metrics.loading && !data && <Spinner />}
      {metrics.error && <ErrorBanner message={metrics.error} onRetry={metrics.reload} />}

      {data && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Usuarios"
            value={String(data.total_users)}
            hint={`${data.new_users_30d} nuevos en 30 días · ${data.total_admins} admin`}
          />
          <StatCard label="Cuentas registradas" value={String(data.total_accounts)} />
          <StatCard label="Transacciones" value={String(data.total_transactions)} />
          <StatCard
            label={`Volumen ${formatMonth(data.month)}`}
            value={formatCurrency(data.platform_income + data.platform_expense)}
            hint={`Ingresos ${formatCurrency(data.platform_income)} · Gastos ${formatCurrency(data.platform_expense)}`}
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
    <Card className="p-0 md:p-0">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-5">
        <h2 className="font-semibold">Usuarios</h2>
        {data?.total != null && <span className="text-xs text-ink-muted">{data.total} en total</span>}
      </div>

      <div className="space-y-3 p-4 md:px-5">
        {error && <ErrorBanner message={error} onRetry={reload} />}
        {action.error && <ErrorBanner message={action.error} />}
        {loading && !data && <Spinner />}
      </div>

      {data && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-y border-hairline bg-page text-xs text-ink-secondary">
              <tr>
                <th className="px-4 py-2 font-medium md:px-5">Usuario</th>
                <th className="px-4 py-2 font-medium">Rol</th>
                <th className="px-4 py-2 font-medium">Último acceso</th>
                <th className="px-4 py-2 font-medium">Registro</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.users.map((user) => {
                const isMe = user.id === me?.id
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 md:px-5">
                      <p className="font-medium">
                        {user.full_name || 'Sin nombre'}
                        {isMe && <span className="ml-1 text-xs font-normal text-ink-muted">(tú)</span>}
                      </p>
                      <p className="text-xs text-ink-muted">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Rol de ${user.email ?? user.id}`}
                        value={user.role}
                        disabled={isMe || action.submitting}
                        onChange={(e) => changeRole(user, e.target.value as Role)}
                        className="rounded-md border border-hairline bg-surface px-2 py-1 text-sm disabled:opacity-60"
                      >
                        <option value="user">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : 'Nunca'}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{formatDateTime(user.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <IconButton
                        label={`Eliminar ${user.email ?? user.id}`}
                        onClick={() => remove(user)}
                        disabled={isMe || action.submitting}
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
        <div className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3 md:px-5">
          <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 1 || loading}>
            <ChevronLeft className="size-4" aria-hidden />
            Anterior
          </Button>
          <span className="text-sm text-ink-secondary">Página {page}</span>
          <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={!data.has_more || loading}>
            Siguiente
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </Card>
  )
}
