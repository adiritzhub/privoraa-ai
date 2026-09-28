import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApprovalService } from './approvalService.js'

const reviewerId = '11111111-1111-4111-8111-111111111111'
const ownerId = '22222222-2222-4222-8222-222222222222'
const requestId = '33333333-3333-4333-8333-333333333333'

function createClient({
  userId = reviewerId,
  isFounder = true,
  request = { id: requestId, user_id: ownerId, prompt: 'Private classroom illustration', category: 'Learning illustration', classification: 'restricted', request_state: 'pending', created_at: '2026-09-28T12:00:00Z' },
  pendingRequests = [request],
  decisionHistory = [],
  rpcError = null,
} = {}) {
  const calls = { rpc: [], queries: [] }
  const client = {
    auth: { async getUser() { return { data: { user: userId ? { id: userId } : null }, error: null } } },
    async rpc(name, args) {
      calls.rpc.push({ name, args })
      if (name === 'is_current_founder') return { data: isFounder, error: null }
      return { data: requestId, error: rpcError }
    },
    from(table) {
      const query = { table, filters: [], columns: null }
      calls.queries.push(query)
      const builder = {
        select(columns) { query.columns = columns; return builder },
        eq(field, value) { query.filters.push([field, value]); return builder },
        in(field, values) { query.filters.push([field, values]); return builder },
        order(field, options) { query.order = [field, options]; return builder },
        async maybeSingle() { return { data: query.table === 'generation_requests' ? request : null, error: null } },
        then(resolve, reject) {
          const data = table === 'generation_requests' ? pendingRequests : decisionHistory
          return Promise.resolve({ data, error: null }).then(resolve, reject)
        },
      }
      return builder
    },
  }
  return { client, calls }
}

test('only a trusted active Founder can list pending restricted approvals', async () => {
  const fake = createClient()
  const service = createApprovalService(fake.client)
  const requests = await service.listPendingApprovals()

  assert.equal(requests.length, 1)
  assert.deepEqual(fake.calls.rpc[0], { name: 'is_current_founder', args: undefined })
  assert.deepEqual(fake.calls.queries[0].filters, [['classification', 'restricted'], ['request_state', ['pending', 'pending_approval']]])
})

test('unauthenticated or non-Founder callers cannot list approvals', async () => {
  for (const options of [{ userId: null }, { isFounder: false }]) {
    const fake = createClient(options)
    await assert.rejects(createApprovalService(fake.client).listPendingApprovals(), (error) => {
      assert.equal(error.code, options.userId === null ? 'unauthenticated' : 'access_denied')
      return true
    })
    assert.equal(fake.calls.queries.length, 0)
  }
})

test('request owners cannot review their own request', async () => {
  const fake = createClient({ userId: ownerId })
  await assert.rejects(createApprovalService(fake.client).review({ requestId, decision: 'approved' }), { code: 'self_review_denied' })
  assert.equal(fake.calls.rpc.filter((call) => call.name === 'record_approval_decision').length, 0)
})

test('Founder can read decision history after a request is no longer pending', async () => {
  const decision = { id: '44444444-4444-4444-8444-444444444444', request_id: requestId, decision: 'approved' }
  const fake = createClient({
    request: { id: requestId, user_id: ownerId, classification: 'restricted', request_state: 'approved' },
    decisionHistory: [decision],
  })

  const history = await createApprovalService(fake.client).listDecisionHistory(requestId)
  assert.deepEqual(history, [decision])
})

test('only pending restricted requests can be reviewed', async () => {
  for (const request of [
    { id: requestId, user_id: ownerId, classification: 'prohibited', request_state: 'blocked' },
    { id: requestId, user_id: ownerId, classification: 'restricted', request_state: 'approved' },
  ]) {
    const fake = createClient({ request })
    await assert.rejects(createApprovalService(fake.client).review({ requestId, decision: 'approved' }), { code: 'invalid_request_state' })
    assert.equal(fake.calls.rpc.filter((call) => call.name === 'record_approval_decision').length, 0)
  }
})

test('review RPC derives reviewer server-side and receives no reviewer id', async () => {
  const fake = createClient()
  const result = await createApprovalService(fake.client).review({ requestId, decision: 'rejected', reason: 'Outside supported classroom category.' })

  assert.equal(result.state, 'rejected')
  assert.deepEqual(fake.calls.rpc.at(-1), {
    name: 'record_approval_decision',
    args: { p_request_id: requestId, p_decision: 'rejected', p_reason: 'Outside supported classroom category.' },
  })
  assert.equal('reviewer_id' in fake.calls.rpc.at(-1).args, false)
})

test('pending approval state remains reviewable while prohibited requests do not', async () => {
  const fake = createClient({
    request: { id: requestId, user_id: ownerId, classification: 'restricted', request_state: 'pending_approval' },
  })
  const result = await createApprovalService(fake.client).review({ requestId, decision: 'approved' })
  assert.equal(result.state, 'approved')

  const prohibited = createClient({
    request: { id: requestId, user_id: ownerId, classification: 'prohibited', request_state: 'blocked' },
  })
  await assert.rejects(createApprovalService(prohibited.client).review({ requestId, decision: 'approved' }), { code: 'invalid_request_state' })
})

test('RPC errors are mapped to safe authorization messages', async () => {
  const fake = createClient({ rpcError: { code: '42501', message: 'sensitive database detail' } })
  await assert.rejects(createApprovalService(fake.client).review({ requestId, decision: 'approved' }), (error) => {
    assert.equal(error.code, 'access_denied')
    assert.doesNotMatch(error.message, /sensitive database detail/)
    return true
  })
})