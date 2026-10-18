import { ArrowLeftRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AccountFormModal } from '../components/accounts/AccountFormModal'
import { StatCard } from '../components/dashboard/StatCard'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { TransferFormModal } from '../components/transactions/TransferFormModal'
import { Button, Card, ErrorBanner, IconButton, PageHeader } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useSubmit } from '../hooks/useSubmit'
import { send } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { ACCOUNT_TYPES } from '../lib/labels'
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

interface AccountListProps {
  title: string
  subtitle?: string
  accounts: Account[]
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}

function AccountList({ title, subtitle, accounts, onEdit, onDelete }: AccountListProps) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between border-b border-hairline/60 pb-3">
        <div>
          <h2 className="font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      <ul className="divide-y divide-hairline">
        {accounts.map((account) => {
          const { label, icon: Icon } = ACCOUNT_TYPES[account.type]
          const balance = Number(account.balance)
          const isCard = account.type === 'credit_card'

          let iconStyle = 'bg-brand/10 text-brand border-brand/20'
          if (account.type === 'cash') iconStyle = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          if (isCard) iconStyle = 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'

          return (
            <li
              key={account.id}
              className="group -mx-2 flex items-center gap-3.5 rounded-xl px-2 py-3 transition-colors hover:bg-ink/[0.02]"
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${iconStyle} shadow-2xs`}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{account.name}</p>
                <p className="text-xs text-ink-muted">{label}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-ink">
                  {formatCurrency(isCard ? Math.abs(balance) : balance)}
                </p>
                {isCard && (
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      balance > 0
                        ? 'bg-status-good/10 text-status-good'
                        : balance < 0
                          ? 'bg-status-critical/10 text-status-critical'
                          : 'bg-slate-100 text-ink-muted'
                    }`}
                  >
                    {balance > 0 ? 'Saldo a favor' : balance < 0 ? 'Deuda' : 'Al día ($0)'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                <IconButton
                  label={`Editar ${account.name}`}
                  onClick={() => onEdit(account)}
                  className="hover:text-brand hover:bg-brand/10"
                >
                  <Pencil className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  label={`Eliminar ${account.name}`}
                  onClick={() => onDelete(account)}
                  className="hover:text-status-critical hover:bg-status-critical/10"
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
