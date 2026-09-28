// These checks shape UI navigation only; every backend operation must reauthorize independently.
export function canAccessWorkspace(user) {
  const validRole = user?.role === 'user' || user?.role === 'founder'
  const validPermissionState = ['normal', 'restricted'].includes(user?.permissionState)
  return validRole && validPermissionState
}

export function canAccessFounderArea(user) {
  return canAccessWorkspace(user) && user.role === 'founder' && user.permissionState === 'normal'
}