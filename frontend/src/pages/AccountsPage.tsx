import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AccountFormModal } from '../components/accounts/AccountFormModal'
import { StatCard } from '../components/dashboard/StatCard'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
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
        subtitle="Bancos, efectivo y tarjetas de crédito"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden />
            Nueva cuenta
          </Button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {del.error && <ErrorBanner message={del.error} />}
      {loading && !accounts && <Spinner />}

      {accounts && accounts.length === 0 && (
        <EmptyState text="Crea tu primera cuenta para empezar a registrar movimientos" />
      )}

      {accounts && accounts.length > 0 && (
        <>
          <section className="grid grid-cols-2 gap-3">
            <StatCard label="Saldo disponible" value={formatCurrency(available)} hint="Bancos y efectivo" />
            <StatCard label="Deuda en tarjetas" value={formatCurrency(debt)} />
          </section>

          {liquid.length > 0 && <AccountList title="Bancos y efectivo" accounts={liquid} onEdit={setEditing} onDelete={handleDelete} />}
          {cards.length > 0 && <AccountList title="Tarjetas de crédito" accounts={cards} onEdit={setEditing} onDelete={handleDelete} />}
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
    </div>
  )
}

interface AccountListProps {
  title: string
  accounts: Account[]
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}

function AccountList({ title, accounts, onEdit, onDelete }: AccountListProps) {
  return (
    <Card>
      <h2 className="mb-1 font-semibold">{title}</h2>
      <ul className="divide-y divide-hairline">
        {accounts.map((account) => {
          const { label, icon: Icon } = ACCOUNT_TYPES[account.type]
          const balance = Number(account.balance)
          const isCard = account.type === 'credit_card'
          return (
            <li key={account.id} className="flex items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/5 text-ink-secondary">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{account.name}</p>
                <p className="text-xs text-ink-muted">{label}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrency(isCard ? Math.abs(balance) : balance)}
                </p>
                {isCard && <p className="text-xs text-ink-muted">{balance > 0 ? 'saldo a favor' : 'deuda'}</p>}
              </div>
              <div className="flex">
                <IconButton label={`Editar ${account.name}`} onClick={() => onEdit(account)}>
                  <Pencil className="size-4" aria-hidden />
                </IconButton>
                <IconButton label={`Eliminar ${account.name}`} onClick={() => onDelete(account)}>
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
