import { BookmarkPlus, CalendarClock, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useApi } from '../../hooks/useApi'
import { useSubmit } from '../../hooks/useSubmit'
import { send } from '../../lib/api'
import { formatCurrency, formatMonth, formatPercent, todayISO } from '../../lib/format'
import { INSTALLMENT_OPTIONS } from '../../lib/labels'
import type { Account, Category, Currency, MovementTemplate, Transaction, TransactionType } from '../../types'
import { Button, Field, FormError, inputClass, Modal, ModalActions } from '../ui'

interface Props {
  transaction?: Transaction
  /** Cuentas de una sola moneda: la de `currency`. */
  accounts: Account[]
  currency?: Currency
  categories: Category[]
  onCategoriesChanged: () => void
  onClose: () => void
  /** savedDate: fecha del movimiento guardado (undefined al eliminar). */
  onSaved: (savedDate?: string) => void
}

export function TransactionFormModal({
  transaction,
  accounts,
  currency = 'COP',
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
  const [installments, setInstallments] = useState(transaction?.installments ?? 1)
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const save = useSubmit()
  const remove = useSubmit()
  const createCategory = useSubmit()

  // Plantillas de movimientos frecuentes (transporte, mercado...).
  // Cada moneda ve sus plantillas; las que no tienen cuenta se consideran en pesos.
  const templatesQuery = useApi<MovementTemplate[]>('/templates')
  const templates = (templatesQuery.data ?? []).filter((t) => (t.account?.currency ?? 'COP') === currency)
  const [activeTemplate, setActiveTemplate] = useState<MovementTemplate | null>(null)
  const [templateName, setTemplateName] = useState<string | null>(null) // null = formulario oculto
  const templateAction = useSubmit()

  const visibleCategories = categories.filter((c) => c.type === type)
  const account = accounts.find((a) => a.id === accountId)
  // Las cuotas solo aplican a gastos con tarjeta de crédito.
  const canSplit = type === 'expense' && account?.type === 'credit_card'
  const effectiveInstallments = canSplit ? installments : 1
  const amountValue = Number(amount) || 0
  const monthlyRate = Number(account?.monthly_interest_rate ?? 0)

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
      installments: effectiveInstallments,
    }
    void save.run(async () => {
      if (transaction) await send('PATCH', `/transactions/${transaction.id}`, body)
      else await send('POST', '/transactions', body)
      onSaved(date)
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

  /** Precarga el formulario con la plantilla; la fecha siempre es la de hoy. */
  function applyTemplate(template: MovementTemplate) {
    setType(template.type)
    setAmount(template.amount ? String(template.amount) : '')
    if (template.account_id && accounts.some((a) => a.id === template.account_id)) setAccountId(template.account_id)
    setCategoryId(template.category_id && categories.some((c) => c.id === template.category_id) ? template.category_id : '')
    setDescription(template.description ?? '')
    setInstallments(template.installments)
    setDate(todayISO())
    setActiveTemplate(template)
    setTemplateName(null)
  }

  /** Datos actuales del formulario en el formato de una plantilla. */
  function templateBody(name: string) {
    return {
      name,
      type,
      amount: amountValue > 0 ? amountValue : null,
      account_id: accountId || null,
      category_id: categoryId || null,
      description: description.trim() || null,
      installments: effectiveInstallments,
    }
  }

  function handleSaveTemplate() {
    const name = templateName?.trim()
    if (!name) return
    void templateAction.run(async () => {
      const created = await send<MovementTemplate>('POST', '/templates', templateBody(name))
      templatesQuery.reload()
      setActiveTemplate(created)
      setTemplateName(null)
    })
  }

  function handleUpdateTemplate() {
    if (!activeTemplate) return
    void templateAction.run(async () => {
      const updated = await send<MovementTemplate>(
        'PATCH',
        `/templates/${activeTemplate.id}`,
        templateBody(activeTemplate.name),
      )
      templatesQuery.reload()
      setActiveTemplate(updated)
    })
  }

  function handleDeleteTemplate(template: MovementTemplate) {
    if (!window.confirm(`¿Eliminar la plantilla "${template.name}"? Los movimientos ya registrados no cambian.`)) return
    void templateAction.run(async () => {
      await send('DELETE', `/templates/${template.id}`)
      templatesQuery.reload()
      if (activeTemplate?.id === template.id) setActiveTemplate(null)
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
        {/* Gastos frecuentes: un toque precarga los datos y la fecha de hoy. */}
        {!transaction && templates.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-ink-secondary">Plantillas</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Plantillas de movimientos">
              {templates.map((template) => {
                const active = activeTemplate?.id === template.id
                return (
                  <span
                    key={template.id}
                    className={`inline-flex items-center rounded-full border text-xs font-medium transition-colors ${
                      active ? 'border-brand bg-brand/10 text-brand-strong' : 'border-hairline text-ink-secondary'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => applyTemplate(template)}
                      aria-pressed={active}
                      className="rounded-l-full py-1 pr-1.5 pl-3 hover:text-ink"
                    >
                      {template.name}
                      {template.amount ? ` · ${formatCurrency(Number(template.amount), currency)}` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(template)}
                      aria-label={`Eliminar plantilla ${template.name}`}
                      title="Eliminar plantilla"
                      className="rounded-r-full py-1 pr-2 pl-1 text-ink-muted hover:text-status-critical"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        )}

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

        <Field label={currency === 'USD' ? 'Monto (US$)' : 'Monto'}>
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

        {canSplit && (
          <div className="space-y-1">
            <Field label="Cuotas">
              <select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className={inputClass}
              >
                {INSTALLMENT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? '1 cuota (de contado)' : `${n} cuotas`}
                  </option>
                ))}
              </select>
            </Field>
            {installments > 1 && amountValue > 0 && (
              <p className="text-xs text-ink-secondary">
                {installments} cuotas de {formatCurrency(amountValue / installments)}, una en cada corte desde el
                próximo.
                {monthlyRate > 0 &&
                  ` Más intereses: a ${formatPercent(monthlyRate, 2)} mensual, unos ${formatCurrency(amountValue * monthlyRate)} en la primera cuota (cada banco liquida distinto).`}
              </p>
            )}
          </div>
        )}

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
        {date && date.slice(0, 7) !== todayISO().slice(0, 7) && (
          <p className="flex items-start gap-1.5 text-xs text-ink-secondary">
            <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-status-warning" aria-hidden />
            {date > todayISO() ? 'Fecha futura: ' : 'Fecha de otro mes: '}
            este movimiento se verá en Movimientos de {formatMonth(date.slice(0, 7))}.
          </p>
        )}

        <Field label="Descripción (opcional)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={255}
            className={inputClass}
          />
        </Field>

        {/* Guardar lo que se está escribiendo como plantilla para la próxima vez. */}
        <div className="space-y-2 rounded-lg border border-dashed border-hairline p-3">
          {templateName === null ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => setTemplateName(activeTemplate ? '' : description.trim().slice(0, 60))}
                className="flex items-center gap-1.5 text-xs font-medium text-brand-strong"
              >
                <BookmarkPlus className="size-3.5" aria-hidden />
                Guardar como plantilla
              </button>
              {activeTemplate && (
                <button
                  type="button"
                  onClick={handleUpdateTemplate}
                  disabled={templateAction.submitting}
                  className="text-xs font-medium text-ink-secondary hover:text-ink"
                >
                  Actualizar «{activeTemplate.name}» con estos datos
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveTemplate()
                  }
                }}
                placeholder="Nombre, por ejemplo: Transporte"
                maxLength={60}
                aria-label="Nombre de la plantilla"
                className={inputClass}
                autoFocus
              />
              <Button variant="secondary" onClick={handleSaveTemplate} disabled={templateAction.submitting}>
                Guardar
              </Button>
              <Button variant="ghost" onClick={() => setTemplateName(null)}>
                Cancelar
              </Button>
            </div>
          )}
          <p className="text-xs text-ink-muted">
            Guarda el tipo, monto, cuenta, categoría y descripción. Al usarla, la fecha es la de hoy.
          </p>
          <FormError message={templateAction.error} />
        </div>

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
