import { useSubmit } from '../../hooks/useSubmit'
import { send } from '../../lib/api'
import { formatCurrency, formatLongDate } from '../../lib/format'
import type { Transaction } from '../../types'
import { Button, FormError, Modal, ModalActions } from '../ui'
import { describeMovement } from './transfer'

interface Props {
  transaction: Transaction
  onClose: () => void
  onDeleted: () => void
}

/**
 * Las transferencias (pago a tarjeta, ahorro) no se editan: se consultan o se
 * eliminan completas, y los saldos se reponen solos.
 */
export function TransferDetailModal({ transaction: tx, onClose, onDeleted }: Props) {
  const { title, detail, tag } = describeMovement(tx)
  const { run, submitting, error } = useSubmit()
  const isSavings = Boolean(tx.savings_goal_id)

  function handleDelete() {
    const consequence = isSavings
      ? tx.type === 'expense'
        ? 'El dinero volverá a la cuenta y se descontará de la meta.'
        : 'El dinero volverá a la meta y se descontará de la cuenta.'
      : 'Se revertirá en ambas cuentas.'
    if (!window.confirm(`¿Eliminar este movimiento? ${consequence}`)) return
    void run(async () => {
      await send('DELETE', `/transactions/${tx.id}`)
      onDeleted()
    })
  }

  return (
    <Modal title={tag ?? 'Transferencia'} onClose={onClose}>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs text-ink-muted">Concepto</dt>
          <dd className="font-medium">{title}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Movimiento</dt>
          <dd className="font-medium">{detail}</dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-ink-muted">Monto</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(Number(tx.amount))}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Fecha</dt>
            <dd className="font-medium first-letter:uppercase">{formatLongDate(tx.date)}</dd>
          </div>
        </div>
      </dl>
      <p className="mt-4 text-xs text-ink-muted">
        {isSavings
          ? 'Mover dinero a una meta de ahorro descuenta del saldo de la cuenta, pero no cuenta como gasto.'
          : 'Un pago a tarjeta mueve dinero entre tus cuentas: no cuenta como gasto ni como ingreso.'}{' '}
        Para corregirlo, elimínalo y regístralo de nuevo.
      </p>
      <FormError message={error} />
      <ModalActions>
        <Button variant="danger" onClick={handleDelete} disabled={submitting} className="mr-auto">
          Eliminar
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </ModalActions>
    </Modal>
  )
}
