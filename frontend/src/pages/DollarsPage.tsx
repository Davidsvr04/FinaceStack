import { ArrowLeftRight, ArrowRight, Banknote, DollarSign, EyeOff, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AccountFormModal } from '../components/accounts/AccountFormModal'
import { AccountList } from '../components/accounts/AccountList'
import { StatCard } from '../components/dashboard/StatCard'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { ExchangeFormModal } from '../components/transactions/ExchangeFormModal'
import { MovementContent } from '../components/transactions/MovementContent'
import { TransactionFormModal } from '../components/transactions/TransactionFormModal'
import { TransferDetailModal } from '../components/transactions/TransferDetailModal'
import { TransferFormModal } from '../components/transactions/TransferFormModal'
import { Button, Card, ErrorBanner, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { useSubmit } from '../hooks/useSubmit'
import { send } from '../lib/api'
import { currentMonth, formatCurrency, formatMonth } from '../lib/format'
import type { Account, Category, Paginated, Transaction, UsdSummary } from '../types'

const RECENT_LIMIT = 8

/**
 * Apartado de dólares: cuentas en USD con sus saldos, movimientos y compras o
 * ventas de dólares, separado de las finanzas en pesos.
 */
export function DollarsPage() {
  const month = currentMonth()
  const usdQuery = useApi<Account[]>('/accounts?currency=USD')
  // Cuentas en pesos: origen o destino al comprar o vender dólares.
  const copQuery = useApi<Account[]>('/accounts')
  const summaryQuery = useApi<UsdSummary>(`/usd/summary?month=${month}`)
  const recentQuery = useApi<Paginated<Transaction>>(`/transactions?currency=USD&limit=${RECENT_LIMIT}`)
  const categoriesQuery = useApi<Category[]>('/categories')
  const { setUsesUsd } = useAuth()
  const navigate = useNavigate()

  const [editingAccount, setEditingAccount] = useState<Account | 'new' | null>(null)
  const [movement, setMovement] = useState<Transaction | 'new' | null>(null)
  const [transferring, setTransferring] = useState(false)
  const [exchanging, setExchanging] = useState(false)
  const del = useSubmit()
  const hide = useSubmit()

  const accounts = usdQuery.data ?? []
  const copAccounts = copQuery.data ?? []
  const summary = summaryQuery.data
  const recent = recentQuery.data?.data ?? []
  const hasAccounts = accounts.length > 0

  function reloadAll() {
    usdQuery.reload()
    copQuery.reload()
    summaryQuery.reload()
    recentQuery.reload()
  }

  function handleDeleteAccount(account: Account) {
    const ok = window.confirm(
      `¿Eliminar "${account.name}"? También se eliminarán todos sus movimientos. Esta acción no se puede deshacer.`,
    )
    if (!ok) return
    void del.run(async () => {
      await send('DELETE', `/accounts/${account.id}`)
      reloadAll()
    })
  }

  function handleHide() {
    const ok = window.confirm(
      'El apartado de dólares dejará de verse en el menú. Tus cuentas y movimientos en dólares se conservan, y puedes volver a activarlo desde Cuentas.',
    )
    if (!ok) return
    void hide.run(async () => {
      await setUsesUsd(false)
      navigate('/cuentas')
    })
  }

  const error = usdQuery.error ?? summaryQuery.error ?? recentQuery.error

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dólares"
        subtitle="Tus cuentas en dólares, separadas de tus finanzas en pesos"
        actions={
          <>
            {hasAccounts && (
              <Button variant="secondary" onClick={() => setExchanging(true)}>
                <Banknote className="size-4" aria-hidden />
                Comprar o vender
              </Button>
            )}
            {accounts.length >= 2 && (
              <Button variant="secondary" onClick={() => setTransferring(true)}>
                <ArrowLeftRight className="size-4" aria-hidden />
                Transferir
              </Button>
            )}
            {hasAccounts && (
              <Button variant="secondary" onClick={() => setMovement('new')}>
                <Plus className="size-4" aria-hidden />
                Nuevo movimiento
              </Button>
            )}
            <Button onClick={() => setEditingAccount('new')} className="shadow-xs">
              <Plus className="size-4" aria-hidden />
              Nueva cuenta en dólares
            </Button>
          </>
        }
      />

      {error && <ErrorBanner message={error} onRetry={reloadAll} />}
      {(del.error ?? hide.error) && <ErrorBanner message={(del.error ?? hide.error)!} />}

      {usdQuery.loading && !usdQuery.data && (
        <div className="grid h-48 place-items-center">
          <Spinner label="Cargando tus cuentas en dólares…" />
        </div>
      )}

      {usdQuery.data && !hasAccounts && (
        <EmptyState
          title="Aún no tienes cuentas en dólares"
          text="Crea una cuenta en dólares (banco o efectivo) para registrar sus ingresos, gastos y compras o ventas de dólares. No se mezclan con tus cuentas en pesos."
          action={
            <Button onClick={() => setEditingAccount('new')}>
              <Plus className="size-4" />
              Crear cuenta en dólares
            </Button>
          }
        />
      )}

      {hasAccounts && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Saldo en dólares"
              value={formatCurrency(summary?.balance ?? 0, 'USD')}
              hint={`En ${accounts.length} cuenta${accounts.length > 1 ? 's' : ''}`}
              icon={DollarSign}
            />
            <StatCard
              label="Ingresos del mes"
              value={formatCurrency(summary?.income ?? 0, 'USD')}
              hint={formatMonth(month)}
            />
            <StatCard
              label="Gastos del mes"
              value={formatCurrency(summary?.expense ?? 0, 'USD')}
              hint={`Balance neto: ${formatCurrency(summary?.net ?? 0, 'USD')}`}
            />
            <StatCard
              label="Comprados este mes"
              value={formatCurrency(summary?.bought ?? 0, 'USD')}
              hint={
                summary?.average_purchase_rate
                  ? `Precio promedio de compra: ${formatCurrency(summary.average_purchase_rate)}`
                  : 'Registra una compra para ver tu precio promedio'
              }
              icon={Banknote}
            />
          </section>

          <AccountList
            title="Cuentas en dólares"
            subtitle={`${accounts.length} cuenta${accounts.length > 1 ? 's' : ''} en USD`}
            accounts={accounts}
            onEdit={setEditingAccount}
            onDelete={handleDeleteAccount}
          />

          <Card>
            <div className="mb-2 flex items-center justify-between border-b border-hairline/60 pb-3">
              <div>
                <h2 className="font-bold tracking-tight text-ink">Últimos movimientos</h2>
                <p className="text-xs text-ink-muted">Ingresos, gastos, transferencias y cambios de divisas</p>
              </div>
              <Link
                to="/dolares/movimientos"
                className="flex items-center gap-1 text-sm font-semibold text-brand-strong hover:underline"
              >
                Ver todos
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Aún no hay movimientos en tus cuentas en dólares.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {recent.map((tx) => (
                  <li key={tx.id}>
                    <button
                      type="button"
                      onClick={() => setMovement(tx)}
                      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3.5 rounded-xl px-2.5 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <MovementContent tx={tx} showDate />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <div className="flex justify-center">
        <Button variant="ghost" onClick={handleHide} disabled={hide.submitting} className="text-xs">
          <EyeOff className="size-3.5" aria-hidden />
          Ocultar el apartado de dólares
        </Button>
      </div>

      {editingAccount && (
        <AccountFormModal
          account={editingAccount === 'new' ? undefined : editingAccount}
          currency="USD"
          onClose={() => setEditingAccount(null)}
          onSaved={() => {
            setEditingAccount(null)
            reloadAll()
          }}
        />
      )}

      {movement && movement !== 'new' && movement.transfer_id && (
        <TransferDetailModal
          transaction={movement}
          onClose={() => setMovement(null)}
          onDeleted={() => {
            setMovement(null)
            reloadAll()
          }}
        />
      )}

      {movement && (movement === 'new' || !movement.transfer_id) && (
        <TransactionFormModal
          transaction={movement === 'new' ? undefined : movement}
          accounts={accounts}
          currency="USD"
          categories={categoriesQuery.data ?? []}
          onCategoriesChanged={categoriesQuery.reload}
          onClose={() => setMovement(null)}
          onSaved={() => {
            setMovement(null)
            reloadAll()
          }}
        />
      )}

      {transferring && (
        <TransferFormModal
          accounts={accounts}
          currency="USD"
          onClose={() => setTransferring(false)}
          onSaved={() => {
            setTransferring(false)
            reloadAll()
          }}
        />
      )}

      {exchanging && (
        <ExchangeFormModal
          copAccounts={copAccounts}
          usdAccounts={accounts}
          onClose={() => setExchanging(false)}
          onSaved={() => {
            setExchanging(false)
            reloadAll()
          }}
        />
      )}
    </div>
  )
}
