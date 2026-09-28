// These checks shape UI navigation only; every backend operation must reauthorize independently.
export function canAccessWorkspace(user) {
  return Boolean(user) && ['normal', 'restricted'].includes(user.permissionState)
}

export function canAccessFounderArea(user) {
  return canAccessWorkspace(user) && user.role === 'founder' && user.permissionState === 'normal'
}