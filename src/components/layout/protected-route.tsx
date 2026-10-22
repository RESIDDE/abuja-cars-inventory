import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { FullPageLoader } from '@/components/common/full-page-loader'
import { useAuth } from '@/context/auth-context'

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  // While auth is still resolving nothing is decided yet — showing an error or
  // redirecting here is what produces the flash of a wrong screen.
  if (isLoading) return <FullPageLoader label="Checking your session" />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
