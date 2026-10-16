import { Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { MovementContent } from '../components/transactions/MovementContent'
import { TransactionFormModal } from '../components/transactions/TransactionFormModal'
import { TransferDetailModal } from '../components/transactions/TransferDetailModal'
import { Button, Card, ErrorBanner, inputClass, PageHeader } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import { currentMonth, formatCurrency, formatLongDate, monthRange } from '../lib/format'
import type { Account, Category, Paginated, Transaction, TransactionKind } from '../types'

const PAGE_SIZE = 50

export function TransactionsPage() {
  const accountsQuery = useApi<Account[]>('/accounts')
  const categoriesQuery = useApi<Category[]>('/categories')
  const accounts = accountsQuery.data ?? []
  const categories = categoriesQuery.data ?? []

  const [month, setMonth] = useState(currentMonth)
  const [kind, setKind] = useState<TransactionKind | ''>('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const [items, setItems] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams({ ...monthRange(month), limit: String(PAGE_SIZE) })
    if (kind) params.set('kind', kind)
    if (accountId) params.set('account_id', accountId)
    if (categoryId) params.set('category_id', categoryId)
    return params.toString()
  }, [month, kind, accountId, categoryId])

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(null)
    api<Paginated<Transaction>>(`/transactions?${query}&offset=0`)
      .then((result) => {
        if (cancelled) return
        setItems(result.data)
        setTotal(result.total)
      })
      .catch((err: unknown) => {
        if (!cancelled) setListError(err instanceof Error ? err.message : 'Error inesperado')
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query, version])

  async function loadMore() {
    setListLoading(true)
    try {
      const result = await api<Paginated<Transaction>>(`/transactions?${query}&offset=${items.length}`)
      setItems((prev) => [...prev, ...result.data])
      setTotal(result.total)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setListLoading(false)
    }
  }

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>()
    for (const tx of items) byDate.set(tx.date, [...(byDate.get(tx.date) ?? []), tx])
    return [...byDate]
  }, [items])

  // Las transferencias (pagos a tarjeta, ahorros) no son ingresos ni gastos.
  const sumOf = (type: 'income' | 'expense') =>
    items.filter((t) => t.type === type && !t.transfer_id).reduce((s, t) => s + Number(t.amount), 0)
  const income = sumOf('income')
  const expense = sumOf('expense')
  const hasAccounts = accounts.length > 0
  const filteredCategories =
    kind === 'income' || kind === 'expense' ? categories.filter((c) => c.type === kind) : categories

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimientos"
        subtitle="Ingresos, gastos, pagos a tarjeta y ahorros"
        actions={
          <Button onClick={() => setEditing('new')} disabled={!hasAccounts}>
            <Plus className="size-4" aria-hidden />
            Nuevo movimiento
          </Button>
        }
      />

      {accountsQuery.data && !hasAccounts && (
        <Card className="text-sm">
          Para registrar movimientos primero necesitas una cuenta.{' '}
          <Link to="/cuentas" className="font-medium text-brand-strong hover:underline">
            Crear cuenta
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <input
          type="month"
          aria-label="Mes"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className={inputClass}
        />
        <select
          aria-label="Tipo"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as TransactionKind | '')
            setCategoryId('')
          }}
          className={inputClass}
        >
          <option value="">Todos los movimientos</option>
          <option value="income">Solo ingresos</option>
          <option value="expense">Solo gastos</option>
          <option value="transfer">Pagos a tarjeta y ahorros</option>
        </select>
        <select aria-label="Cuenta" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
          <option value="">Todas las cuentas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Categoría"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={kind === 'transfer'}
          className={inputClass}
        >
          <option value="">Todas las categorías</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {listError && <ErrorBanner message={listError} onRetry={refresh} />}

      {items.length > 0 && items.length === total && (
        <p className="text-sm text-ink-secondary">
          {total} movimientos · Ingresos {formatCurrency(income)} · Gastos {formatCurrency(expense)}
        </p>
      )}

      {listLoading && items.length === 0 && <Spinner />}
      {!listLoading && !listError && items.length === 0 && <EmptyState text="No hay movimientos con estos filtros" />}

      {groups.length > 0 && (
        <Card className="p-0 md:p-0">
          {groups.map(([date, txs]) => (
            <div key={date}>
              <h3 className="border-b border-hairline bg-page px-4 py-2 text-xs font-medium text-ink-secondary first-letter:uppercase">
                {formatLongDate(date)}
              </h3>
              <ul className="divide-y divide-hairline">
                {txs.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} onClick={() => setEditing(tx)} />
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}

      {items.length < total && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => void loadMore()} disabled={listLoading}>
            {listLoading ? 'Cargando…' : `Cargar más (${total - items.length} restantes)`}
          </Button>
        </div>
      )}

      {editing && editing !== 'new' && editing.transfer_id && (
        <TransferDetailModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onDeleted={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}

      {editing && (editing === 'new' || !editing.transfer_id) && (
        <TransactionFormModal
          transaction={editing === 'new' ? undefined : editing}
          accounts={accounts}
          categories={categories}
          onCategoriesChanged={categoriesQuery.reload}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function TransactionRow({ tx, onClick }: { tx: Transaction; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.03]"
      >
        <MovementContent tx={tx} />
      </button>
    </li>
  )
}
