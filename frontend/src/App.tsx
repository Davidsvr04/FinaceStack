import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { AccountsPage } from './pages/AccountsPage'
import { AdminPage } from './pages/AdminPage'
import { CardsPage } from './pages/CardsPage'
import { DashboardPage } from './pages/DashboardPage'
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
              <Route path="movimientos" element={<TransactionsPage />} />
              <Route path="cuentas" element={<AccountsPage />} />
              <Route path="ahorros" element={<SavingsPage />} />
              <Route path="tarjetas" element={<CardsPage />} />

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
