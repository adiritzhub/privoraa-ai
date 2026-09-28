import { useState } from 'react'
import { AppStateContext } from './appState.js'
import { prototypeApprovals, prototypeCategories, prototypeUsers } from '../data/prototypeData.js'

export function AppStateProvider({ children }) {
  const [approvals, setApprovals] = useState(prototypeApprovals)
  const [users, setUsers] = useState(prototypeUsers)
  const [settings, setSettings] = useState({
    generationEnabled: false,
    dailyLimit: 20,
    categories: prototypeCategories.map((name) => ({ name, enabled: true })),
  })

  function reviewApproval(id, status) {
    setApprovals((current) => current.map((item) => (
      item.id === id ? { ...item, status } : item
    )))
  }

  function updateUserRole(id, role) {
    setUsers((current) => current.map((user) => (
      user.id === id ? { ...user, role } : user
    )))
  }

  function updateUserPermission(id, permission, enabled) {
    setUsers((current) => current.map((user) => (
      user.id === id
        ? { ...user, permissions: { ...user.permissions, [permission]: enabled } }
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
      updateUserPermission,
      setSettings,
      toggleCategory,
    }}>
      {children}
    </AppStateContext.Provider>
  )
}