import { useEffect, useState } from 'react'
import { AuthContext } from './authContext.js'
import { supabaseConfig } from '../lib/supabaseConfig.js'

function unavailableAdapterError() {
  const error = new Error('Authentication is unavailable. Please try again later.')
  error.safe = true
  return error
}

export function AuthProvider({ children, adapter: adapterOverride }) {
  const [adapter, setAdapter] = useState(adapterOverride ?? null)
  const [user, setUser] = useState(null)
  const [isInitializing, setIsInitializing] = useState(!adapterOverride || Boolean(adapterOverride.getCurrentUser))
  const [authError, setAuthError] = useState('')
  const adapterLoading = !adapter && !authError

  useEffect(() => {
    if (adapterOverride || adapter) return undefined

    let active = true
    import('../services/supabaseAuthAdapter.js')
      .then(({ supabaseAuthAdapter }) => {
        if (!active) return
        setAdapter(supabaseAuthAdapter)
      })
      .catch(() => {
        if (!active) return
        setAdapter(null)
        setAuthError('Supabase authentication could not be loaded. Please try again later.')
        setIsInitializing(false)
      })

    return () => {
      active = false
    }
  }, [adapter, adapterOverride])

  useEffect(() => {
    if (!adapter) return undefined

    let active = true
    let authEventRevision = 0

    const unsubscribe = adapter.onAuthStateChange?.((nextUser, error) => {
      authEventRevision += 1
      if (active) {
        setUser(nextUser)
        setAuthError(error?.safe ? error.message : '')
        setIsInitializing(false)
      }
    })

    async function restoreSession() {
      const restoreRevision = authEventRevision
      try {
        if (adapter.getCurrentUser) {
          const currentUser = await adapter.getCurrentUser()
          if (active && restoreRevision === authEventRevision) setUser(currentUser)
        }
      } catch (error) {
        if (active && restoreRevision === authEventRevision) {
          setUser(null)
          setAuthError(error?.safe ? error.message : 'The saved session could not be verified. Please sign in again.')
        }
      } finally {
        if (active && restoreRevision === authEventRevision) setIsInitializing(false)
      }
    }

    restoreSession()
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [adapter])

  async function signIn(credentials) {
    if (!adapter) throw unavailableAdapterError()
    const nextUser = await adapter.signIn(credentials)
    setUser(nextUser)
    setAuthError('')
    return nextUser
  }

  async function register(details) {
    if (!adapter) throw unavailableAdapterError()
    const nextUser = await adapter.register(details)
    setUser(nextUser)
    setAuthError('')
    return nextUser
  }

  async function startFounderPreview() {
    if (!adapter) throw unavailableAdapterError()
    if (!adapter.startFounderPreview) {
      throw new Error('Founder preview is unavailable for this authentication adapter.')
    }
    const nextUser = await adapter.startFounderPreview()
    setUser(nextUser)
    setAuthError('')
    return nextUser
  }

  async function signOut() {
    let signOutError
    try {
      if (!adapter) throw unavailableAdapterError()
      await adapter.signOut()
    } catch (error) {
      signOutError = error?.safe
        ? error
        : Object.assign(new Error('We could not securely sign out. Please try again.'), { safe: true })
    } finally {
      setUser(null)
      setAuthError(signOutError?.message ?? '')
    }
    if (signOutError) throw signOutError
  }

  return (
    <AuthContext.Provider value={{
      user,
      session: user ? { userId: user.id, expiresAt: user.sessionExpiresAt ?? null } : null,
      isAuthenticated: Boolean(user),
      authMode: adapter?.mode ?? 'loading',
      supabaseConfiguration: supabaseConfig,
      isInitializing: adapterLoading || isInitializing,
      authError,
      signIn,
      register,
      startFounderPreview,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}