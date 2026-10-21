import { ArrowLeftRight, ArrowRight, DollarSign, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AccountFormModal } from '../components/accounts/AccountFormModal'
import { AccountList } from '../components/accounts/AccountList'
import { StatCard } from '../components/dashboard/StatCard'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { TransferFormModal } from '../components/transactions/TransferFormModal'
import { Button, ErrorBanner, FormError, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { useSubmit } from '../hooks/useSubmit'
import { send } from '../lib/api'
import { formatCurrency } from '../lib/format'
import type { Account } from '../types'

export function AccountsPage() {
  const { data: accounts, error, loading, reload } = useApi<Account[]>('/accounts')
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [transferring, setTransferring] = useState(false)
  const del = useSubmit()

  function handleDelete(account: Account) {
    const ok = window.confirm(
      `¿Eliminar "${account.name}"? También se eliminarán todos sus movimientos. Esta acción no se puede deshacer.`,
    )
    if (!ok) return
    void del.run(async () => {
      await send('DELETE', `/accounts/${account.id}`)
      reload()
    })
  }

  const liquid = accounts?.filter((a) => a.type !== 'credit_card') ?? []
  const cards = accounts?.filter((a) => a.type === 'credit_card') ?? []
  const available = liquid.reduce((sum, a) => sum + Number(a.balance), 0)
  const debt = cards.reduce((sum, a) => sum + Math.max(0, -Number(a.balance)), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuentas"
        subtitle="Administra tus bancos, billeteras de efectivo y tarjetas de crédito"
        actions={
          <>
            {liquid.length >= 2 && (
              <Button variant="secondary" onClick={() => setTransferring(true)}>
                <ArrowLeftRight className="size-4" aria-hidden />
                Transferir
              </Button>
            )}
            <Button onClick={() => setEditing('new')} className="shadow-xs">
              <Plus className="size-4" aria-hidden />
              Nueva cuenta
            </Button>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {del.error && <ErrorBanner message={del.error} />}
      {loading && !accounts && (
        <div className="grid h-48 place-items-center">
          <Spinner label="Cargando tus cuentas…" />
        </div>
      )}

      {accounts && accounts.length === 0 && (
        <EmptyState
          title="No tienes cuentas registradas"
          text="Crea tu primera cuenta bancaria o billetera para empezar a registrar movimientos y llevar tus finanzas al día."
          action={
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" />
              Crear mi primera cuenta
            </Button>
          }
        />
      )}

      {accounts && accounts.length > 0 && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard label="Saldo disponible" value={formatCurrency(available)} hint="En cuentas de ahorro y efectivo" />
            <StatCard label="Deuda en tarjetas" value={formatCurrency(debt)} hint="Saldo total adeudado a la fecha" />
          </section>

          {liquid.length > 0 && (
            <AccountList
              title="Bancos y efectivo"
              subtitle={`${liquid.length} cuenta${liquid.length > 1 ? 's' : ''} activa${liquid.length > 1 ? 's' : ''}`}
              accounts={liquid}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          )}

          {cards.length > 0 && (
            <AccountList
              title="Tarjetas de crédito"
              subtitle={`${cards.length} tarjeta${cards.length > 1 ? 's' : ''} vinculada${cards.length > 1 ? 's' : ''}`}
              accounts={cards}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          )}
        </>
      )}

      <UsdSectionCard />

      {editing && (
        <AccountFormModal
          account={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}

      {transferring && accounts && (
        <TransferFormModal
          accounts={accounts}
          onClose={() => setTransferring(false)}
          onSaved={() => {
            setTransferring(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

/** Acceso al apartado de dólares: lo activa quien maneja cuentas en USD. */
function UsdSectionCard() {
  const { profile, setUsesUsd } = useAuth()
  const navigate = useNavigate()
  const activate = useSubmit()

  if (profile?.uses_usd) {
    return (
      <Link
        to="/dolares"
        className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 text-sm shadow-xs transition-colors hover:bg-ink/[0.02]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
          <DollarSign className="size-4.5" aria-hidden />
        </span>
        <span className="flex-1 text-ink-secondary">
          Tus cuentas en dólares se llevan aparte, en el apartado <span className="font-semibold text-ink">Dólares</span>.
        </span>
        <ArrowRight className="size-4 text-ink-muted" aria-hidden />
      </Link>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-hairline p-4 text-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
        <DollarSign className="size-4.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">¿Manejas cuentas en dólares?</p>
        <p className="text-xs text-ink-muted">
          Activa un apartado para registrarlas en USD, separadas de tus cuentas en pesos. Si no lo usas, no cambia nada.
        </p>
        <FormError message={activate.error} />
      </div>
      <Button
        variant="secondary"
        disabled={activate.submitting}
        onClick={() =>
          void activate.run(async () => {
            await setUsesUsd(true)
            navigate('/dolares')
          })
        }
      >
        {activate.submitting ? 'Activando…' : 'Activar dólares'}
      </Button>
    </div>
  )
}
