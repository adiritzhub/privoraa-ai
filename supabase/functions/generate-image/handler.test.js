import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGenerationHandler } from './handler.js'

const requestId = '33333333-3333-4333-8333-333333333333'
const userId = '11111111-1111-4111-8111-111111111111'

function createClient({ user = { id: userId }, profile = { role: 'user', permission_state: 'normal' }, enabled = true, request = { id: requestId, user_id: userId, prompt: 'A safe classroom diagram', classification: 'allowed', request_state: 'eligible' } } = {}) {
  return {
    auth: { async getUser() { return { data: { user }, error: null } } },
    from(table) {
      const values = { profiles: profile, app_settings: { global_generation_enabled: enabled }, generation_requests: request }
      const builder = {
        select() { return builder },
        eq() { return builder },
        async maybeSingle() { return { data: values[table], error: null } },
      }
      return builder
    },
  }
}

function createRequest(body) {
  return new Request('https://edge.test/generate', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
}

async function read(response) {
  return response.json()
}

test('anonymous invocation is rejected before provider access', async () => {
  let called = false
  const handler = createGenerationHandler({ client: createClient({ user: null }), provider: { async generateImage() { called = true } } })
  const result = await read(await handler(createRequest({ requestId })))
  assert.equal(result.errorCode, 'unauthenticated')
  assert.equal(called, false)
})

test('suspended users cannot reach the provider', async () => {
  let called = false
  const handler = createGenerationHandler({ client: createClient({ profile: { role: 'user', permission_state: 'suspended' } }), provider: { async generateImage() { called = true } } })
  const result = await read(await handler(createRequest({ requestId })))
  assert.equal(result.errorCode, 'permission_denied')
  assert.equal(called, false)
})

test('prohibited and restricted policy results cannot reach the provider', async () => {
  for (const request of [
    { id: requestId, user_id: userId, prompt: 'blocked', classification: 'prohibited', request_state: 'blocked' },
    { id: requestId, user_id: userId, prompt: 'review', classification: 'restricted', request_state: 'pending_approval' },
  ]) {
    let called = false
    const handler = createGenerationHandler({ client: createClient({ request }), provider: { async generateImage() { called = true } } })
    const result = await read(await handler(createRequest({ requestId })))
    assert.equal(result.errorCode, request.classification === 'prohibited' ? 'policy_blocked' : 'approval_required')
    assert.equal(called, false)
  }
})

test('allowed generation uses trusted request data and ignores browser provider/model choices', async () => {
  let input
  const handler = createGenerationHandler({
    client: createClient(),
    provider: { async generateImage(nextInput) { input = nextInput; return { success: true, providerRequestId: 'hf-1', outputReference: 'data:image/png;base64,AA==', safeMetadata: { contentType: 'image/png' } } } },
  })
  const result = await read(await handler(createRequest({ requestId, provider: 'other', model: 'other-model', prompt: 'browser-controlled prompt' })))
  assert.equal(result.success, true)
  assert.deepEqual(input, { prompt: 'A safe classroom diagram', width: 512, height: 512, userId, requestId })
  assert.equal('provider' in input, false)
  assert.equal('model' in input, false)
})

test('request ownership is enforced before provider access', async () => {
  let called = false
  const handler = createGenerationHandler({ client: createClient({ request: { id: requestId, user_id: '22222222-2222-4222-8222-222222222222', prompt: 'private', classification: 'allowed', request_state: 'eligible' } }), provider: { async generateImage() { called = true } } })
  const result = await read(await handler(createRequest({ requestId })))
  assert.equal(result.errorCode, 'permission_denied')
  assert.equal(called, false)
})
