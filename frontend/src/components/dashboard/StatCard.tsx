import {
  ArrowLeftRight,
  CreditCard,
  Landmark,
  PiggyBank,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  hint?: ReactNode
  icon?: LucideIcon
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'brand'
}

function resolveIconAndTheme(label: string, customIcon?: LucideIcon): {
  icon: LucideIcon
  colorClass: string
  bgClass: string
} {
  if (customIcon) {
    return {
      icon: customIcon,
      colorClass: 'text-brand',
      bgClass: 'bg-brand/10 border-brand/20',
    }
  }

  const l = label.toLowerCase()
  if (l.includes('ingreso')) {
    return {
      icon: TrendingUp,
      colorClass: 'text-status-good',
      bgClass: 'bg-status-good/10 border-status-good/20',
    }
  }
  if (l.includes('gasto')) {
    return {
      icon: TrendingDown,
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-500/10 border-amber-500/20',
    }
  }
  if (l.includes('ahorr')) {
    return {
      icon: PiggyBank,
      colorClass: 'text-cyan-600',
      bgClass: 'bg-cyan-500/10 border-cyan-500/20',
    }
  }
  if (l.includes('saldo') || l.includes('disponible')) {
    return {
      icon: Wallet,
      colorClass: 'text-brand',
      bgClass: 'bg-brand/10 border-brand/20',
    }
  }
  if (l.includes('deuda') || l.includes('tarjeta')) {
    return {
      icon: CreditCard,
      colorClass: 'text-rose-600',
      bgClass: 'bg-rose-500/10 border-rose-500/20',
    }
  }
  if (l.includes('patrimonio')) {
    return {
      icon: ShieldCheck,
      colorClass: 'text-indigo-600',
      bgClass: 'bg-indigo-500/10 border-indigo-500/20',
    }
  }
  if (l.includes('usuario')) {
    return {
      icon: Users,
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-500/10 border-purple-500/20',
    }
  }
  if (l.includes('transaccion') || l.includes('volumen') || l.includes('movimiento')) {
    return {
      icon: ArrowLeftRight,
      colorClass: 'text-sky-600',
      bgClass: 'bg-sky-500/10 border-sky-500/20',
    }
  }
  return {
    icon: Landmark,
    colorClass: 'text-brand',
    bgClass: 'bg-brand/10 border-brand/20',
  }
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  const { icon: Icon, colorClass, bgClass } = resolveIconAndTheme(label, icon)

  return (
    <div className="card-hover-effect relative overflow-hidden rounded-2xl border border-hairline bg-surface p-4 sm:p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
          {label}
        </span>
        <div className={`grid size-8 shrink-0 place-items-center rounded-xl border ${bgClass}`}>
          <Icon className={`size-4 ${colorClass}`} aria-hidden />
        </div>
      </div>
      <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
          {hint}
        </div>
      )}
    </div>
  )
}
