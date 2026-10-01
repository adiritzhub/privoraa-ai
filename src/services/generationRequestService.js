import { supabase } from '../lib/supabaseClient.js'
import { createPolicyService } from './policyService.js'

const categoryIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const requestIdPattern = categoryIdPattern

const requestMessages = {
  invalid_request: 'Check the prompt and category, then try again.',
  unauthenticated: 'Sign in to submit an image request.',
  permission_denied: 'This account is not allowed to submit image requests.',
  generation_disabled: 'Image requests are temporarily disabled.',
  category_unavailable: 'That image category is not currently available.',
  quota_exceeded: 'You have reached the daily image request limit.',
  service_unavailable: 'The request service is unavailable. Please try again later.',
  policy_unavailable: 'Policy check unavailable — request not processed.',
}

function createRequestError(code) {
  const error = new Error(requestMessages[code] ?? requestMessages.service_unavailable)
  error.code = code
  error.safe = true
  return error
}

function mapRpcError(error) {
  if (error?.code === 'P0001') return createRequestError('quota_exceeded')
  if (error?.code === 'P0002') return createRequestError('policy_unavailable')
  if (error?.code === '42501') {
    const message = String(error.message ?? '').toLowerCase()
    if (message.includes('generation is disabled')) return createRequestError('generation_disabled')
    if (message.includes('category is unavailable')) return createRequestError('category_unavailable')
    return createRequestError('permission_denied')
  }
  if (['22023', '23514'].includes(error?.code)) return createRequestError('invalid_request')
  return createRequestError('service_unavailable')
}

async function requireActiveUser(client) {
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) throw createRequestError('unauthenticated')

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role, permission_state')
    .eq('id', authData.user.id)
    .maybeSingle()

  const validRole = profile?.role === 'user' || profile?.role === 'founder'
  const validPermissionState = ['normal', 'restricted', 'suspended'].includes(profile?.permission_state)
  if (profileError || !validRole || !validPermissionState || profile.permission_state === 'suspended') {
    throw createRequestError('permission_denied')
  }

  return authData.user.id
}

export function createGenerationRequestService(client = supabase, policy = createPolicyService(client)) {
  async function getLatestGenerationSubmission() {
    if (!client) throw createRequestError('service_unavailable')
    await requireActiveUser(client)

    const { data, error } = await client.rpc('get_latest_generation_submission')
    if (error) throw createRequestError('service_unavailable')
    if (data === null) return null
    if (!data || typeof data !== 'object'
      || !requestIdPattern.test(data.requestId ?? '')
      || !requestIdPattern.test(data.idempotencyKey ?? '')
      || (data.categoryId !== null && !categoryIdPattern.test(data.categoryId ?? ''))
      || typeof data.prompt !== 'string'
      || typeof data.requestState !== 'string') {
      throw createRequestError('service_unavailable')
    }
    return data
  }

  async function getGenerationImageUrl(requestId) {
    if (!client || !requestIdPattern.test(requestId ?? '') || typeof client?.functions?.invoke !== 'function') {
      throw createRequestError('service_unavailable')
    }
    await requireActiveUser(client)

    const { data, error } = await client.functions.invoke('get-generation-image', {
      body: { requestId },
    })
    if (error || data?.success !== true || typeof data.imageUrl !== 'string') {
      throw createRequestError('service_unavailable')
    }
    return data.imageUrl
  }

  async function getGenerationStatus(requestId) {
    if (!client || !requestIdPattern.test(requestId ?? '') || typeof client?.functions?.invoke !== 'function') {
      throw createRequestError('service_unavailable')
    }
    await requireActiveUser(client)

    const { data, error } = await client.functions.invoke('generate-image', {
      body: { requestId, statusOnly: true },
    })
    if (error || data?.success !== true || typeof data.status !== 'string') {
      throw createRequestError('service_unavailable')
    }
    return { status: data.status, message: data.message ?? 'Generation request status recovered.' }
  }

  return {
    getLatestGenerationSubmission,
    async listAvailableCategories() {
      if (!client) throw createRequestError('service_unavailable')
      await requireActiveUser(client)

      const { data, error } = await client
        .from('categories')
        .select('id, name')
        .eq('enabled', true)
        .order('name', { ascending: true })

      if (error) throw createRequestError('service_unavailable')
      return data ?? []
    },

    async listMyHistory({ limit = 50 } = {}) {
      if (!client) throw createRequestError('service_unavailable')
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw createRequestError('invalid_request')
      const userId = await requireActiveUser(client)

      const { data, error } = await client
        .from('generation_requests')
        .select('id, prompt, category, classification, request_state, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw createRequestError('service_unavailable')
      return data ?? []
    },

    getGenerationImageUrl,
    getGenerationStatus,

    async submit({ prompt, categoryId, idempotencyKey }) {
      if (typeof prompt !== 'string' || prompt.trim().length < 1 || prompt.trim().length > 6000) {
        throw createRequestError('invalid_request')
      }
      if (typeof categoryId !== 'string' || !categoryIdPattern.test(categoryId)) {
        throw createRequestError('invalid_request')
      }
      const submissionKey = idempotencyKey ?? globalThis.crypto?.randomUUID?.()
      if (typeof submissionKey !== 'string' || !requestIdPattern.test(submissionKey)) {
        throw createRequestError('invalid_request')
      }
      if (!client) throw createRequestError('service_unavailable')

      await requireActiveUser(client)

      const { data: settings, error: settingsError } = await client
        .from('app_settings')
        .select('global_generation_enabled')
        .eq('singleton_id', true)
        .maybeSingle()

      if (settingsError || !settings) throw createRequestError('service_unavailable')
      if (!settings.global_generation_enabled) throw createRequestError('generation_disabled')

      const { data: category, error: categoryError } = await client
        .from('categories')
        .select('id')
        .eq('id', categoryId)
        .eq('enabled', true)
        .maybeSingle()

      if (categoryError || !category) throw createRequestError('category_unavailable')

      const { data: requestId, error: rpcError } = await client.rpc('submit_generation_request_idempotent', {
        p_idempotency_key: submissionKey,
        p_category_id: categoryId,
        p_prompt: prompt.trim(),
      })

      if (rpcError) throw mapRpcError(rpcError)
      if (typeof requestId !== 'string') throw createRequestError('service_unavailable')

      let policyResult
      try {
        policyResult = await policy.classifyRequest(requestId)
      } catch (error) {
        if (error?.code === 'policy_unavailable') throw error
        throw createRequestError('policy_unavailable')
      }

      const baseResult = { requestId, ...policyResult }
      const canResumeGeneration = (policyResult.classification === 'allowed'
        && ['eligible', 'processing', 'completed'].includes(policyResult.state))
        || (policyResult.classification === 'restricted'
          && ['approved', 'processing', 'completed'].includes(policyResult.state))
      if (!canResumeGeneration) {
        return policyResult.state === 'failed'
          ? { ...baseResult, status: 'failed', errorCode: 'provider_unavailable' }
          : baseResult
      }
      if (typeof client?.functions?.invoke !== 'function') {
        return baseResult
      }

      const invocationFailure = {
        ...baseResult,
        status: 'failed',
        errorCode: 'provider_unavailable',
        message: 'Image generation is temporarily unavailable. Please try again later.',
      }

      try {
        const generationResponse = await client.functions.invoke('generate-image', {
          body: { requestId },
        })
        if (generationResponse?.error) return invocationFailure

        const data = generationResponse?.data ?? generationResponse
        if (data && typeof data === 'object' && data.success === true) {
          let imageUrl = data.imageUrl ?? null
          if (data.status === 'completed' && !imageUrl) {
            try {
              imageUrl = await getGenerationImageUrl(requestId)
            } catch {
              imageUrl = null
            }
          }
          return {
            ...baseResult,
            status: data.status ?? 'completed',
            providerRequestId: data.providerRequestId ?? null,
            outputReference: imageUrl,
            safeMetadata: data.safeMetadata ?? {},
            message: data.message ?? (imageUrl ? 'Image generated and stored successfully.' : baseResult.message),
          }
        }
        if (data && typeof data === 'object' && data.success === false) {
          return {
            ...baseResult,
            status: 'failed',
            errorCode: data.errorCode ?? 'service_unavailable',
            message: data.message ?? baseResult.message,
          }
        }
      } catch {
        return invocationFailure
      }

      return invocationFailure
    },
  }
}

export const generationRequestService = createGenerationRequestService()