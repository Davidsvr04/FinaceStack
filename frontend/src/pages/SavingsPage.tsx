import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Minus,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
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
import { daysUntil, formatCurrency, formatDate, formatPercent, optionalNumber, todayISO } from '../lib/format'
import type { Account, SavingsGoal } from '../types'

type Dialog =
  | { kind: 'goal'; goal?: SavingsGoal }
  | { kind: 'deposit' | 'withdraw'; goal: SavingsGoal }

export function SavingsPage() {
  const { data: goals, error, loading, reload } = useApi<SavingsGoal[]>('/savings-goals')
  const accountsQuery = useApi<Account[]>('/accounts')
  // Los ahorros salen de (o vuelven a) cuentas bancarias o de efectivo.
  const sources = accountsQuery.data?.filter((a) => a.type !== 'credit_card') ?? []
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const del = useSubmit()

  function handleDelete(goal: SavingsGoal) {
    const fromAccounts = Number(goal.current_amount) - Number(goal.initial_amount)
    const warning =
      fromAccounts <= 0 && Number(goal.current_amount) > 0
        ? ` Se descartarán ${formatCurrency(Number(goal.current_amount))} de ahorro previo.`
        : ''
    if (!window.confirm(`¿Eliminar la meta "${goal.name}"?${warning}`)) return
    void del.run(async () => {
      await send('DELETE', `/savings-goals/${goal.id}`)
      reload()
    })
  }

  const close = () => setDialog(null)
  const saved = () => {
    setDialog(null)
    reload()
    accountsQuery.reload()
  }

  const totalSaved = goals?.reduce((s, g) => s + Number(g.current_amount), 0) ?? 0
  const totalTarget = goals?.reduce((s, g) => s + Number(g.target_amount), 0) ?? 0
  const globalProgress = totalTarget > 0 ? totalSaved / totalTarget : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas de Ahorro"
        subtitle="Construye tu fondo de emergencia, viajes y metas futuras con apartados dedicados"
        actions={
          <Button onClick={() => setDialog({ kind: 'goal' })} className="shadow-xs">
            <Plus className="size-4" aria-hidden />
            Nueva meta
          </Button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {del.error && <ErrorBanner message={del.error} />}
      {loading && !goals && (
        <div className="grid h-48 place-items-center">
          <Spinner label="Cargando tus metas de ahorro…" />
        </div>
      )}

      {goals && goals.length === 0 && (
        <EmptyState
          title="No tienes metas de ahorro activas"
          text="Define tu primer objetivo financiero (por ejemplo, vacaciones o fondo para emergencias) y abona dinero cuando quieras."
          action={
            <Button onClick={() => setDialog({ kind: 'goal' })}>
              <Plus className="size-4" />
              Crear mi primera meta
            </Button>
          }
        />
      )}

      {goals && goals.length > 0 && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total ahorrado" value={formatCurrency(totalSaved)} hint="En todas tus metas" />
            <StatCard label="Objetivo acumulado" value={formatCurrency(totalTarget)} hint="Suma total proyectada" />
            <StatCard
              label="Progreso global"
              value={formatPercent(globalProgress)}
              hint={`${goals.filter((g) => Number(g.progress) >= 1).length} de ${goals.length} metas cumplidas`}
            />
          </section>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onDeposit={() => setDialog({ kind: 'deposit', goal })}
                onWithdraw={() => setDialog({ kind: 'withdraw', goal })}
                onEdit={() => setDialog({ kind: 'goal', goal })}
                onDelete={() => handleDelete(goal)}
              />
            ))}
          </div>
        </>
      )}

      {dialog?.kind === 'goal' && <GoalFormModal goal={dialog.goal} onClose={close} onSaved={saved} />}
      {(dialog?.kind === 'deposit' || dialog?.kind === 'withdraw') && (
        <ContributionModal goal={dialog.goal} mode={dialog.kind} accounts={sources} onClose={close} onSaved={saved} />
      )}
    </div>
  )
}

interface GoalCardProps {
  goal: SavingsGoal
  onDeposit: () => void
  onWithdraw: () => void
  onEdit: () => void
  onDelete: () => void
}

function GoalCard({ goal, onDeposit, onWithdraw, onEdit, onDelete }: GoalCardProps) {
  const current = Number(goal.current_amount)
  const target = Number(goal.target_amount)
  const remaining = Math.max(0, target - current)
  const done = remaining === 0
  const days = goal.deadline ? daysUntil(goal.deadline) : null
  const monthsLeft = days !== null && days > 0 ? Math.max(1, Math.ceil(days / 30)) : null
  const perMonth = monthsLeft && !done ? remaining / monthsLeft : null

  return (
    <div className="card-hover-effect flex flex-col justify-between rounded-2xl border border-hairline bg-surface p-5 shadow-xs">
      <div>
        {/* Cabecera de la meta */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`grid size-10 shrink-0 place-items-center rounded-xl border ${done
                ? 'bg-emerald-500/10 text-status-good border-emerald-500/20'
                : 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'
              }`}>
              <PiggyBank className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-ink">{goal.name}</h2>
              {goal.deadline ? (
                <p className="flex items-center gap-1 text-xs text-ink-muted mt-0.5">
                  <Calendar className="size-3" />
                  <span>{formatDate(goal.deadline)}</span>
                  <span>·</span>
                  <span className={days! <= 7 && !done ? 'text-amber-600 font-semibold' : ''}>
                    {days! > 0 ? `faltan ${days} días` : days === 0 ? 'vence hoy' : `venció hace ${-days!} días`}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-ink-muted">Sin fecha límite</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0">
            <IconButton label={`Editar ${goal.name}`} onClick={onEdit} className="hover:text-brand hover:bg-brand/10">
              <Pencil className="size-4" aria-hidden />
            </IconButton>
            <IconButton label={`Eliminar ${goal.name}`} onClick={onDelete} className="hover:text-status-critical hover:bg-status-critical/10">
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
          </div>
        </div>

        {/* Métricas y Progreso */}
        <div className="my-4 rounded-xl bg-slate-50 p-3.5 border border-hairline/60">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-ink-muted block uppercase tracking-wider">Ahorrado</span>
              <span className="text-xl font-extrabold tracking-tight text-ink tabular-nums">
                {formatCurrency(current)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-ink-muted block uppercase tracking-wider">Meta</span>
              <span className="text-sm font-semibold text-ink-secondary tabular-nums">
                {formatCurrency(target)}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <ProgressBar
              value={Number(goal.progress)}
              label={`Progreso de ${goal.name}`}
              color={done ? 'var(--color-status-good)' : 'var(--color-brand)'}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className={`inline-flex items-center gap-1 font-semibold ${done ? 'text-status-good' : 'text-brand'}`}>
              {done ? (
                <>
                  <CheckCircle2 className="size-3.5 text-status-good" aria-hidden />
                  Meta 100% cumplida
                </>
              ) : (
                formatPercent(Number(goal.progress))
              )}
            </span>
            {!done && (
              <span className="text-ink-muted tabular-nums">
                Faltan {formatCurrency(remaining)}
              </span>
            )}
          </div>

          {perMonth !== null && !done && (
            <p className="mt-2 text-[11px] font-medium text-ink-secondary pt-2 border-t border-hairline/60">
              Ahorro sugerido: <span className="font-bold text-ink">{formatCurrency(perMonth)}/mes</span>
            </p>
          )}
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2.5 pt-2">
        <Button onClick={onDeposit} className="flex-1 shadow-xs">
          <Plus className="size-4" aria-hidden />
          Abonar
        </Button>
        <Button variant="secondary" onClick={onWithdraw} disabled={current === 0} className="flex-1">
          <Minus className="size-4" aria-hidden />
          Retirar
        </Button>
      </div>
    </div>
  )
}

function GoalFormModal({ goal, onClose, onSaved }: { goal?: SavingsGoal; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [initial, setInitial] = useState(goal && Number(goal.initial_amount) > 0 ? String(goal.initial_amount) : '')
  const { run, submitting, error } = useSubmit()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const body = {
      name,
      target_amount: Number(target),
      deadline: deadline || null,
      initial_amount: optionalNumber(initial) ?? 0,
    }
    void run(async () => {
      if (goal) await send('PATCH', `/savings-goals/${goal.id}`, body)
      else await send('POST', '/savings-goals', body)
      onSaved()
    })
  }

  return (
    <Modal title={goal ? 'Editar meta de ahorro' : 'Nueva meta de ahorro'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre del objetivo">
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Vacaciones fin de año"
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label="Monto objetivo">
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </Field>
        <Field label="Fecha límite (opcional)">
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
        </Field>
        <Field
          label="Ahorro previo (opcional)"
          hint="Dinero que ya tenías guardado antes de registrarte en la plataforma."
        >
          <input
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </Field>
        <FormError message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar meta'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}

interface ContributionModalProps {
  goal: SavingsGoal
  mode: 'deposit' | 'withdraw'
  accounts: Account[]
  onClose: () => void
  onSaved: () => void
}

function ContributionModal({ goal, mode, accounts, onClose, onSaved }: ContributionModalProps) {
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [date, setDate] = useState(todayISO())
  const { run, submitting, error } = useSubmit()
  const isDeposit = mode === 'deposit'
  const current = Number(goal.current_amount)
  const account = accounts.find((a) => a.id === accountId)
  const exceedsBalance = isDeposit && account !== undefined && Number(amount) > Number(account.balance)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    void run(async () => {
      await send('POST', `/savings-goals/${goal.id}/contributions`, {
        account_id: accountId,
        amount: isDeposit ? value : -value,
        date,
      })
      onSaved()
    })
  }

  const title = `${isDeposit ? 'Abonar a' : 'Retirar de'} "${goal.name}"`

  if (accounts.length === 0) {
    return (
      <Modal title={title} onClose={onClose}>
        <p className="text-sm text-ink-secondary">
          Necesitas una cuenta bancaria o de efectivo {isDeposit ? 'desde la cual ahorrar' : 'a la cual devolver el dinero'}.{' '}
          <Link to="/cuentas" className="font-semibold text-brand hover:underline">
            Crear cuenta
          </Link>
        </p>
      </Modal>
    )
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={isDeposit ? 'Desde la cuenta' : 'Hacia la cuenta'}>
          <select required value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {formatCurrency(Number(a.balance))}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Monto" hint={isDeposit ? undefined : `Disponible en la meta: ${formatCurrency(current)}`}>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            max={isDeposit ? undefined : current}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={inputClass}
            autoFocus
          />
        </Field>
        {exceedsBalance && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
            El monto supera el saldo de la cuenta; quedará en negativo.
          </p>
        )}
        <Field label="Fecha">
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        <p className="text-xs text-ink-muted">
          {isDeposit
            ? 'El dinero se descuenta del saldo de la cuenta y queda apartado en la meta.'
            : 'El dinero sale de la meta y vuelve al saldo de la cuenta disponible.'}
        </p>
        <FormError message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : isDeposit ? 'Abonar a la meta' : 'Retirar fondos'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}
