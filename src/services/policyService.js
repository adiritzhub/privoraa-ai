import { supabase } from '../lib/supabaseClient.js'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const policyMessages = {
  allowed: 'Policy approved — generation system not connected yet.',
  restricted: 'Additional review required. A Founder must review this request before any future generation step.',
  prohibited: 'Request blocked by policy.',
  unavailable: 'Policy check unavailable — request not processed.',
}

function createPolicyError() {
  const error = new Error(policyMessages.unavailable)
  error.code = 'policy_unavailable'
  error.safe = true
  return error
}

function mapPolicyRow(row) {
  if (row?.classification === 'allowed' && row.request_state === 'eligible') {
    return { classification: 'allowed', state: 'eligible', message: policyMessages.allowed }
  }
  if (row?.classification === 'restricted' && row.request_state === 'pending_approval') {
    return { classification: 'restricted', state: 'pending_approval', message: policyMessages.restricted }
  }
  if (row?.classification === 'prohibited' && row.request_state === 'blocked') {
    return { classification: 'prohibited', state: 'blocked', message: policyMessages.prohibited }
  }
  if (row?.classification === null && row.request_state === 'failed') {
    return { classification: null, state: 'failed', message: policyMessages.unavailable }
  }
  throw createPolicyError()
}

export function createPolicyService(client = supabase) {
  return {
    async classifyRequest(requestId) {
      if (!client || typeof requestId !== 'string' || !uuidPattern.test(requestId)) {
        throw createPolicyError()
      }

      const { data, error } = await client
        .from('generation_requests')
        .select('classification, request_state')
        .eq('id', requestId)
        .maybeSingle()

      if (error || !data) throw createPolicyError()
      return mapPolicyRow(data)
    },
  }
}

export const policyService = createPolicyService()