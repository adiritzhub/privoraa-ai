import { supabase } from '../lib/supabaseClient.js'
import { supabaseConfig } from '../lib/supabaseConfig.js'

const authErrorMessages = {
  invalid_credentials: 'Email or password is incorrect.',
  invalid_email: 'Enter a valid email address.',
  weak_password: 'Choose a stronger password and try again.',
  signup_unavailable: 'We could not create an account with those details. Try logging in instead.',
  email_confirmation_required: 'If this email can be registered, check your inbox for a confirmation link. If you already have an account, log in instead.',
  network_error: 'The authentication service could not be reached. Check your connection and try again.',
  logout_failed: 'We could not securely sign out. Please try again.',
  auth_unavailable: 'Authentication could not be completed. Please try again.',
}

function createSafeAuthError(code) {
  const error = new Error(authErrorMessages[code] ?? authErrorMessages.auth_unavailable)
  error.code = code
  error.safe = true
  return error
}

export function normalizeSupabaseAuthError(error, fallback = 'auth_unavailable') {
  const code = String(error?.code ?? '').toLowerCase()
  const name = String(error?.name ?? '').toLowerCase()
  const message = String(error?.message ?? '').toLowerCase()

  if (code.includes('invalid_credentials') || message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return createSafeAuthError('invalid_credentials')
  }
  if (code.includes('weak_password') || message.includes('weak password') || message.includes('password should be at least')) {
    return createSafeAuthError('weak_password')
  }
  if (code.includes('invalid_email') || message.includes('invalid email')) {
    return createSafeAuthError('invalid_email')
  }
  if (code.includes('user_already_exists') || message.includes('user already registered')) {
    return createSafeAuthError('signup_unavailable')
  }
  if (name.includes('retryablefetch') || name.includes('fetcherror') || message.includes('failed to fetch') || message.includes('network')) {
    return createSafeAuthError('network_error')
  }
  return createSafeAuthError(fallback)
}

function requireClient(client) {
  if (!client) {
    const error = new Error(`Supabase is unavailable (${supabaseConfig.status}). Configure valid public Vite variables before enabling authentication.`)
    error.code = 'supabase_unconfigured'
    error.safe = true
    throw error
  }
  return client
}

function toFrontendUser(authUser, profile, session) {
  if (!authUser) return null

  const validRole = profile?.role === 'user' || profile?.role === 'founder'
  const validPermissionState = ['normal', 'restricted', 'suspended'].includes(profile?.permission_state)

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    displayName: authUser.user_metadata?.display_name ?? authUser.email?.split('@')[0] ?? 'User',
    role: validRole ? profile.role : null,
    permissionState: validPermissionState ? profile.permission_state : 'unknown',
    sessionExpiresAt: Number.isFinite(session?.expires_at) ? session.expires_at : null,
  }
}

async function loadSessionUser(client, session) {
  if (!session?.user) return null

  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw normalizeSupabaseAuthError(userError)
  if (!userData.user) return null

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role, permission_state')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || !profile) return toFrontendUser(userData.user, null, session)
  return toFrontendUser(userData.user, profile, session)
}

async function getCurrentUser(client) {
  if (!client) return null

  const { data, error } = await client.auth.getSession()
  if (error) throw normalizeSupabaseAuthError(error)
  return loadSessionUser(client, data.session)
}

export function createSupabaseAuthAdapter(client = supabase) {
  return {
    mode: 'supabase',
    configuration: supabaseConfig,

    getCurrentUser() {
      return getCurrentUser(client)
    },

    onAuthStateChange(callback) {
      if (!client) return () => {}

      let active = true
      let revision = 0
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        const currentRevision = ++revision
        if (!session) {
          callback(null)
          return
        }

        setTimeout(async () => {
          if (!active || currentRevision !== revision) return
          try {
            callback(await getCurrentUser(client))
          } catch (error) {
            callback(null, normalizeSupabaseAuthError(error))
          }
        }, 0)
      })

      return () => {
        active = false
        revision += 1
        subscription.unsubscribe()
      }
    },

    async signIn({ email, password }) {
      const authClient = requireClient(client)
      const { data, error } = await authClient.auth.signInWithPassword({ email, password })
      if (error) throw normalizeSupabaseAuthError(error)
      if (!data.session || !data.user) throw createSafeAuthError('invalid_credentials')
      return loadSessionUser(authClient, data.session)
    },

    async register({ email, password, name }) {
      const authClient = requireClient(client)
      const { data, error } = await authClient.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      })
      if (error) throw normalizeSupabaseAuthError(error, 'signup_unavailable')
  if (!data.user) throw createSafeAuthError('signup_unavailable')
      if (!data.session) throw createSafeAuthError('email_confirmation_required')
      return loadSessionUser(authClient, data.session)
    },

    async signOut() {
      const authClient = requireClient(client)
      const { error } = await authClient.auth.signOut()
      if (!error) return

      const { error: localSignOutError } = await authClient.auth.signOut({ scope: 'local' })
      if (localSignOutError) throw normalizeSupabaseAuthError(localSignOutError, 'logout_failed')
    },
  }
}

export const supabaseAuthAdapter = createSupabaseAuthAdapter()
