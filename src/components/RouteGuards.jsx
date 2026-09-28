import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { canAccessFounderArea, canAccessWorkspace } from '../auth/routeAccess.js'

export function RequireAuthenticated() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

export function RequireWorkspaceAccess() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (!canAccessWorkspace(user)) {
    const reason = user.permissionState === 'suspended' ? 'suspended' : 'permission'
    return <Navigate to="/access-denied" replace state={{ reason }} />
  }
  return <Outlet />
}

export function RequireFounder() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (!canAccessFounderArea(user)) {
    const reason = user.permissionState === 'suspended'
      ? 'suspended'
      : user.role === 'founder' && user.permissionState === 'restricted'
        ? 'restricted'
        : 'founder'
    return <Navigate to="/access-denied" replace state={{ reason }} />
  }
  return <Outlet />
}