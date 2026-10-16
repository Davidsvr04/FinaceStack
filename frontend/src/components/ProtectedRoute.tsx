import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './Spinner'

/** Exige sesión; con requireAdmin además exige rol admin. */
export function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const { session, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />

  return <Outlet />
}
