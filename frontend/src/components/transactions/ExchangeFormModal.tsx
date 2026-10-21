import { AlertTriangle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useSubmit } from '../../hooks/useSubmit'
import { send } from '../../lib/api'
import { formatCurrency, todayISO } from '../../lib/format'
import type { Account } from '../../types'
import { Button, Field, FormError, inputClass, Modal, ModalActions } from '../ui'

type Mode = 'buy' | 'sell'

interface Props {
  /** Cuentas en pesos (bancos y efectivo). */
  copAccounts: Account[]
  usdAccounts: Account[]
  onClose: () => void
  onSaved: (savedDate: string) => void
}

/**
 * Comprar dólares (sale de una cuenta en pesos, entra a una en dólares) o
 * venderlos. Se escriben los dos montos tal como quedaron en las cuentas y la
 * tasa sale de ahí. No cuenta como ingreso ni como gasto.
 */
export function ExchangeFormModal({ copAccounts, usdAccounts, onClose, onSaved }: Props) {
  const pesos = copAccounts.filter((a) => a.type !== 'credit_card')
  const [mode, setMode] = useState<Mode>('buy')
  const [copId, setCopId] = useState(pesos[0]?.id ?? '')
  const [usdId, setUsdId] = useState(usdAccounts[0]?.id ?? '')
  const [usdAmount, setUsdAmount] = useState('')
  const [copAmount, setCopAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const { run, submitting, error } = useSubmit()

  const isBuy = mode === 'buy'
  const usd = Number(usdAmount) || 0
  const cop = Number(copAmount) || 0
  const rate = usd > 0 && cop > 0 ? cop / usd : null
  const source = isBuy ? pesos.find((a) => a.id === copId) : usdAccounts.find((a) => a.id === usdId)
  const exceeds = source !== undefined && (isBuy ? cop : usd) > Number(source.balance)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      await send('POST', '/transactions/exchange', {
        from_account_id: isBuy ? copId : usdId,
        to_account_id: isBuy ? usdId : copId,
        from_amount: isBuy ? cop : usd,
        to_amount: isBuy ? usd : cop,
        date,
        ...(description.trim() && { description: description.trim() }),
      })
      onSaved(date)
    })
  }

  if (pesos.length === 0 || usdAccounts.length === 0) {
    return (
      <Modal title="Comprar o vender dólares" onClose={onClose}>
        <p className="text-sm text-ink-secondary">
          Necesitas al menos una cuenta en pesos y una en dólares.{' '}
          <Link to={pesos.length === 0 ? '/cuentas' : '/dolares'} className="font-medium text-brand-strong hover:underline">
            Crear cuenta {pesos.length === 0 ? 'en pesos' : 'en dólares'}
          </Link>
        </p>
      </Modal>
    )
  }

  const copSelect = (
    <Field label={isBuy ? 'Desde (pesos)' : 'Hacia (pesos)'}>
      <select required value={copId} onChange={(e) => setCopId(e.target.value)} className={inputClass}>
        {pesos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {formatCurrency(Number(a.balance))}
          </option>
        ))}
      </select>
    </Field>
  )
  const usdSelect = (
    <Field label={isBuy ? 'Hacia (dólares)' : 'Desde (dólares)'}>
      <select required value={usdId} onChange={(e) => setUsdId(e.target.value)} className={inputClass}>
        {usdAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {formatCurrency(Number(a.balance), 'USD')}
          </option>
        ))}
      </select>
    </Field>
  )

  return (
    <Modal title="Comprar o vender dólares" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink/5 p-1" role="radiogroup" aria-label="Operación">
          {(['buy', 'sell'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-secondary'
              }`}
            >
              {value === 'buy' ? 'Comprar dólares' : 'Vender dólares'}
            </button>
          ))}
        </div>

        {isBuy ? (
          <>
            {copSelect}
            {usdSelect}
          </>
        ) : (
          <>
            {usdSelect}
            {copSelect}
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={isBuy ? 'Dólares recibidos' : 'Dólares vendidos'}>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={usdAmount}
              onChange={(e) => setUsdAmount(e.target.value)}
              placeholder="US$"
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label={isBuy ? 'Pesos pagados' : 'Pesos recibidos'}>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={copAmount}
              onChange={(e) => setCopAmount(e.target.value)}
              placeholder="$"
              className={inputClass}
            />
          </Field>
        </div>
        <p className="text-xs text-ink-secondary">
          {rate
            ? `Tasa: ${formatCurrency(rate)} por dólar.`
            : 'Escribe los montos tal como quedaron en tus cuentas (con comisiones incluidas); la tasa se calcula sola.'}
        </p>
        {exceeds && (
          <p className="flex items-start gap-1.5 text-xs text-ink-secondary">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-status-warning" aria-hidden />
            El monto supera el saldo de «{source.name}»; quedará en negativo.
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
            placeholder={isBuy ? 'Compra de dólares' : 'Venta de dólares'}
            className={inputClass}
          />
        </Field>

        <p className="text-xs text-ink-muted">
          Queda en los movimientos de ambas cuentas, pero no cuenta como gasto ni como ingreso.
        </p>

        <FormError message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : isBuy ? 'Registrar compra' : 'Registrar venta'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}
