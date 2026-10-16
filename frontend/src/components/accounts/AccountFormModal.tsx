import { useState, type FormEvent } from 'react'
import { useSubmit } from '../../hooks/useSubmit'
import { send } from '../../lib/api'
import { formatCurrency, formatDate, nextOccurrence, optionalNumber, todayISO } from '../../lib/format'
import { ACCOUNT_TYPES, INSTALLMENT_OPTIONS } from '../../lib/labels'
import type { Account, AccountType, CreditCard } from '../../types'
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
  const [openingBilled, setOpeningBilled] = useState(
    account && Number(account.opening_billed_debt) > 0 ? String(account.opening_billed_debt) : '',
  )
  const [openingNext, setOpeningNext] = useState(str(account?.opening_next_charge))
  const [openingLater, setOpeningLater] = useState(account?.opening_later_installments ?? 1)
  const [feeAmount, setFeeAmount] = useState(str(account?.handling_fee_amount))
  // Al editar se propone la próxima fecha de cobro según el día guardado.
  const [feeDate, setFeeDate] = useState(account?.handling_fee_day ? nextOccurrence(account.handling_fee_day) : '')
  const [ratePct, setRatePct] = useState(
    account?.monthly_interest_rate == null ? '' : String(+(account.monthly_interest_rate * 100).toFixed(4)),
  )
  const { run, submitting, error } = useSubmit()

  const isCard = type === 'credit_card'
  // Deuda que había al registrar la tarjeta: la que se escribe al crearla o,
  // al editar desde Tarjetas, la que reconstruye el backend.
  const openingDebt = isEdit
    ? account && 'opening_debt' in account
      ? Number((account as CreditCard).opening_debt)
      : 0
    : Math.abs(optionalNumber(initialBalance) ?? 0)
  const nextCharge = optionalNumber(openingNext)
  const remainder =
    nextCharge === undefined ? 0 : Math.max(0, openingDebt - (optionalNumber(openingBilled) ?? 0) - nextCharge)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const rate = optionalNumber(ratePct)
    const cardFields = isCard
      ? {
          credit_limit: optionalNumber(creditLimit),
          cut_off_day: optionalNumber(cutOffDay),
          payment_due_day: optionalNumber(paymentDueDay),
          monthly_interest_rate: rate === undefined ? undefined : rate / 100,
          // Sin valor = sin cuota de manejo (al editar, la quita).
          ...(optionalNumber(feeAmount)
            ? { handling_fee_amount: optionalNumber(feeAmount), handling_fee_start: feeDate }
            : isEdit && account?.handling_fee_amount
              ? { handling_fee_amount: null }
              : {}),
          ...(openingDebt > 0 && {
            opening_billed_debt: optionalNumber(openingBilled) ?? 0,
            opening_next_charge: nextCharge ?? null,
            opening_later_installments: openingLater,
          }),
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

        {isCard && openingDebt > 0 && (
          <fieldset className="space-y-3 rounded-lg border border-hairline p-3">
            <legend className="px-1 text-sm font-medium">
              ¿Cómo te cobran {isEdit ? `la deuda inicial de ${formatCurrency(openingDebt)}` : 'esa deuda'}?
            </legend>
            <Field
              label="Ya facturado y sin pagar"
              hint="Si tu último extracto no está pagado, su valor. Se cobra en la próxima fecha de pago."
            >
              <input
                type="number"
                step="0.01"
                min={0}
                max={openingDebt}
                inputMode="decimal"
                value={openingBilled}
                onChange={(e) => setOpeningBilled(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field
              label="Se cobra en el próximo extracto"
              hint="Normalmente tu pago mínimo del próximo corte. Vacío = todo lo que no está facturado."
            >
              <input
                type="number"
                step="0.01"
                min={0}
                max={Math.max(0, openingDebt - (optionalNumber(openingBilled) ?? 0))}
                inputMode="decimal"
                value={openingNext}
                onChange={(e) => setOpeningNext(e.target.value)}
                placeholder="Todo"
                className={inputClass}
              />
            </Field>
            {remainder > 0 && (
              <Field label="El resto, ¿en cuántos meses?">
                <select
                  value={openingLater}
                  onChange={(e) => setOpeningLater(Number(e.target.value))}
                  className={inputClass}
                >
                  {INSTALLMENT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? '1 mes' : `${n} meses`} · {formatCurrency(remainder / n)}/mes
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </fieldset>
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
            <fieldset className="space-y-3 rounded-lg border border-hairline p-3">
              <legend className="px-1 text-sm font-medium">Cuota de manejo (opcional)</legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor mensual">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    placeholder="Sin cuota"
                    className={inputClass}
                  />
                </Field>
                <Field label="Próximo cobro">
                  <input
                    type="date"
                    required={Boolean(optionalNumber(feeAmount))}
                    value={feeDate}
                    onChange={(e) => setFeeDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <p className="text-xs text-ink-muted">
                {optionalNumber(feeAmount) && feeDate
                  ? `Se registrará automáticamente un gasto de ${formatCurrency(optionalNumber(feeAmount)!)} en esta tarjeta el día ${Number(feeDate.slice(8, 10))} de cada mes, desde el ${formatDate(feeDate)}.`
                  : 'Se registra sola como gasto en la tarjeta cada mes, en la fecha de cobro. Déjala vacía si tu tarjeta no cobra cuota de manejo.'}
                {feeDate && feeDate < todayISO() && ' Como la fecha ya pasó, también se registran los cobros desde esa fecha.'}
              </p>
            </fieldset>
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
