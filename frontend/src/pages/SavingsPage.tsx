import { AlertTriangle, CheckCircle2, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas de ahorro"
        subtitle={goals?.length ? `${formatCurrency(totalSaved)} ahorrados de ${formatCurrency(totalTarget)}` : undefined}
        actions={
          <Button onClick={() => setDialog({ kind: 'goal' })}>
            <Plus className="size-4" aria-hidden />
            Nueva meta
          </Button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}
      {del.error && <ErrorBanner message={del.error} />}
      {loading && !goals && <Spinner />}
      {goals && goals.length === 0 && <EmptyState text="Crea una meta para empezar a ahorrar con un objetivo" />}

      {goals && goals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
  // Cuánto habría que ahorrar por mes para llegar a tiempo.
  const monthsLeft = days !== null && days > 0 ? Math.max(1, Math.ceil(days / 30)) : null
  const perMonth = monthsLeft && !done ? remaining / monthsLeft : null

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{goal.name}</h2>
          {goal.deadline && (
            <p className="text-xs text-ink-muted">
              {formatDate(goal.deadline)} ·{' '}
              {days! > 0 ? `faltan ${days} días` : days === 0 ? 'vence hoy' : `venció hace ${-days!} días`}
            </p>
          )}
        </div>
        <div className="flex shrink-0">
          <IconButton label={`Editar ${goal.name}`} onClick={onEdit}>
            <Pencil className="size-4" aria-hidden />
          </IconButton>
          <IconButton label={`Eliminar ${goal.name}`} onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-xl font-semibold tracking-tight">{formatCurrency(current)}</span>
          <span className="text-sm text-ink-secondary">de {formatCurrency(target)}</span>
        </div>
        <ProgressBar
          value={Number(goal.progress)}
          label={`Progreso de ${goal.name}`}
          color={done ? 'var(--color-status-good)' : undefined}
        />
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-secondary">
          {done ? (
            <>
              <CheckCircle2 className="size-3.5 text-status-good" aria-hidden />
              Meta cumplida
            </>
          ) : (
            <>
              {formatPercent(Number(goal.progress))} · faltan {formatCurrency(remaining)}
              {perMonth !== null && ` · ${formatCurrency(perMonth)}/mes`}
            </>
          )}
        </p>
        {Number(goal.initial_amount) > 0 && (
          <p className="mt-1 text-xs text-ink-muted">
            Incluye {formatCurrency(Number(goal.initial_amount))} de ahorro previo
          </p>
        )}
      </div>

      <div className="mt-auto flex gap-2">
        <Button onClick={onDeposit} className="flex-1">
          <Plus className="size-4" aria-hidden />
          Abonar
        </Button>
        <Button variant="secondary" onClick={onWithdraw} disabled={current === 0} className="flex-1">
          <Minus className="size-4" aria-hidden />
          Retirar
        </Button>
      </div>
    </Card>
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
    <Modal title={goal ? 'Editar meta' : 'Nueva meta de ahorro'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre">
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fondo de emergencia"
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
            className={inputClass}
          />
        </Field>
        <Field label="Fecha límite (opcional)">
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
        </Field>
        <Field
          label="Ahorro previo (opcional)"
          hint="Lo que ya tenías ahorrado antes de usar la app. Suma a la meta sin descontarse de ninguna cuenta ni aparecer en Movimientos. Si ese dinero está incluido en el saldo de una cuenta que registraste, déjalo en 0 y usa «Abonar» desde esa cuenta para no contarlo dos veces."
        >
          <input
            type="number"
            step="0.01"
            min="0"
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
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}

interface ContributionModalProps {
  goal: SavingsGoal
  mode: 'deposit' | 'withdraw'
  /** Cuentas bancarias o de efectivo. */
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
          <Link to="/cuentas" className="font-medium text-brand-strong hover:underline">
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
            className={inputClass}
            autoFocus
          />
        </Field>
        {exceedsBalance && (
          <p className="flex items-start gap-1.5 text-xs text-ink-secondary">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-status-warning" aria-hidden />
            El monto supera el saldo de la cuenta; quedará en negativo.
          </p>
        )}
        <Field label="Fecha">
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        <p className="text-xs text-ink-muted">
          {isDeposit
            ? 'El dinero se descuenta del saldo de la cuenta y queda apartado en la meta. No cuenta como gasto.'
            : 'El dinero sale de la meta y vuelve al saldo de la cuenta. No cuenta como ingreso.'}{' '}
          Quedará registrado en Movimientos.
        </p>
        <FormError message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : isDeposit ? 'Abonar' : 'Retirar'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}
