import { Filter, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import { MovementContent } from '../components/transactions/MovementContent'
import { TransactionFormModal } from '../components/transactions/TransactionFormModal'
import { TransferDetailModal } from '../components/transactions/TransferDetailModal'
import { Button, ErrorBanner, inputClass, PageHeader } from '../components/ui'
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

  // ?mes=YYYY-MM permite abrir la página en un mes concreto (p. ej. desde Inicio).
  const [searchParams] = useSearchParams()
  const [month, setMonth] = useState(() => {
    const fromUrl = searchParams.get('mes')
    return fromUrl && /^\d{4}-(0[1-9]|1[0-2])$/.test(fromUrl) ? fromUrl : currentMonth()
  })
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
  const net = income - expense
  const hasAccounts = accounts.length > 0
  const filteredCategories =
    kind === 'income' || kind === 'expense' ? categories.filter((c) => c.type === kind) : categories

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimientos"
        subtitle="Monitorea tus ingresos, gastos diarios, pagos de tarjetas y transferencias"
        actions={
          <Button onClick={() => setEditing('new')} disabled={!hasAccounts} className="shadow-xs">
            <Plus className="size-4" aria-hidden />
            Nuevo movimiento
          </Button>
        }
      />

      {accountsQuery.data && !hasAccounts && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4 text-sm text-ink">
          <Wallet className="size-5 text-brand shrink-0" />
          <p>
            Para registrar movimientos primero necesitas crear una cuenta.{' '}
            <Link to="/cuentas" className="font-semibold text-brand hover:underline">
              Crear cuenta aquí
            </Link>
          </p>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="rounded-2xl border border-hairline bg-surface p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3 text-xs font-bold text-ink-muted uppercase tracking-wider">
          <Filter className="size-3.5" />
          <span>Filtros de Búsqueda</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          <select
            aria-label="Cuenta"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={inputClass}
          >
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
      </div>

      {/* Mini Resumen del Filtro */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between rounded-xl border border-status-good/20 bg-status-good/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-status-good" />
              <span className="text-xs font-semibold text-ink-secondary">Ingresos mes</span>
            </div>
            <span className="text-sm font-bold text-status-good tabular-nums">+{formatCurrency(income)}</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-4 text-rose-600" />
              <span className="text-xs font-semibold text-ink-secondary">Gastos mes</span>
            </div>
            <span className="text-sm font-bold text-rose-600 tabular-nums">−{formatCurrency(expense)}</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-4 py-3 shadow-xs">
            <span className="text-xs font-semibold text-ink-secondary">Balance neto</span>
            <span
              className={`text-sm font-bold tabular-nums ${
                net >= 0 ? 'text-status-good' : 'text-status-critical'
              }`}
            >
              {formatCurrency(net)}
            </span>
          </div>
        </div>
      )}

      {listError && <ErrorBanner message={listError} onRetry={refresh} />}

      {listLoading && items.length === 0 && (
        <div className="grid h-48 place-items-center">
          <Spinner label="Buscando transacciones…" />
        </div>
      )}

      {!listLoading && !listError && items.length === 0 && (
        <EmptyState
          title="No hay movimientos registrados"
          text="No encontramos transacciones para el mes o filtros seleccionados."
          action={
            <Button onClick={() => setEditing('new')} disabled={!hasAccounts}>
              <Plus className="size-4" />
              Registrar nuevo movimiento
            </Button>
          }
        />
      )}

      {groups.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
          {groups.map(([date, txs]) => (
            <div key={date}>
              <div className="sticky top-0 z-10 border-b border-hairline bg-slate-50/90 px-4 py-2 text-xs font-bold text-ink-secondary uppercase tracking-wider backdrop-blur-xs">
                {formatLongDate(date)}
              </div>
              <ul className="divide-y divide-hairline">
                {txs.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} onClick={() => setEditing(tx)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {items.length < total && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={() => void loadMore()} disabled={listLoading}>
            {listLoading ? 'Cargando más…' : `Cargar más movimientos (${total - items.length} restantes)`}
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
          onSaved={(savedDate) => {
            setEditing(null)
            const savedMonth = savedDate?.slice(0, 7)
            if (savedMonth && savedMonth !== month) setMonth(savedMonth)
            else refresh()
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
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100/60"
      >
        <MovementContent tx={tx} />
      </button>
    </li>
  )
}
