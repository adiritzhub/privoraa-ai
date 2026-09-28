import { useState } from 'react'
import { AppStateContext } from './appState.js'
import { prototypeApprovals, prototypeCategories, prototypeUsers } from '../data/prototypeData.js'
import { useAuth } from '../hooks/useAuth.js'

function createInitialSettings() {
  return {
    generationEnabled: false,
    dailyLimit: 20,
    categories: prototypeCategories.map((name) => ({ name, enabled: true })),
  }
}

export function AppStateProvider({ children }) {
  const { user } = useAuth()
  return <SessionAppState key={user?.id ?? 'signed-out'}>{children}</SessionAppState>
}

function SessionAppState({ children }) {
  const [approvals, setApprovals] = useState(prototypeApprovals)
  const [users, setUsers] = useState(prototypeUsers)
  const [settings, setSettings] = useState(createInitialSettings)

  function reviewApproval(id, status) {
    if (!['approved', 'rejected'].includes(status)) return
    setApprovals((current) => current.map((item) => (
      item.id === id && !(status === 'approved' && item.classification === 'prohibited')
        ? { ...item, status }
        : item
    )))
  }

  function updateUserRole(id, role) {
    if (!['user', 'founder'].includes(role)) return
    setUsers((current) => current.map((user) => (
      user.id === id ? { ...user, role } : user
    )))
  }

  function updateUserPermissionState(id, permissionState) {
    if (!['normal', 'restricted', 'suspended'].includes(permissionState)) return
    setUsers((current) => current.map((user) => (
      user.id === id
        ? { ...user, permissionState }
        : user
    )))
  }

  function toggleCategory(name) {
    setSettings((current) => ({
      ...current,
      categories: current.categories.map((category) => (
        category.name === name ? { ...category, enabled: !category.enabled } : category
      )),
    }))
  }

  return (
    <AppStateContext.Provider value={{
      approvals,
      users,
      settings,
      reviewApproval,
      updateUserRole,
      updateUserPermissionState,
      setSettings,
      toggleCategory,
    }}>
      {children}
    </AppStateContext.Provider>
  )
}