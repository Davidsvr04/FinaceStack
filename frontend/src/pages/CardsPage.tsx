import {
  AlertTriangle,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Clock,
  OctagonAlert,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AccountFormModal } from '../components/accounts/AccountFormModal'
import { StatCard } from '../components/dashboard/StatCard'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'
import {
  Button,
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
import {
  daysUntil,
  formatCurrency,
  formatDate,
  formatPercent,
  nextOccurrence,
  optionalNumber,
  todayISO,
} from '../lib/format'
import type { Account, CreditCard, PayoffSimulation } from '../types'

type Dialog =
  | { kind: 'new' }
  | { kind: 'edit' | 'pay' | 'simulate'; card: CreditCard }

export function CardsPage() {
  const { data: cards, error, loading, reload } = useApi<CreditCard[]>(`/credit-cards?today=${todayISO()}`)
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
        title="Tarjetas de Crédito"
        subtitle="Administra límites, fechas de corte, pagos mínimos y simulador de cuotas"
        actions={
          <Button onClick={() => setDialog({ kind: 'new' })} className="shadow-xs">
            <Plus className="size-4" aria-hidden />
            Nueva tarjeta
          </Button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {del.error && <ErrorBanner message={del.error} />}
      {loading && !cards && (
        <div className="grid h-48 place-items-center">
          <Spinner label="Cargando información de tarjetas…" />
        </div>
      )}

      {cards && cards.length === 0 && (
        <EmptyState
          title="No tienes tarjetas registradas"
          text="Registra tus tarjetas de crédito con su límite, día de corte y pago para tener el control total de tus cuotas y fechas clave."
          action={
            <Button onClick={() => setDialog({ kind: 'new' })}>
              <Plus className="size-4" />
              Registrar mi primera tarjeta
            </Button>
          }
        />
      )}

      {cards && cards.length > 0 && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard label="Deuda total en tarjetas" value={formatCurrency(totalDebt)} hint="Suma total a pagar a la fecha" />
            <StatCard label="Cupo disponible total" value={formatCurrency(totalAvailable)} hint="Capacidad libre entre todas tus tarjetas" />
          </section>

          <div className="grid gap-5 md:grid-cols-2">
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
  badgeClass: string
  icon: LucideIcon
}

function utilizationLevel(ratio: number): UtilizationLevel {
  if (ratio < 0.3) {
    return {
      label: 'Uso saludable',
      color: 'var(--color-status-good)',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
      icon: CheckCircle2,
    }
  }
  if (ratio < 0.7) {
    return {
      label: 'Uso moderado',
      color: 'var(--color-status-warning)',
      badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
      icon: AlertTriangle,
    }
  }
  return {
    label: 'Uso alto',
    color: 'var(--color-status-critical)',
    badgeClass: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
    icon: OctagonAlert,
  }
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

  return (
    <div className="card-hover-effect flex flex-col justify-between rounded-2xl border border-hairline bg-surface p-5 shadow-xs">
      <div>
        {/* Visual de Tarjeta de Crédito Premium */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-md mb-4 ring-1 ring-white/10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-amber-400/20 border border-amber-400/40 grid place-items-center">
                <div className="size-4 rounded-sm border border-amber-300/60" />
              </div>
              <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">Crédito</span>
            </div>
            <div className="flex items-center gap-1">
              <IconButton
                label={`Editar ${card.name}`}
                onClick={onEdit}
                className="text-white/60 hover:text-white hover:bg-white/10 size-7 rounded-lg"
              >
                <Pencil className="size-3.5" aria-hidden />
              </IconButton>
              <IconButton
                label={`Eliminar ${card.name}`}
                onClick={onDelete}
                className="text-white/60 hover:text-rose-400 hover:bg-white/10 size-7 rounded-lg"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </IconButton>
            </div>
          </div>

          <div className="my-4">
            <p className="text-lg font-bold tracking-tight text-white">{card.name}</p>
            <p className="text-[11px] text-slate-400">
              {card.monthly_interest_rate != null
                ? `Interés mensual: ${formatPercent(Number(card.monthly_interest_rate), 2)}`
                : 'Sin tasa de interés registrada'}
            </p>
          </div>

          <div className="flex items-end justify-between border-t border-white/10 pt-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Deuda total</span>
              <span className="text-xl font-extrabold text-white tabular-nums tracking-tight">
                {formatCurrency(card.debt)}
              </span>
            </div>
            {card.credit_limit != null && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Cupo disponible</span>
                <span className="font-semibold text-emerald-400 tabular-nums">
                  {formatCurrency(card.available_credit ?? 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Barra de Utilización del Cupo */}
        {card.credit_limit != null && level && card.utilization !== null && (
          <div className="mb-4 space-y-1.5 rounded-xl bg-slate-50 p-3 border border-hairline/60">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-secondary font-medium">Uso del cupo asignado:</span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${level.badgeClass}`}>
                <level.icon className="size-3" aria-hidden />
                {level.label} ({formatPercent(card.utilization)})
              </span>
            </div>
            <ProgressBar value={card.utilization} color={level.color} label={`Uso del cupo de ${card.name}`} />
            <p className="text-[11px] text-ink-muted text-right">
              Límite total: {formatCurrency(Number(card.credit_limit))}
            </p>
          </div>
        )}

        {/* Facturado y Próximo corte */}
        {card.next_cut_off_date && (
          <dl className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50/80 p-3 text-center border border-hairline/60 mb-3">
            <div>
              <dt className="text-[10px] font-semibold text-ink-muted uppercase">Facturado</dt>
              <dd className="mt-0.5 text-xs font-bold tabular-nums text-ink">{formatCurrency(card.billed)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-ink-muted uppercase">Por facturar</dt>
              <dd className="mt-0.5 text-xs font-bold tabular-nums text-ink">{formatCurrency(card.unbilled)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold text-ink-muted uppercase">Próximo corte</dt>
              <dd className="mt-0.5 text-xs font-bold text-ink">{formatDate(card.next_cut_off_date)}</dd>
            </div>
          </dl>
        )}

        {/* Próximo Pago y Cuota de Manejo */}
        <div className="space-y-2 mb-4">
          <NextPayment card={card} />
          <UpcomingStatements card={card} />

          {card.handling_fee_amount != null && card.handling_fee_day != null && (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted pt-1">
              <Repeat className="size-3.5 text-ink-muted" aria-hidden />
              <span>
                Cuota de manejo: <span className="font-semibold text-ink-secondary">{formatCurrency(Number(card.handling_fee_amount))}</span> el día {card.handling_fee_day} (próximo {formatDate(nextOccurrence(card.handling_fee_day))})
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex gap-2.5 pt-2 border-t border-hairline/60">
        <Button onClick={onPay} disabled={card.debt === 0} className="flex-1 shadow-xs">
          Registrar pago
        </Button>
        <Button variant="secondary" onClick={onSimulate} disabled={card.debt === 0} className="flex-1">
          <Calculator className="size-4" aria-hidden />
          Simular cuotas
        </Button>
      </div>
    </div>
  )
}

/** Próximo pago según el ciclo de facturación. */
function NextPayment({ card }: { card: CreditCard }) {
  const payment = card.next_payment

  if (!payment) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-800">
        <CheckCircle2 className="size-4 text-status-good shrink-0" aria-hidden />
        <span>{card.debt > 0 ? 'Registra el día de pago para ver cuándo pagar' : 'Sin pagos pendientes · Al día'}</span>
      </div>
    )
  }

  const days = daysUntil(payment.date)
  const when = days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`
  const billingCut = card.upcoming_statements[0]?.cut_off_date ?? card.next_cut_off_date

  const view = {
    due: {
      icon: CalendarClock,
      theme: 'bg-amber-500/10 border-amber-500/20 text-amber-900',
      iconColor: 'text-amber-600',
      title: `Pago mínimo antes del ${formatDate(payment.date)}`,
      detail: `${when} · corte del ${card.last_cut_off_date ? formatDate(card.last_cut_off_date) : '—'}`,
    },
    overdue: {
      icon: OctagonAlert,
      theme: 'bg-rose-500/10 border-rose-500/20 text-rose-900',
      iconColor: 'text-rose-600',
      title: `¡Pago vencido el ${formatDate(payment.date)}!`,
      detail: 'El saldo del último corte sigue sin cancelarse por completo',
    },
    estimated: {
      icon: Clock,
      theme: 'bg-slate-100 border-slate-200 text-slate-800',
      iconColor: 'text-slate-500',
      title: `Pago mínimo estimado: ${formatDate(payment.date)}`,
      detail: billingCut ? `${when} · se factura el ${formatDate(billingCut)}` : `${when} · estimado`,
    },
  }[payment.status]

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${view.theme}`}>
      <view.icon className={`mt-0.5 size-4 shrink-0 ${view.iconColor}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold">{view.title}</p>
        <p className="text-[11px] opacity-80">{view.detail}</p>
      </div>
      <p className="text-xs font-bold tabular-nums shrink-0">{formatCurrency(payment.amount)}</p>
    </div>
  )
}

/** Cobros de los próximos cortes (cuotas y deuda repartida). */
function UpcomingStatements({ card }: { card: CreditCard }) {
  const rows = card.upcoming_statements
  if (rows.length === 0 || (rows.length === 1 && card.next_payment?.status === 'estimated')) return null

  return (
    <details className="text-xs rounded-xl border border-hairline/60 bg-slate-50/50 p-2.5">
      <summary className="cursor-pointer font-semibold text-ink-secondary hover:text-ink">
        Próximos cobros proyectados ({rows.length} {rows.length === 1 ? 'corte' : 'cortes'})
      </summary>
      <table className="mt-2 w-full text-xs tabular-nums">
        <thead className="text-ink-muted border-b border-hairline">
          <tr>
            <th className="py-1 text-left font-semibold">Corte</th>
            <th className="py-1 text-left font-semibold">Límite pago</th>
            <th className="py-1 text-right font-semibold">Monto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((row) => (
            <tr key={row.cut_off_date}>
              <td className="py-1">{formatDate(row.cut_off_date)}</td>
              <td className="py-1">{row.payment_date ? formatDate(row.payment_date) : '—'}</td>
              <td className="py-1 text-right font-medium">{formatCurrency(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
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
  const minimum = card.next_payment?.amount ?? card.debt
  const [amount, setAmount] = useState(String(minimum))
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
          <Link to="/cuentas" className="font-semibold text-brand hover:underline">
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
          <div className="flex flex-wrap gap-2" role="group" aria-label="Montos sugeridos">
            {[
              { label: 'Pago mínimo', value: minimum },
              { label: 'Pago total', value: card.debt },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setAmount(String(option.value))}
                aria-pressed={Number(amount) === option.value}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                  Number(amount) === option.value
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-hairline text-ink-secondary hover:bg-ink/[0.05]'
                }`}
              >
                {option.label} · {formatCurrency(option.value)}
              </button>
            ))}
          </div>
          <Field
            label="Monto a pagar"
            hint="Lo que pagues de más que el mínimo adelanta las cuotas de los próximos cortes."
          >
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
            El pago descuenta de la cuenta origen y reduce la deuda sin contar como gasto doble.
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
    <Modal title={`Simular cuotas de ${card.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm font-semibold text-ink">Deuda actual a saldar: {formatCurrency(card.debt)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Abono mensual proyectado">
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              placeholder="0.00"
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label="Tasa mensual (%)">
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
            {submitting ? 'Calculando…' : 'Calcular proyección'}
          </Button>
        </ModalActions>
      </form>

      {result && (
        <div className="mt-5 space-y-4 border-t border-hairline pt-4">
          {result.months === null ? (
            <p className="flex items-start gap-2 text-sm text-status-critical bg-status-critical/5 p-3 rounded-xl border border-status-critical/20">
              <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Con esa cuota no alcanzas a cubrir los intereses: la deuda nunca se saldaría. Prueba con una cuota mayor
                a {formatCurrency(result.debt * result.monthly_interest_rate)}.
              </span>
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-3 gap-2.5 rounded-xl bg-slate-50 p-3 text-center border border-hairline/60">
                <div>
                  <dt className="text-[10px] font-bold text-ink-muted uppercase">Tiempo</dt>
                  <dd className="mt-0.5 text-base font-extrabold text-ink">{result.months} meses</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold text-ink-muted uppercase">Intereses</dt>
                  <dd className="mt-0.5 text-base font-extrabold text-amber-600">{formatCurrency(result.total_interest)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold text-ink-muted uppercase">Total pagado</dt>
                  <dd className="mt-0.5 text-base font-extrabold text-ink">{formatCurrency(result.total_paid)}</dd>
                </div>
              </dl>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-hairline shadow-2xs">
                <table className="w-full text-right text-xs tabular-nums">
                  <thead className="sticky top-0 bg-slate-100 text-ink-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Mes</th>
                      <th className="px-3 py-2 font-semibold">Cuota</th>
                      <th className="px-3 py-2 font-semibold">Interés</th>
                      <th className="px-3 py-2 font-semibold">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline bg-surface">
                    {result.schedule.map((row) => (
                      <tr key={row.month} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 text-left font-medium">{row.month}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.payment)}</td>
                        <td className="px-3 py-1.5 text-amber-600">{formatCurrency(row.interest)}</td>
                        <td className="px-3 py-1.5 font-medium">{formatCurrency(row.balance)}</td>
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
