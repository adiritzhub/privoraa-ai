import { useState } from 'react'
import { AuthContext } from './authContext.js'
import { demoAuthAdapter } from '../services/demoAuthAdapter.js'

export function AuthProvider({ children, adapter = demoAuthAdapter }) {
  const [user, setUser] = useState(null)

  async function signIn(credentials) {
    const nextUser = await adapter.signIn(credentials)
    setUser(nextUser)
    return nextUser
  }

  async function register(details) {
    const nextUser = await adapter.register(details)
    setUser(nextUser)
    return nextUser
  }

  async function startFounderPreview() {
    if (!adapter.startFounderPreview) {
      throw new Error('Founder preview is unavailable for this authentication adapter.')
    }
    const nextUser = await adapter.startFounderPreview()
    setUser(nextUser)
    return nextUser
  }

  async function signOut() {
    try {
      await adapter.signOut()
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      authMode: adapter.mode ?? 'custom',
      signIn,
      register,
      startFounderPreview,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}