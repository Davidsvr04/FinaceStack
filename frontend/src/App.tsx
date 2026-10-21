import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { AccountsPage } from './pages/AccountsPage'
import { AdminPage } from './pages/AdminPage'
import { CardsPage } from './pages/CardsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DollarsPage } from './pages/DollarsPage'
import { LoginPage } from './pages/LoginPage'
import { SavingsPage } from './pages/SavingsPage'
import { TransactionsPage } from './pages/TransactionsPage'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              {/* key: al pasar de pesos a dólares la página se reinicia (filtros, cuenta). */}
              <Route path="movimientos" element={<TransactionsPage key="COP" />} />
              <Route path="cuentas" element={<AccountsPage />} />
              <Route path="ahorros" element={<SavingsPage />} />
              <Route path="tarjetas" element={<CardsPage />} />
              <Route path="dolares" element={<DollarsPage />} />
              <Route path="dolares/movimientos" element={<TransactionsPage key="USD" currency="USD" />} />

              <Route element={<ProtectedRoute requireAdmin />}>
                <Route path="admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
