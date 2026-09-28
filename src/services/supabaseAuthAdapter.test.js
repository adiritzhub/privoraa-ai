import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { canAccessFounderArea, canAccessWorkspace } from '../auth/routeAccess.js'
import { createSupabaseAuthAdapter, normalizeSupabaseAuthError } from './supabaseAuthAdapter.js'

const defaultAuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'learner@example.test',
  user_metadata: { display_name: 'Learner', role: 'founder', permission_state: 'normal' },
}
const defaultSession = { user: defaultAuthUser, expires_at: 1900000000 }

function createFakeClient(options = {}) {
  const calls = { signIn: [], signUp: [], signOut: [], profileReads: [] }
  const profile = { role: 'user', permission_state: 'normal' }
  let authStateListener
  let unsubscribeCount = 0

  const client = {
    auth: {
      async getSession() {
        return { data: { session: options.session === undefined ? defaultSession : options.session }, error: options.sessionError ?? null }
      },
      async getUser() {
        return { data: { user: options.authUser ?? defaultAuthUser }, error: options.getUserError ?? null }
      },
      async signInWithPassword(credentials) {
        calls.signIn.push(credentials)
        if (options.signInError) return { data: { session: null, user: null }, error: options.signInError }
        return { data: { session: options.signInSession ?? defaultSession, user: options.authUser ?? defaultAuthUser }, error: null }
      },
      async signUp(payload) {
        calls.signUp.push(payload)
        return {
          data: options.signUpData ?? { session: defaultSession, user: defaultAuthUser },
          error: options.signUpError ?? null,
        }
      },
      async signOut(scope) {
        calls.signOut.push(scope?.scope ?? 'global')
        if (scope?.scope === 'local') return { error: options.localSignOutError ?? null }
        return { error: options.signOutError ?? null }
      },
      onAuthStateChange(callback) {
        authStateListener = callback
        return { data: { subscription: { unsubscribe() { unsubscribeCount += 1 } } } }
      },
    },
    from(table) {
      assert.equal(table, 'profiles')
      return {
        select(columns) {
          calls.profileReads.push({ table, columns })
          return {
            eq(field, value) {
              calls.profileReads.at(-1).filter = { field, value }
              return {
                async maybeSingle() {
                  return { data: options.profile === undefined ? profile : options.profile, error: options.profileError ?? null }
                },
              }
            },
          }
        },
      }
    },
  }

  return {
    client,
    calls,
    emit(event, session) { authStateListener?.(event, session) },
    get unsubscribeCount() { return unsubscribeCount },
  }
}

const waitForAsyncListener = () => new Promise((resolve) => setTimeout(resolve, 10))

test('registration sends email/password and non-privileged display metadata only', async () => {
  const fake = createFakeClient()
  const adapter = createSupabaseAuthAdapter(fake.client)
  const user = await adapter.register({ email: 'learner@example.test', password: 'test-only-password', name: 'Learner' })

  assert.equal(fake.calls.signUp.length, 1)
  assert.deepEqual(fake.calls.signUp[0], {
    email: 'learner@example.test',
    password: 'test-only-password',
    options: { data: { display_name: 'Learner' } },
  })
  assert.equal('role' in fake.calls.signUp[0].options.data, false)
  assert.equal('permission_state' in fake.calls.signUp[0].options.data, false)
  assert.equal(user.role, 'user')
  assert.equal('password' in user, false)
  assert.equal(JSON.stringify(user).includes('test-only-password'), false)
})

test('registration reports confirmation-required without creating an app session', async () => {
  const fake = createFakeClient({ signUpData: { user: defaultAuthUser, session: null } })
  const adapter = createSupabaseAuthAdapter(fake.client)

  await assert.rejects(adapter.register({ email: defaultAuthUser.email, password: 'test-only-password', name: 'Learner' }), (error) => {
    assert.equal(error.code, 'email_confirmation_required')
    assert.equal(error.safe, true)
    assert.match(error.message, /check your inbox/i)
    return true
  })
})

test('login validates the Supabase user and loads role/state from the trusted profile', async () => {
  const founderProfile = { role: 'founder', permission_state: 'normal' }
  const fake = createFakeClient({ profile: founderProfile })
  const adapter = createSupabaseAuthAdapter(fake.client)
  const user = await adapter.signIn({ email: defaultAuthUser.email, password: 'test-only-password' })

  assert.equal(fake.calls.signIn.length, 1)
  assert.equal(fake.calls.signIn[0].password, 'test-only-password')
  assert.deepEqual(fake.calls.profileReads[0], {
    table: 'profiles',
    columns: 'role, permission_state',
    filter: { field: 'id', value: defaultAuthUser.id },
  })
  assert.equal(user.role, 'founder')
  assert.equal(user.permissionState, 'normal')
  assert.equal(user.sessionExpiresAt, defaultSession.expires_at)
  assert.equal('access_token' in user, false)
  assert.equal('refresh_token' in user, false)
})

test('metadata cannot grant Founder when the trusted profile is unavailable', async () => {
  const fake = createFakeClient({ profile: null })
  const adapter = createSupabaseAuthAdapter(fake.client)
  const user = await adapter.getCurrentUser()

  assert.equal(user.role, null)
  assert.equal(user.permissionState, 'unknown')
  assert.equal(canAccessWorkspace(user), false)
  assert.equal(canAccessFounderArea(user), false)
})

test('session restoration uses getSession, getUser, and the RLS-protected profile query', async () => {
  const fake = createFakeClient()
  const user = await createSupabaseAuthAdapter(fake.client).getCurrentUser()

  assert.equal(user.id, defaultAuthUser.id)
  assert.equal(fake.calls.profileReads.length, 1)
})

test('auth state listener synchronizes sign-in/sign-out and cleans up once', async () => {
  const fake = createFakeClient({ profile: { role: 'user', permission_state: 'restricted' } })
  const adapter = createSupabaseAuthAdapter(fake.client)
  const events = []
  const unsubscribe = adapter.onAuthStateChange((user, error) => events.push({ user, error }))

  fake.emit('SIGNED_IN', defaultSession)
  await waitForAsyncListener()
  assert.equal(events[0].user.permissionState, 'restricted')

  fake.emit('SIGNED_OUT', null)
  assert.equal(events.at(-1).user, null)
  unsubscribe()
  assert.equal(fake.unsubscribeCount, 1)
  fake.emit('TOKEN_REFRESHED', defaultSession)
  await waitForAsyncListener()
  assert.equal(events.length, 2)
})

test('failed profile lookup fails closed without discarding non-privileged identity', async () => {
  const fake = createFakeClient({ profileError: { message: 'private database detail', code: 'XX000' } })
  const user = await createSupabaseAuthAdapter(fake.client).getCurrentUser()

  assert.equal(user.id, defaultAuthUser.id)
  assert.equal(user.role, null)
  assert.equal(user.permissionState, 'unknown')
})

test('invalid credentials and weak passwords map to safe user-facing errors', () => {
  const invalidCredentials = normalizeSupabaseAuthError({ code: 'invalid_credentials', message: 'raw backend detail' })
  const weakPassword = normalizeSupabaseAuthError({ code: 'weak_password', message: 'raw backend detail' })
  const invalidEmail = normalizeSupabaseAuthError({ code: 'invalid_email', message: 'raw backend detail' })
  const duplicateSignup = normalizeSupabaseAuthError({ code: 'user_already_exists', message: 'email-specific response' })

  assert.equal(invalidCredentials.code, 'invalid_credentials')
  assert.doesNotMatch(invalidCredentials.message, /raw backend detail/)
  assert.equal(weakPassword.code, 'weak_password')
  assert.equal(invalidEmail.code, 'invalid_email')
  assert.equal(duplicateSignup.code, 'signup_unavailable')
  assert.doesNotMatch(duplicateSignup.message, /email-specific response|already registered/i)
})

test('logout calls Supabase signOut and falls back to local session clearing on network failure', async () => {
  const fake = createFakeClient({ signOutError: { name: 'AuthRetryableFetchError', message: 'network detail' } })
  await createSupabaseAuthAdapter(fake.client).signOut()

  assert.deepEqual(fake.calls.signOut, ['global', 'local'])
})

test('logout failure is sanitized after both remote and local sign-out fail', async () => {
  const fake = createFakeClient({
    signOutError: { message: 'private auth service detail' },
    localSignOutError: { message: 'private storage detail' },
  })

  await assert.rejects(createSupabaseAuthAdapter(fake.client).signOut(), (error) => {
    assert.equal(error.code, 'logout_failed')
    assert.equal(error.safe, true)
    assert.doesNotMatch(error.message, /private auth service detail|private storage detail/)
    return true
  })
})

test('protected route decisions fail closed for signed-out, unknown, and suspended users', () => {
  assert.equal(canAccessWorkspace(null), false)
  assert.equal(canAccessWorkspace({ role: 'user', permissionState: 'unknown' }), false)
  assert.equal(canAccessWorkspace({ role: 'user', permissionState: 'suspended' }), false)
  assert.equal(canAccessWorkspace({ role: 'user', permissionState: 'normal' }), true)
  assert.equal(canAccessWorkspace({ role: 'user', permissionState: 'restricted' }), true)
  assert.equal(canAccessFounderArea({ role: 'founder', permissionState: 'normal' }), true)
  assert.equal(canAccessFounderArea({ role: 'user', permissionState: 'normal' }), false)
  assert.equal(canAccessFounderArea({ role: 'founder', permissionState: 'restricted' }), false)
})

test('frontend auth code does not write passwords to browser storage or contain secret-key patterns', () => {
  const files = [
    new URL('../context/AuthProvider.jsx', import.meta.url),
    new URL('../pages/AuthPage.jsx', import.meta.url),
    new URL('./supabaseAuthAdapter.js', import.meta.url),
    new URL('../lib/supabaseClient.js', import.meta.url),
  ]
  const sources = files.map((file) => readFileSync(file, 'utf8')).join('\n')

  assert.doesNotMatch(sources, /(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|set)\s*\([^)]*password/i)
  assert.doesNotMatch(sources, /sb_secret_[A-Za-z0-9_-]{12,}/)
  assert.doesNotMatch(sources, /service_role\s*[:=]/i)
})

test('Supabase auth is the provider default and SDK session persistence remains enabled', () => {
  const providerSource = readFileSync(new URL('../context/AuthProvider.jsx', import.meta.url), 'utf8')
  const clientSource = readFileSync(new URL('../lib/supabaseClient.js', import.meta.url), 'utf8')

  assert.match(providerSource, /import\('\.\.\/services\/supabaseAuthAdapter\.js'\)/)
  assert.match(clientSource, /autoRefreshToken:\s*true/)
  assert.match(clientSource, /persistSession:\s*true/)
})
