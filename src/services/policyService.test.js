import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPolicyService } from './policyService.js'

const requestId = '33333333-3333-4333-8333-333333333333'

function createClient({ data, error = null } = {}) {
  const calls = []
  const client = {
    calls,
    from(table) {
      const query = { table, filters: [] }
      calls.push(query)
      const builder = {
        select(columns) { query.columns = columns; return builder },
        eq(field, value) { query.filters.push([field, value]); return builder },
        async maybeSingle() { return { data, error } },
      }
      return builder
    },
  }
  return client
}

test('policy adapter exposes only safe allowed state', async () => {
  const client = createClient({ data: { classification: 'allowed', request_state: 'eligible' } })
  const result = await createPolicyService(client).classifyRequest(requestId)
  assert.deepEqual(result, {
    classification: 'allowed',
    state: 'eligible',
    message: 'Policy approved — generation system not connected yet.',
  })
  assert.deepEqual(client.calls[0].filters, [['id', requestId]])
})

test('policy adapter maps restricted, prohibited, and failed states', async () => {
  for (const [data, expected] of [
    [
      { classification: 'restricted', request_state: 'pending_approval' },
      { classification: 'restricted', state: 'pending_approval', message: 'Additional review required. A Founder must review this request before any future generation step.' },
    ],
    [
      { classification: 'prohibited', request_state: 'blocked' },
      { classification: 'prohibited', state: 'blocked', message: 'Request blocked by policy.' },
    ],
    [
      { classification: null, request_state: 'failed' },
      { classification: null, state: 'failed', message: 'Policy check unavailable — request not processed.' },
    ],
  ]) {
    const result = await createPolicyService(createClient({ data })).classifyRequest(requestId)
    assert.deepEqual(result, expected)
  }
})

test('invalid or unavailable policy rows fail closed without provider details', async () => {
  for (const options of [
    { data: { classification: 'allowed', request_state: 'processing' } },
    { data: null, error: { message: 'private provider response' } },
    { data: null },
  ]) {
    await assert.rejects(createPolicyService(createClient(options)).classifyRequest(requestId), (error) => {
      assert.equal(error.code, 'policy_unavailable')
      assert.equal(error.message, 'Policy check unavailable — request not processed.')
      assert.doesNotMatch(error.message, /private provider response/)
      return true
    })
  }
})
