import { AlertTriangle, Calculator, CheckCircle2, OctagonAlert, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AccountFormModal } from '../components/accounts/AccountFormModal'
import { StatCard } from '../components/dashboard/StatCard'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  FormError,
  IconButton,
  inputClass,
  Modal,
  ModalActions,
  PageHeader,
  ProgressBar,
} from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useSubmit } from '../hooks/useSubmit'
import { send } from '../lib/api'
import { daysUntil, formatCurrency, formatDate, formatPercent, optionalNumber, todayISO } from '../lib/format'
import type { Account, CreditCard, PayoffSimulation } from '../types'

type Dialog =
  | { kind: 'new' }
  | { kind: 'edit' | 'pay' | 'simulate'; card: CreditCard }

export function CardsPage() {
  const { data: cards, error, loading, reload } = useApi<CreditCard[]>('/credit-cards')
  const accountsQuery = useApi<Account[]>('/accounts')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const del = useSubmit()

  const sources = accountsQuery.data?.filter((a) => a.type !== 'credit_card') ?? []

  function handleDelete(card: CreditCard) {
    const ok = window.confirm(`¿Eliminar la tarjeta "${card.name}" y todos sus movimientos?`)
    if (!ok) return
    void del.run(async () => {
      await send('DELETE', `/accounts/${card.id}`)
      reload()
    })
  }

  const close = () => setDialog(null)
  const saved = () => {
    setDialog(null)
    reload()
    accountsQuery.reload()
  }

  const totalDebt = cards?.reduce((s, c) => s + c.debt, 0) ?? 0
  const totalAvailable = cards?.reduce((s, c) => s + (c.available_credit ?? 0), 0) ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarjetas de crédito"
        subtitle="Deudas, cupos y fechas de corte y pago"
        actions={
          <Button onClick={() => setDialog({ kind: 'new' })}>
            <Plus className="size-4" aria-hidden />
            Nueva tarjeta
          </Button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {del.error && <ErrorBanner message={del.error} />}
      {loading && !cards && <Spinner />}
      {cards && cards.length === 0 && <EmptyState text="No tienes tarjetas registradas" />}

      {cards && cards.length > 0 && (
        <>
          <section className="grid grid-cols-2 gap-3">
            <StatCard label="Deuda total" value={formatCurrency(totalDebt)} />
            <StatCard label="Cupo disponible" value={formatCurrency(totalAvailable)} />
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                onPay={() => setDialog({ kind: 'pay', card })}
                onSimulate={() => setDialog({ kind: 'simulate', card })}
                onEdit={() => setDialog({ kind: 'edit', card })}
                onDelete={() => handleDelete(card)}
              />
            ))}
          </div>
        </>
      )}

      {(dialog?.kind === 'new' || dialog?.kind === 'edit') && (
        <AccountFormModal
          account={dialog.kind === 'edit' ? dialog.card : undefined}
          defaultType="credit_card"
          lockType
          onClose={close}
          onSaved={saved}
        />
      )}
      {dialog?.kind === 'pay' && <PaymentModal card={dialog.card} sources={sources} onClose={close} onSaved={saved} />}
      {dialog?.kind === 'simulate' && <SimulationModal card={dialog.card} onClose={close} />}
    </div>
  )
}

interface UtilizationLevel {
  label: string
  color: string
  icon: LucideIcon
}

function utilizationLevel(ratio: number): UtilizationLevel {
  if (ratio < 0.3) return { label: 'Uso saludable', color: 'var(--color-status-good)', icon: CheckCircle2 }
  if (ratio < 0.7) return { label: 'Uso moderado', color: 'var(--color-status-warning)', icon: AlertTriangle }
  return { label: 'Uso alto', color: 'var(--color-status-critical)', icon: OctagonAlert }
}

interface CardTileProps {
  card: CreditCard
  onPay: () => void
  onSimulate: () => void
  onEdit: () => void
  onDelete: () => void
}

function CardTile({ card, onPay, onSimulate, onEdit, onDelete }: CardTileProps) {
  const level = card.utilization === null ? null : utilizationLevel(card.utilization)
  const paymentDays = card.next_payment_date ? daysUntil(card.next_payment_date) : null

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{card.name}</h2>
          <p className="text-xs text-ink-muted">
            {card.monthly_interest_rate != null
              ? `Interés ${formatPercent(Number(card.monthly_interest_rate), 2)} mensual`
              : 'Sin tasa registrada'}
          </p>
        </div>
        <div className="flex shrink-0">
          <IconButton label={`Editar ${card.name}`} onClick={onEdit}>
            <Pencil className="size-4" aria-hidden />
          </IconButton>
          <IconButton label={`Eliminar ${card.name}`} onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      <div>
        <p className="text-sm text-ink-secondary">Deuda</p>
        <p className="text-2xl font-semibold tracking-tight">{formatCurrency(card.debt)}</p>
        {card.credit_limit != null && level && card.utilization !== null && (
          <div className="mt-2 space-y-1.5">
            <ProgressBar value={card.utilization} color={level.color} label={`Uso del cupo de ${card.name}`} />
            <p className="flex items-center gap-1.5 text-xs text-ink-secondary">
              <level.icon className="size-3.5" style={{ color: level.color }} aria-hidden />
              {level.label} · {formatPercent(card.utilization)} de {formatCurrency(Number(card.credit_limit))} ·
              disponible {formatCurrency(card.available_credit ?? 0)}
            </p>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-ink-muted">Próximo corte</dt>
          <dd className="font-medium">{card.next_cut_off_date ? formatDate(card.next_cut_off_date) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Fecha límite de pago</dt>
          <dd className="font-medium">
            {card.next_payment_date ? formatDate(card.next_payment_date) : '—'}
            {paymentDays !== null && (
              <span className="ml-1 text-xs font-normal text-ink-muted">
                ({paymentDays === 0 ? 'hoy' : `en ${paymentDays} días`})
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex gap-2">
        <Button onClick={onPay} disabled={card.debt === 0} className="flex-1">
          Registrar pago
        </Button>
        <Button variant="secondary" onClick={onSimulate} disabled={card.debt === 0} className="flex-1">
          <Calculator className="size-4" aria-hidden />
          Simular
        </Button>
      </div>
    </Card>
  )
}

interface PaymentModalProps {
  card: CreditCard
  sources: Account[]
  onClose: () => void
  onSaved: () => void
}

function PaymentModal({ card, sources, onClose, onSaved }: PaymentModalProps) {
  const [fromId, setFromId] = useState(sources[0]?.id ?? '')
  const [amount, setAmount] = useState(String(card.debt))
  const [date, setDate] = useState(todayISO())
  const { run, submitting, error } = useSubmit()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      await send('POST', `/credit-cards/${card.id}/payments`, {
        from_account_id: fromId,
        amount: Number(amount),
        date,
      })
      onSaved()
    })
  }

  return (
    <Modal title={`Pagar ${card.name}`} onClose={onClose}>
      {sources.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          Necesitas una cuenta bancaria o de efectivo desde la cual pagar.{' '}
          <Link to="/cuentas" className="font-medium text-brand-strong hover:underline">
            Crear cuenta
          </Link>
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Pagar desde">
            <select required value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputClass}>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatCurrency(Number(s.balance))}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Monto" hint={`Deuda actual: ${formatCurrency(card.debt)}`}>
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
          <Field label="Fecha">
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <p className="text-xs text-ink-muted">
            El pago se registra como transferencia: descuenta de la cuenta origen y reduce la deuda, sin contar como
            gasto del mes.
          </p>
          <FormError message={error} />
          <ModalActions>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Registrando…' : 'Registrar pago'}
            </Button>
          </ModalActions>
        </form>
      )}
    </Modal>
  )
}

function SimulationModal({ card, onClose }: { card: CreditCard; onClose: () => void }) {
  const [payment, setPayment] = useState('')
  const [ratePct, setRatePct] = useState(
    card.monthly_interest_rate == null ? '' : String(+(Number(card.monthly_interest_rate) * 100).toFixed(4)),
  )
  const [result, setResult] = useState<PayoffSimulation | null>(null)
  const { run, submitting, error } = useSubmit()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const rate = optionalNumber(ratePct)
    void run(async () => {
      setResult(
        await send<PayoffSimulation>('POST', `/credit-cards/${card.id}/simulate`, {
          monthly_payment: Number(payment),
          ...(rate !== undefined && { monthly_interest_rate: rate / 100 }),
        }),
      )
    })
  }

  return (
    <Modal title={`Simular pago de ${card.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ink-secondary">Deuda actual: {formatCurrency(card.debt)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cuota mensual">
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label="Interés mensual (%)">
            <input
              type="number"
              step="0.0001"
              min={0}
              max={100}
              inputMode="decimal"
              value={ratePct}
              onChange={(e) => setRatePct(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </Field>
        </div>
        <FormError message={error} />
        <ModalActions>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Calculando…' : 'Calcular'}
          </Button>
        </ModalActions>
      </form>

      {result && (
        <div className="mt-5 space-y-4 border-t border-hairline pt-4">
          {result.months === null ? (
            <p className="flex items-start gap-2 text-sm">
              <OctagonAlert className="mt-0.5 size-4 shrink-0 text-status-critical" aria-hidden />
              Con esa cuota no alcanzas a cubrir los intereses: la deuda nunca se saldaría. Prueba con una cuota mayor
              a {formatCurrency(result.debt * result.monthly_interest_rate)}.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-muted">Meses</dt>
                  <dd className="text-lg font-semibold">{result.months}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Intereses</dt>
                  <dd className="text-lg font-semibold">{formatCurrency(result.total_interest)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Total pagado</dt>
                  <dd className="text-lg font-semibold">{formatCurrency(result.total_paid)}</dd>
                </div>
              </dl>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-hairline">
                <table className="w-full text-right text-xs tabular-nums">
                  <thead className="sticky top-0 bg-page text-ink-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Mes</th>
                      <th className="px-3 py-2 font-medium">Cuota</th>
                      <th className="px-3 py-2 font-medium">Interés</th>
                      <th className="px-3 py-2 font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {result.schedule.map((row) => (
                      <tr key={row.month}>
                        <td className="px-3 py-1.5 text-left">{row.month}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.payment)}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.interest)}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
