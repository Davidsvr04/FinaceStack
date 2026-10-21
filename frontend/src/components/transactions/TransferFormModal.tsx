import { AlertTriangle, ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useSubmit } from '../../hooks/useSubmit'
import { send } from '../../lib/api'
import { formatCurrency, todayISO } from '../../lib/format'
import type { Account, Currency } from '../../types'
import { Button, Field, FormError, inputClass, Modal, ModalActions } from '../ui'

interface Props {
  accounts: Account[]
  /** Solo se transfiere entre cuentas de la misma moneda. */
  currency?: Currency
  onClose: () => void
  /** savedDate: fecha de la transferencia, para mostrar el mes correcto. */
  onSaved: (savedDate: string) => void
}

/**
 * Pasar dinero de una cuenta a otra (p. ej. de Bancolombia a Nu). Queda como
 * movimiento pero no es ingreso ni gasto. Las tarjetas se pagan desde Tarjetas.
 */
export function TransferFormModal({ accounts, currency = 'COP', onClose, onSaved }: Props) {
  const usable = accounts.filter((a) => a.type !== 'credit_card' && a.currency === currency)
  const isUsd = currency === 'USD'
  const [fromId, setFromId] = useState(usable[0]?.id ?? '')
  const [toId, setToId] = useState(usable.find((a) => a.id !== usable[0]?.id)?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const { run, submitting, error } = useSubmit()

  const from = usable.find((a) => a.id === fromId)
  const exceeds = from !== undefined && Number(amount) > Number(from.balance)

  function changeFrom(id: string) {
    setFromId(id)
    // Origen y destino no pueden ser la misma cuenta.
    if (id === toId) setToId(usable.find((a) => a.id !== id)?.id ?? '')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      await send('POST', '/transactions/transfer', {
        from_account_id: fromId,
        to_account_id: toId,
        amount: Number(amount),
        date,
        ...(description.trim() && { description: description.trim() }),
      })
      onSaved(date)
    })
  }

  if (usable.length < 2) {
    return (
      <Modal title="Transferir entre cuentas" onClose={onClose}>
        <p className="text-sm text-ink-secondary">
          Necesitas al menos dos cuentas {isUsd ? 'en dólares' : 'bancarias o de efectivo'} para pasar dinero de una
          a otra.{' '}
          <Link to={isUsd ? '/dolares' : '/cuentas'} className="font-medium text-brand-strong hover:underline">
            Crear cuenta
          </Link>
        </p>
      </Modal>
    )
  }

  return (
    <Modal title="Transferir entre cuentas" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Field label="Desde">
            <select required value={fromId} onChange={(e) => changeFrom(e.target.value)} className={inputClass}>
              {usable.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {formatCurrency(Number(a.balance), currency)}
                </option>
              ))}
            </select>
          </Field>
          <ArrowRight className="mb-2.5 size-4 text-ink-muted" aria-hidden />
          <Field label="Hacia">
            <select required value={toId} onChange={(e) => setToId(e.target.value)} className={inputClass}>
              {usable
                .filter((a) => a.id !== fromId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {formatCurrency(Number(a.balance), currency)}
                  </option>
                ))}
            </select>
          </Field>
        </div>

        <Field label={isUsd ? 'Monto (US$)' : 'Monto'}>
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
        {exceeds && (
          <p className="flex items-start gap-1.5 text-xs text-ink-secondary">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-status-warning" aria-hidden />
            El monto supera el saldo de «{from.name}»; quedará en negativo.
          </p>
        )}

        <Field label="Fecha">
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>

        <Field label="Descripción (opcional)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={255}
            placeholder="Transferencia entre cuentas"
            className={inputClass}
          />
        </Field>

        <p className="text-xs text-ink-muted">
          Se descuenta de la cuenta de origen y se suma a la de destino. Queda registrado en Movimientos, pero no
          cuenta como gasto ni como ingreso.
        </p>

        <FormError message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !toId}>
            {submitting ? 'Transfiriendo…' : 'Transferir'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}
