import { supabase } from '../lib/supabaseClient.js'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const approvalMessages = {
  unauthenticated: 'Sign in with an active Founder account to review requests.',
  not_found: 'This request is no longer available for review.',
  self_review_denied: 'You cannot review a request you submitted.',
  invalid_request_state: 'This request is no longer pending review.',
  invalid_decision: 'Choose approve or reject for this request.',
  access_denied: 'Founder access is required to review requests.',
  service_unavailable: 'The approval service is unavailable. Please try again later.',
}

function createApprovalError(code) {
  const error = new Error(approvalMessages[code] ?? approvalMessages.service_unavailable)
  error.code = code
  error.safe = true
  return error
}

function mapRpcError(error) {
  if (error?.code === '42501') return createApprovalError('access_denied')
  return createApprovalError('service_unavailable')
}

export function createApprovalService(client = supabase) {
  async function requireActiveFounder() {
    if (!client) throw createApprovalError('service_unavailable')

    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError || !authData.user) throw createApprovalError('unauthenticated')

    const { data: isFounder, error: founderError } = await client.rpc('is_current_founder')
    if (founderError) throw createApprovalError('service_unavailable')
    if (isFounder !== true) throw createApprovalError('access_denied')
    return authData.user.id
  }

  async function getPendingRequest(requestId, reviewerId) {
    const { data: request, error } = await client
      .from('generation_requests')
      .select('id, user_id, prompt, category, classification, request_state, created_at')
      .eq('id', requestId)
      .maybeSingle()

    if (error) throw createApprovalError('service_unavailable')
    if (!request) throw createApprovalError('not_found')
    if (request.user_id === reviewerId) throw createApprovalError('self_review_denied')
    if (request.classification !== 'restricted' || request.request_state !== 'pending') {
      throw createApprovalError('invalid_request_state')
    }
    return request
  }

  return {
    async listPendingApprovals() {
      const reviewerId = await requireActiveFounder()
      const { data, error } = await client
        .from('generation_requests')
        .select('id, user_id, prompt, category, classification, request_state, created_at')
        .eq('classification', 'restricted')
        .eq('request_state', 'pending')
        .order('created_at', { ascending: true })

      if (error) throw createApprovalError('service_unavailable')
      return (data ?? []).filter((request) => request.user_id !== reviewerId)
    },

    async getPendingApproval(requestId) {
      if (typeof requestId !== 'string' || !uuidPattern.test(requestId)) {
        throw createApprovalError('not_found')
      }
      const reviewerId = await requireActiveFounder()
      return getPendingRequest(requestId, reviewerId)
    },

    async listDecisionHistory(requestId) {
      if (typeof requestId !== 'string' || !uuidPattern.test(requestId)) {
        throw createApprovalError('not_found')
      }
      await requireActiveFounder()
      const { data: request, error: requestError } = await client
        .from('generation_requests')
        .select('id, classification')
        .eq('id', requestId)
        .maybeSingle()

      if (requestError) throw createApprovalError('service_unavailable')
      if (!request) throw createApprovalError('not_found')
      if (request.classification !== 'restricted') throw createApprovalError('invalid_request_state')

      const { data, error } = await client
        .from('approval_decisions')
        .select('id, request_id, reviewer_id, decision, reason, created_at')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })

      if (error) throw createApprovalError('service_unavailable')
      return data ?? []
    },

    async review({ requestId, decision, reason = null }) {
      if (typeof requestId !== 'string' || !uuidPattern.test(requestId)) {
        throw createApprovalError('not_found')
      }
      if (!['approved', 'rejected'].includes(decision)) throw createApprovalError('invalid_decision')
      if (reason !== null && (typeof reason !== 'string' || reason.length > 2000)) {
        throw createApprovalError('invalid_decision')
      }

      const reviewerId = await requireActiveFounder()
      await getPendingRequest(requestId, reviewerId)

      const { data: decisionId, error } = await client.rpc('record_approval_decision', {
        p_request_id: requestId,
        p_decision: decision,
        p_reason: reason,
      })

      if (error) throw mapRpcError(error)
      if (typeof decisionId !== 'string') throw createApprovalError('service_unavailable')
      return { decisionId, requestId, state: decision }
    },
  }
}

export const approvalService = createApprovalService()