import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../../context/AuthContext'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard },
  { to: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { to: '/cuentas', label: 'Cuentas', icon: Wallet },
  { to: '/ahorros', label: 'Ahorros', icon: PiggyBank },
  { to: '/tarjetas', label: 'Tarjetas', icon: CreditCard },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
]

/**
 * Layout responsivo: menú lateral fijo en escritorio (md+) y barra de
 * navegación inferior en móvil.
 */
export function AppLayout() {
  const { profile, user, isAdmin, signOut } = useAuth()
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
  const displayName = profile?.full_name || user?.email

  return (
    <div className="min-h-dvh md:flex">
      {/* Menú lateral (escritorio) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-surface md:sticky md:top-0 md:flex md:h-dvh">
        <div className="px-6 py-5 text-lg font-semibold tracking-tight">FinaceStack</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand/10 text-brand-strong' : 'text-ink-secondary hover:bg-ink/5 hover:text-ink'
                }`
              }
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-hairline p-4">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="text-xs text-ink-muted">{isAdmin ? 'Administrador' : 'Usuario'}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 flex items-center gap-2 text-sm text-ink-secondary hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Cabecera (móvil) */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
        <span className="font-semibold tracking-tight">FinaceStack</span>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Cerrar sesión"
          className="rounded-lg p-2 text-ink-secondary hover:bg-ink/5"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 md:px-8 md:py-8">
        <Outlet />
      </main>

      {/* Barra inferior (móvil) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium ${
                isActive ? 'text-brand-strong' : 'text-ink-muted'
              }`
            }
          >
            <item.icon className="size-5" aria-hidden />
            <span className="max-w-full truncate px-0.5">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
