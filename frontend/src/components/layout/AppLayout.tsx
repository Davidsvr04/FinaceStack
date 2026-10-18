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

export function AppLayout() {
  const { profile, user, isAdmin, signOut } = useAuth()
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
  const displayName = profile?.full_name || user?.email || 'Usuario'

  // Iniciales para el avatar
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('') || 'U'

  return (
    <div className="min-h-dvh bg-page text-ink md:flex">
      {/* ========================================================= */}
      {/* MENÚ LATERAL (Escritorio md+)                             */}
      {/* ========================================================= */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-hairline bg-surface/95 backdrop-blur-md md:sticky md:top-0 md:flex md:h-dvh shadow-xs">
        {/* Marca y Logotipo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-hairline/60">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-tr from-brand to-cyan-500 text-white shadow-md shadow-brand/20 ring-1 ring-brand/30">
              <Wallet className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-ink">FinaceStack</span>
                <span className="rounded-full bg-brand/10 border border-brand/20 px-1.5 py-0.2 text-[10px] font-bold text-brand-strong">
                  PRO
                </span>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-medium text-ink-muted">
                <span className="size-1.5 rounded-full bg-status-good animate-pulse" />
                Finanzas en vivo
              </span>
            </div>
          </div>
        </div>

        {/* Lista de Navegación */}
        <nav className="flex flex-1 flex-col gap-1.5 p-3 overflow-y-auto">
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            Menú Principal
          </div>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand/10 text-brand-strong font-semibold shadow-xs'
                    : 'text-ink-secondary hover:bg-ink/[0.04] hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-brand" />
                  )}
                  <item.icon
                    className={`size-4.5 transition-colors ${
                      isActive ? 'text-brand' : 'text-ink-muted group-hover:text-ink-secondary'
                    }`}
                    aria-hidden
                  />
                  <span>{item.label}</span>
                  {item.adminOnly && (
                    <span className="ml-auto rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600">
                      Staff
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sección de Usuario y Cierre de Sesión */}
        <div className="border-t border-hairline/80 p-3.5 bg-ink/[0.01]">
          <div className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-ink/[0.03]">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-brand to-cyan-500 font-bold text-white text-xs shadow-xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink leading-tight">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block size-1.5 rounded-full ${isAdmin ? 'bg-purple-500' : 'bg-status-good'}`} />
                <span className="text-[11px] font-medium text-ink-muted">
                  {isAdmin ? 'Administrador' : 'Usuario'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-hairline/80 px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-status-critical/5 hover:border-status-critical/20 hover:text-status-critical transition-all"
          >
            <LogOut className="size-3.5" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* CABECERA (Móvil)                                          */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-hairline bg-surface/90 px-4 py-3 backdrop-blur-md md:hidden shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-tr from-brand to-cyan-500 text-white shadow-xs">
            <Wallet className="size-4" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-ink leading-none">FinaceStack</span>
            <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 py-0.2 text-[9px] font-bold text-brand-strong">
              PRO
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-brand/10 font-bold text-brand text-xs">
            {initials}
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Cerrar sesión"
            className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-status-critical/10 hover:text-status-critical transition-colors"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* CONTENIDO PRINCIPAL                                       */}
      {/* ========================================================= */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 md:px-8 md:py-8 transition-all">
        <Outlet />
      </main>

      {/* ========================================================= */}
      {/* BARRA INFERIOR DE NAVEGACIÓN (Móvil)                      */}
      {/* ========================================================= */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-hairline bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden shadow-lg">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-brand font-semibold' : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 h-0.5 w-6 rounded-full bg-brand" />
                )}
                <item.icon className={`size-5 transition-transform ${isActive ? 'scale-110' : ''}`} aria-hidden />
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
