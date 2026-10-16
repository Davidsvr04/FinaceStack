import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSubmit } from '../../hooks/useSubmit'
import { send } from '../../lib/api'
import { todayISO } from '../../lib/format'
import type { Account, Category, Transaction, TransactionType } from '../../types'
import { Button, Field, FormError, inputClass, Modal, ModalActions } from '../ui'

interface Props {
  transaction?: Transaction
  accounts: Account[]
  categories: Category[]
  onCategoriesChanged: () => void
  onClose: () => void
  onSaved: () => void
}

export function TransactionFormModal({
  transaction,
  accounts,
  categories,
  onCategoriesChanged,
  onClose,
  onSaved,
}: Props) {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense')
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [accountId, setAccountId] = useState(transaction?.account_id ?? accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '')
  const [date, setDate] = useState(transaction?.date ?? todayISO())
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const save = useSubmit()
  const remove = useSubmit()
  const createCategory = useSubmit()

  const visibleCategories = categories.filter((c) => c.type === type)

  function changeType(next: TransactionType) {
    setType(next)
    // La categoría debe coincidir con el tipo; se limpia al cambiarlo.
    if (categories.find((c) => c.id === categoryId)?.type !== next) setCategoryId('')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const body = {
      type,
      amount: Number(amount),
      account_id: accountId,
      category_id: categoryId || null,
      date,
      description: description.trim() || null,
    }
    void save.run(async () => {
      if (transaction) await send('PATCH', `/transactions/${transaction.id}`, body)
      else await send('POST', '/transactions', body)
      onSaved()
    })
  }

  function handleCreateCategory() {
    const name = newCategory?.trim()
    if (!name) return
    void createCategory.run(async () => {
      const created = await send<Category>('POST', '/categories', { name, type })
      onCategoriesChanged()
      setCategoryId(created.id)
      setNewCategory(null)
    })
  }

  function handleDelete() {
    if (!transaction || !window.confirm('¿Eliminar este movimiento?')) return
    void remove.run(async () => {
      await send('DELETE', `/transactions/${transaction.id}`)
      onSaved()
    })
  }

  return (
    <Modal title={transaction ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink/5 p-1" role="radiogroup" aria-label="Tipo">
          {(['expense', 'income'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => changeType(value)}
              className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
                type === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-secondary'
              }`}
            >
              {value === 'expense' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>

        <Field label="Monto">
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </Field>

        <Field label="Cuenta">
          <select required value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="space-y-1">
          <Field label="Categoría">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">Sin categoría</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          {newCategory === null ? (
            <button
              type="button"
              onClick={() => setNewCategory('')}
              className="flex items-center gap-1 text-xs font-medium text-brand-strong"
            >
              <Plus className="size-3" aria-hidden />
              Nueva categoría de {type === 'expense' ? 'gasto' : 'ingreso'}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateCategory()
                  }
                }}
                placeholder="Nombre de la categoría"
                maxLength={60}
                aria-label="Nombre de la nueva categoría"
                className={inputClass}
              />
              <Button variant="secondary" onClick={handleCreateCategory} disabled={createCategory.submitting}>
                Crear
              </Button>
              <Button variant="ghost" onClick={() => setNewCategory(null)}>
                Cancelar
              </Button>
            </div>
          )}
          <FormError message={createCategory.error} />
        </div>

        <Field label="Fecha">
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>

        <Field label="Descripción (opcional)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={255}
            className={inputClass}
          />
        </Field>

        <FormError message={save.error ?? remove.error} />
        <ModalActions>
          {transaction && (
            <Button variant="danger" onClick={handleDelete} disabled={remove.submitting} className="mr-auto">
              Eliminar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={save.submitting}>
            {save.submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}
