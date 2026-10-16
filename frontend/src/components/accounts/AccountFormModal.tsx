import { useState, type FormEvent } from 'react'
import { useSubmit } from '../../hooks/useSubmit'
import { send } from '../../lib/api'
import { optionalNumber } from '../../lib/format'
import { ACCOUNT_TYPES } from '../../lib/labels'
import type { Account, AccountType } from '../../types'
import { Button, Field, FormError, inputClass, Modal, ModalActions } from '../ui'

interface Props {
  /** Si se pasa, el formulario edita esa cuenta. */
  account?: Account
  defaultType?: AccountType
  /** Oculta el selector de tipo (p. ej. desde la página de tarjetas). */
  lockType?: boolean
  onClose: () => void
  onSaved: () => void
}

const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

export function AccountFormModal({ account, defaultType = 'bank', lockType = false, onClose, onSaved }: Props) {
  const isEdit = Boolean(account)
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? defaultType)
  const [initialBalance, setInitialBalance] = useState('')
  const [creditLimit, setCreditLimit] = useState(str(account?.credit_limit))
  const [cutOffDay, setCutOffDay] = useState(str(account?.cut_off_day))
  const [paymentDueDay, setPaymentDueDay] = useState(str(account?.payment_due_day))
  const [ratePct, setRatePct] = useState(
    account?.monthly_interest_rate == null ? '' : String(+(account.monthly_interest_rate * 100).toFixed(4)),
  )
  const { run, submitting, error } = useSubmit()

  const isCard = type === 'credit_card'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const rate = optionalNumber(ratePct)
    const cardFields = isCard
      ? {
          credit_limit: optionalNumber(creditLimit),
          cut_off_day: optionalNumber(cutOffDay),
          payment_due_day: optionalNumber(paymentDueDay),
          monthly_interest_rate: rate === undefined ? undefined : rate / 100,
        }
      : {}

    void run(async () => {
      if (account) {
        await send('PATCH', `/accounts/${account.id}`, { name, ...cardFields })
      } else {
        await send('POST', '/accounts', {
          name,
          type,
          initial_balance: optionalNumber(initialBalance) ?? 0,
          ...cardFields,
        })
      }
      onSaved()
    })
  }

  const title = isEdit
    ? `Editar ${isCard ? 'tarjeta' : 'cuenta'}`
    : isCard && lockType
      ? 'Nueva tarjeta de crédito'
      : 'Nueva cuenta'

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre">
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isCard ? 'Visa Bancolombia' : 'Cuenta de ahorros'}
            className={inputClass}
            autoFocus
          />
        </Field>

        {!lockType && !isEdit && (
          <Field label="Tipo">
            <select value={type} onChange={(e) => setType(e.target.value as AccountType)} className={inputClass}>
              {Object.entries(ACCOUNT_TYPES).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {!isEdit && (
          <Field
            label={isCard ? 'Deuda actual' : 'Saldo inicial'}
            hint={isCard ? 'Lo que debes hoy en la tarjeta. Déjalo en 0 si está al día.' : undefined}
          >
            <input
              type="number"
              step="0.01"
              min={isCard ? 0 : undefined}
              inputMode="decimal"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </Field>
        )}

        {isCard && (
          <>
            <Field label="Cupo total">
              <input
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Día de corte">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cutOffDay}
                  onChange={(e) => setCutOffDay(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Día de pago">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={paymentDueDay}
                  onChange={(e) => setPaymentDueDay(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Tasa de interés mensual (%)" hint="Ejemplo: 2.15 para 2,15 % mensual">
              <input
                type="number"
                step="0.0001"
                min={0}
                max={100}
                inputMode="decimal"
                value={ratePct}
                onChange={(e) => setRatePct(e.target.value)}
                className={inputClass}
              />
            </Field>
          </>
        )}

        <FormError message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}
