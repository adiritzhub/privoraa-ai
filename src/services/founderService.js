import { supabase } from '../lib/supabaseClient.js'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const founderMessages = {
  unauthenticated: 'Sign in to continue.',
  access_denied: 'Active Founder access is required for this action.',
  invalid_input: 'Check the requested values and try again.',
  not_found: 'The requested record is not available.',
  service_unavailable: 'Founder services are unavailable. Please try again later.',
}

function createFounderError(code) {
  const error = new Error(founderMessages[code] ?? founderMessages.service_unavailable)
  error.code = code
  error.safe = true
  return error
}

function mapBackendError(error) {
  if (error?.code === '42501') return createFounderError('access_denied')
  if (error?.code === 'P0002') return createFounderError('not_found')
  if (['22023', '23514'].includes(error?.code)) return createFounderError('invalid_input')
  return createFounderError('service_unavailable')
}

export function createFounderService(client = supabase) {
  async function requireActiveFounder() {
    if (!client) throw createFounderError('service_unavailable')

    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError || !authData.user) throw createFounderError('unauthenticated')

    const { data: isFounder, error: founderError } = await client.rpc('is_current_founder')
    if (founderError) throw createFounderError('service_unavailable')
    if (isFounder !== true) throw createFounderError('access_denied')
    return authData.user.id
  }

  async function readRows(query) {
    const { data, error } = await query
    if (error) throw createFounderError('service_unavailable')
    return data ?? []
  }

  return {
    async listUsers() {
      await requireActiveFounder()
      return readRows(client
        .from('profiles')
        .select('id, role, permission_state, created_at, updated_at')
        .order('created_at', { ascending: false }))
    },

    async updateUserAccess({ userId, role, permissionState }) {
      const actorId = await requireActiveFounder()
      if (!uuidPattern.test(userId ?? '') || !['user', 'founder'].includes(role)
        || !['normal', 'restricted', 'suspended'].includes(permissionState)) {
        throw createFounderError('invalid_input')
      }
      if (userId === actorId) throw createFounderError('access_denied')

      const { error } = await client.rpc('set_profile_access', {
        p_target_user_id: userId,
        p_role: role,
        p_permission_state: permissionState,
      })
      if (error) throw mapBackendError(error)
      return { updated: true }
    },

    async getGenerationSettings() {
      await requireActiveFounder()
      const { data, error } = await client
        .from('app_settings')
        .select('singleton_id, global_generation_enabled, daily_generation_limit, updated_at, updated_by')
        .eq('singleton_id', true)
        .maybeSingle()
      if (error) throw createFounderError('service_unavailable')
      if (!data) throw createFounderError('not_found')
      return data
    },

    async updateGenerationSettings({ enabled, dailyLimit }) {
      await requireActiveFounder()
      if (typeof enabled !== 'boolean' || !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 10000) {
        throw createFounderError('invalid_input')
      }

      const { error } = await client.rpc('set_global_generation_settings', {
        p_enabled: enabled,
        p_daily_limit: dailyLimit,
      })
      if (error) throw mapBackendError(error)
      return { updated: true }
    },

    async listCategories() {
      await requireActiveFounder()
      return readRows(client
        .from('categories')
        .select('id, name, enabled, configuration, created_at, updated_at')
        .order('name', { ascending: true }))
    },

    async updateCategory({ categoryId, enabled, configuration = {} }) {
      await requireActiveFounder()
      if (!uuidPattern.test(categoryId ?? '') || typeof enabled !== 'boolean'
        || !configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
        throw createFounderError('invalid_input')
      }

      const { error } = await client.rpc('set_category_controls', {
        p_category_id: categoryId,
        p_enabled: enabled,
        p_configuration: configuration,
      })
      if (error) throw mapBackendError(error)
      return { updated: true }
    },

    async listActivity({ limit = 50 } = {}) {
      await requireActiveFounder()
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw createFounderError('invalid_input')
      return readRows(client
        .from('activity_logs')
        .select('id, actor_id, action, target_type, target_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(limit))
    },

    async listGenerationHistory({ limit = 50 } = {}) {
      await requireActiveFounder()
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw createFounderError('invalid_input')
      return readRows(client
        .from('generation_requests')
        .select('id, user_id, category, classification, request_state, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(limit))
    },
  }
}

export const founderService = createFounderService()