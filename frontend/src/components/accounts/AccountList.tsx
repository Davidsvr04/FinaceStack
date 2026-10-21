import { Pencil, Trash2 } from 'lucide-react'
import { formatCurrency } from '../../lib/format'
import { ACCOUNT_TYPES } from '../../lib/labels'
import type { Account } from '../../types'
import { Card, IconButton } from '../ui'

interface AccountListProps {
  title: string
  subtitle?: string
  accounts: Account[]
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}

export function AccountList({ title, subtitle, accounts, onEdit, onDelete }: AccountListProps) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between border-b border-hairline/60 pb-3">
        <div>
          <h2 className="font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      <ul className="divide-y divide-hairline">
        {accounts.map((account) => {
          const { label, icon: Icon } = ACCOUNT_TYPES[account.type]
          const balance = Number(account.balance)
          const isCard = account.type === 'credit_card'

          let iconStyle = 'bg-brand/10 text-brand border-brand/20'
          if (account.type === 'cash') iconStyle = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          if (isCard) iconStyle = 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'

          return (
            <li
              key={account.id}
              className="group -mx-2 flex items-center gap-3.5 rounded-xl px-2 py-3 transition-colors hover:bg-ink/[0.02]"
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${iconStyle} shadow-2xs`}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{account.name}</p>
                <p className="text-xs text-ink-muted">{label}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-ink">
                  {formatCurrency(isCard ? Math.abs(balance) : balance, account.currency)}
                </p>
                {isCard && (
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      balance > 0
                        ? 'bg-status-good/10 text-status-good'
                        : balance < 0
                          ? 'bg-status-critical/10 text-status-critical'
                          : 'bg-slate-100 text-ink-muted'
                    }`}
                  >
                    {balance > 0 ? 'Saldo a favor' : balance < 0 ? 'Deuda' : 'Al día ($0)'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                <IconButton
                  label={`Editar ${account.name}`}
                  onClick={() => onEdit(account)}
                  className="hover:text-brand hover:bg-brand/10"
                >
                  <Pencil className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  label={`Eliminar ${account.name}`}
                  onClick={() => onDelete(account)}
                  className="hover:text-status-critical hover:bg-status-critical/10"
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
