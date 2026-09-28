const viteEnvironment = import.meta.env ?? {}

function readJwtRole(key) {
  const payload = key.split('.')[1]
  if (!payload || typeof globalThis.atob !== 'function') return null

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return JSON.parse(globalThis.atob(padded)).role ?? null
  } catch {
    return null
  }
}

function isPublicKey(key) {
  if (key.startsWith('sb_secret_')) return false
  if (key.startsWith('sb_publishable_')) return key.length > 'sb_publishable_'.length
  return readJwtRole(key) === 'anon'
}

export function validateSupabaseConfig(environment = viteEnvironment) {
  const rawUrl = environment.VITE_SUPABASE_URL?.trim() ?? ''
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  const missing = []

  if (!rawUrl) missing.push('VITE_SUPABASE_URL')
  if (!publishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY')
  if (missing.length) return { configured: false, status: 'missing', missing }

  let parsedUrl
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return { configured: false, status: 'invalid_url' }
  }

  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname)
  const validProtocol = parsedUrl.protocol === 'https:' || (localHost && parsedUrl.protocol === 'http:')
  const validUrl = validProtocol
    && !parsedUrl.username
    && !parsedUrl.password
    && !parsedUrl.search
    && !parsedUrl.hash
    && parsedUrl.pathname === '/'

  if (!validUrl) return { configured: false, status: 'invalid_url' }
  if (!isPublicKey(publishableKey)) {
    return { configured: false, status: 'invalid_or_unsafe_publishable_key' }
  }

  return {
    configured: true,
    status: 'ready',
    url: parsedUrl.origin,
    publishableKey,
  }
}

export const supabaseConfig = validateSupabaseConfig()