import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGenerationRequestService } from './generationRequestService.js'

const validCategoryId = '123e4567-e89b-42d3-a456-426614174000'
const idempotencyKey = '423e4567-e89b-42d3-a456-426614174000'
const user = { id: '11111111-1111-4111-8111-111111111111' }

function createClient({
  authUser = user,
  authError = null,
  profile = { role: 'user', permission_state: 'normal' },
  profileError = null,
  generationEnabled = true,
  settingsError = null,
  category = { id: validCategoryId, enabled: true },
  categoryError = null,
  categories = [{ id: validCategoryId, name: 'Learning illustration', enabled: true }],
  history = [],
  rpcData = '22222222-2222-4222-8222-222222222222',
  rpcError = null,
  request = { classification: 'allowed', request_state: 'eligible' },
  requestError = null,
  functions = null,
} = {}) {
  const calls = { rpc: [], selects: [], functions: [] }
  return {
    calls,
    client: {
      auth: {
        async getUser() {
          return { data: { user: authUser }, error: authError }
        },
      },
      from(table) {
        let filters = {}
        const query = { table, filters: [], orderBy: null, rowLimit: null }
        calls.selects.push(query)
        const builder = {
          select(columns) { query.columns = columns; return builder },
          eq(field, value) { filters[field] = value; query.filters.push([field, value]); return builder },
          order(field, options) { query.orderBy = [field, options]; return builder },
          limit(value) { query.rowLimit = value; return builder },
          async maybeSingle() {
            if (table === 'profiles') return { data: profile, error: profileError }
            if (table === 'app_settings') return {
              data: settingsError ? null : { global_generation_enabled: generationEnabled },
              error: settingsError,
            }
            if (table === 'generation_requests') return { data: request, error: requestError }
            if (table === 'categories') return {
              data: categoryError || filters.enabled !== true ? null : category,
              error: categoryError,
            }
            throw new Error('Unexpected table query')
          },
          then(resolve, reject) {
            let data = []
            if (table === 'categories') data = categories.filter((item) => item.enabled !== false && filters.enabled === true)
            if (table === 'generation_requests') data = history.filter((item) => filters.user_id === item.user_id)
            return Promise.resolve({ data, error: table === 'categories' ? categoryError : null }).then(resolve, reject)
          },
        }
        return builder
      },
      async rpc(name, args) {
        calls.rpc.push({ name, args })
        return { data: typeof rpcData === 'function' ? rpcData(name, args) : rpcData, error: rpcError }
      },
      ...(functions ? {
        functions: {
          async invoke(name, options) {
            calls.functions.push({ name, options })
            return functions(name, options)
          },
        },
      } : {}),
    },
  }
}

test('normal and restricted users submit through the trusted RPC without a client user id', async () => {
  for (const permissionState of ['normal', 'restricted']) {
    const fake = createClient({ profile: { role: 'user', permission_state: permissionState } })
    const result = await createGenerationRequestService(fake.client).submit({
      prompt: '  A classroom diagram of a plant cell  ',
      categoryId: validCategoryId,
      idempotencyKey,
      userId: 'client-controlled-user-id',
      classification: 'normal',
    })

    assert.equal(fake.calls.rpc.length, 1)
    assert.equal(fake.calls.rpc[0].name, 'submit_generation_request_idempotent')
    assert.deepEqual(fake.calls.rpc[0].args, {
      p_idempotency_key: idempotencyKey,
      p_category_id: validCategoryId,
      p_prompt: 'A classroom diagram of a plant cell',
    })
    assert.equal(result.classification, 'allowed')
    assert.equal(result.state, 'eligible')
    assert.equal(result.requestId, '22222222-2222-4222-8222-222222222222')
    assert.match(result.message, /request can proceed to generation/)
  }
})

test('category discovery returns only enabled database categories', async () => {
  const fake = createClient({ categories: [
    { id: validCategoryId, name: 'Learning illustration', enabled: true },
    { id: '423e4567-e89b-42d3-a456-426614174000', name: 'Disabled', enabled: false },
  ] })

  const categories = await createGenerationRequestService(fake.client).listAvailableCategories()
  assert.deepEqual(categories, [{ id: validCategoryId, name: 'Learning illustration', enabled: true }])
  assert.deepEqual(fake.calls.selects.at(-1).filters, [['enabled', true]])
})

test('history query derives its owner filter from Supabase auth identity', async () => {
  const fake = createClient({ history: [{ id: 'request-1', user_id: user.id, request_state: 'blocked' }] })
  const history = await createGenerationRequestService(fake.client).listMyHistory({ userId: 'attacker-chosen-id' })

  assert.equal(history.length, 1)
  assert.deepEqual(fake.calls.selects.at(-1).filters, [['user_id', user.id]])
  assert.equal(fake.calls.selects.at(-1).rowLimit, 50)
})

test('generation invokes the protected endpoint and returns only an authorized signed image URL', async () => {
  const signedUrl = 'https://storage.test/private-result?token=short-lived'
  const fake = createClient({
    functions: async (name) => name === 'generate-image'
      ? { data: { success: true, status: 'completed', imageUrl: signedUrl }, error: null }
      : { data: { success: true, imageUrl: signedUrl }, error: null },
  })
  const result = await createGenerationRequestService(fake.client).submit({ prompt: 'A classroom diagram', categoryId: validCategoryId })

  assert.equal(result.outputReference, signedUrl)
  assert.equal(result.status, 'completed')
  assert.equal(result.message, 'Image generated and stored successfully.')
  assert.deepEqual(fake.calls.functions, [{ name: 'generate-image', options: { body: { requestId: '22222222-2222-4222-8222-222222222222' } } }])
  assert.equal(JSON.stringify(fake.calls.functions).includes('userId'), false)
})

test('resolved Edge Function invocation errors become sanitized visible failures', async () => {
  const fake = createClient({
    functions: async () => ({ data: null, error: new Error('private project key and stack details') }),
  })
  const result = await createGenerationRequestService(fake.client).submit({
    prompt: 'A classroom diagram',
    categoryId: validCategoryId,
    idempotencyKey,
  })

  assert.equal(result.classification, 'allowed')
  assert.equal(result.status, 'failed')
  assert.equal(result.errorCode, 'provider_unavailable')
  assert.equal(result.message, 'Image generation is temporarily unavailable. Please try again later.')
  assert.doesNotMatch(result.message, /private project key|stack details/)
})

test('retries reuse a caller-held submission key instead of creating a fresh quota reservation', async () => {
  const fake = createClient()
  const service = createGenerationRequestService(fake.client)
  const input = { prompt: 'A classroom diagram', categoryId: validCategoryId, idempotencyKey }
  await service.submit(input)
  await service.submit(input)

  assert.equal(fake.calls.rpc.length, 2)
  assert.equal(fake.calls.rpc[0].name, 'submit_generation_request_idempotent')
  assert.equal(fake.calls.rpc[1].args.p_idempotency_key, fake.calls.rpc[0].args.p_idempotency_key)
  assert.equal(fake.calls.rpc[1].args.p_prompt, fake.calls.rpc[0].args.p_prompt)
})

test('refresh recovery loads the persisted same-user key and retry resolves the original request', async () => {
  const latest = {
    requestId: '22222222-2222-4222-8222-222222222222',
    idempotencyKey,
    prompt: 'A classroom diagram',
    categoryId: validCategoryId,
    classification: 'allowed',
    requestState: 'eligible',
  }
  const fake = createClient({
    rpcData: (name) => name === 'get_latest_generation_submission' ? latest : latest.requestId,
  })
  const service = createGenerationRequestService(fake.client)
  const recovered = await service.getLatestGenerationSubmission()
  assert.deepEqual(fake.calls.rpc[0], { name: 'get_latest_generation_submission', args: undefined })

  const retry = await service.submit({
    prompt: recovered.prompt,
    categoryId: recovered.categoryId,
    idempotencyKey: recovered.idempotencyKey,
  })
  assert.equal(retry.requestId, latest.requestId)
  assert.equal(fake.calls.rpc[1].args.p_idempotency_key, latest.idempotencyKey)
})

test('latest submission lookup is authenticated and sends no user-controlled identity', async () => {
  const fake = createClient({ authUser: { id: '22222222-2222-4222-8222-222222222222' }, rpcData: null })
  await createGenerationRequestService(fake.client).getLatestGenerationSubmission()
  assert.deepEqual(fake.calls.rpc[0], { name: 'get_latest_generation_submission', args: undefined })
  assert.notEqual(fake.calls.rpc[0].args?.p_user_id, user.id)
})

test('failed requests remain reusable without invoking provider or reserving a new request', async () => {
  const fake = createClient({
    request: { classification: 'allowed', request_state: 'failed' },
    functions: async () => { throw new Error('provider must not be invoked') },
  })
  const result = await createGenerationRequestService(fake.client).submit({
    prompt: 'A classroom diagram',
    categoryId: validCategoryId,
    idempotencyKey,
  })
  assert.equal(result.status, 'failed')
  assert.equal(fake.calls.functions.length, 0)
  assert.equal(fake.calls.rpc[0].name, 'submit_generation_request_idempotent')
})

test('completed generation can recover a private image using request ID only', async () => {
  const signedUrl = 'https://storage.test/private-result?token=short-lived'
  const fake = createClient({
    functions: async () => ({ data: { success: true, imageUrl: signedUrl }, error: null }),
  })
  const service = createGenerationRequestService(fake.client)
  assert.equal(await service.getGenerationImageUrl('33333333-3333-4333-8333-333333333333'), signedUrl)
  assert.deepEqual(fake.calls.functions[0], {
    name: 'get-generation-image',
    options: { body: { requestId: '33333333-3333-4333-8333-333333333333' } },
  })
  await assert.rejects(service.getGenerationImageUrl('../other-user/image.png'), { code: 'service_unavailable' })
})

test('signed-out requests are rejected without calling the RPC', async () => {
  const fake = createClient({ authUser: null })
  await assert.rejects(createGenerationRequestService(fake.client).submit({ prompt: 'Prompt', categoryId: validCategoryId }), { code: 'unauthenticated' })
  assert.equal(fake.calls.rpc.length, 0)
})

test('suspended, missing, and malformed profiles fail closed', async () => {
  for (const profile of [
    { role: 'user', permission_state: 'suspended' },
    null,
    { role: 'owner', permission_state: 'normal' },
    { role: 'user', permission_state: 'unknown' },
  ]) {
    const fake = createClient({ profile })
    await assert.rejects(createGenerationRequestService(fake.client).submit({ prompt: 'Prompt', categoryId: validCategoryId }), { code: 'permission_denied' })
    assert.equal(fake.calls.rpc.length, 0)
  }
})

test('global generation setting and category availability block before RPC', async () => {
  const disabled = createClient({ generationEnabled: false })
  await assert.rejects(createGenerationRequestService(disabled.client).submit({ prompt: 'Prompt', categoryId: validCategoryId }), { code: 'generation_disabled' })
  assert.equal(disabled.calls.rpc.length, 0)

  const categoryOff = createClient({ category: null })
  await assert.rejects(createGenerationRequestService(categoryOff.client).submit({ prompt: 'Prompt', categoryId: validCategoryId }), { code: 'category_unavailable' })
  assert.equal(categoryOff.calls.rpc.length, 0)
})

test('malformed prompt/category are rejected before contacting Supabase', async () => {
  const fake = createClient()
  const service = createGenerationRequestService(fake.client)

  for (const input of [
    { prompt: ' ', categoryId: validCategoryId },
    { prompt: 'x'.repeat(6001), categoryId: validCategoryId },
    { prompt: 'Prompt', categoryId: 'not-a-uuid' },
  ]) {
    await assert.rejects(service.submit(input), { code: 'invalid_request' })
  }
  assert.equal(fake.calls.selects.length, 0)
  assert.equal(fake.calls.rpc.length, 0)
})

test('quota and database errors become safe structured errors', async () => {
  const quota = createClient({ rpcError: { code: 'P0001', message: 'internal quota detail' } })
  await assert.rejects(createGenerationRequestService(quota.client).submit({ prompt: 'Prompt', categoryId: validCategoryId }), (error) => {
    assert.equal(error.code, 'quota_exceeded')
    assert.doesNotMatch(error.message, /internal quota detail/)
    return true
  })

  const unavailable = createClient({ rpcError: { code: 'XX000', message: 'database internals' } })
  await assert.rejects(createGenerationRequestService(unavailable.client).submit({ prompt: 'Prompt', categoryId: validCategoryId }), (error) => {
    assert.equal(error.code, 'service_unavailable')
    assert.doesNotMatch(error.message, /database internals/)
    return true
  })
})

test('authoritative RPC distinguishes generation and category changes without exposing SQL text', async () => {
  const disabled = createClient({ rpcError: { code: '42501', message: 'Generation is disabled' } })
  await assert.rejects(createGenerationRequestService(disabled.client).submit({ prompt: 'Prompt', categoryId: validCategoryId }), { code: 'generation_disabled' })

  const categoryOff = createClient({ rpcError: { code: '42501', message: 'Category is unavailable' } })
  await assert.rejects(createGenerationRequestService(categoryOff.client).submit({ prompt: 'Prompt', categoryId: validCategoryId }), { code: 'category_unavailable' })

  const privateError = createClient({ rpcError: { code: '42501', message: 'private authorization detail' } })
  await assert.rejects(createGenerationRequestService(privateError.client).submit({ prompt: 'Prompt', categoryId: validCategoryId }), (error) => {
    assert.equal(error.code, 'permission_denied')
    assert.doesNotMatch(error.message, /private authorization detail/)
    return true
  })
})

test('persisted restricted and prohibited classifications control the returned workflow state', async () => {
  const restricted = createClient({ request: { classification: 'restricted', request_state: 'pending_approval' } })
  const restrictedResult = await createGenerationRequestService(restricted.client).submit({ prompt: 'Prompt', categoryId: validCategoryId })
  assert.deepEqual(
    { classification: restrictedResult.classification, state: restrictedResult.state },
    { classification: 'restricted', state: 'pending_approval' },
  )
  assert.match(restrictedResult.message, /Additional review required/)

  const prohibited = createClient({ request: { classification: 'prohibited', request_state: 'blocked' } })
  const prohibitedResult = await createGenerationRequestService(prohibited.client).submit({ prompt: 'Prompt', categoryId: validCategoryId })
  assert.deepEqual(
    { classification: prohibitedResult.classification, state: prohibitedResult.state },
    { classification: 'prohibited', state: 'blocked' },
  )
  assert.equal(prohibitedResult.message, 'Request blocked by policy.')
})

test('policy lookup failure is fail-closed and caller classification is ignored', async () => {
  const fake = createClient({ requestError: { code: 'XX000', message: 'private policy detail' } })
  await assert.rejects(
    createGenerationRequestService(fake.client).submit({
      prompt: 'Prompt',
      categoryId: validCategoryId,
      idempotencyKey,
      classification: 'allowed',
      requestState: 'eligible',
    }),
    (error) => {
      assert.equal(error.code, 'policy_unavailable')
      assert.doesNotMatch(error.message, /private policy detail/)
      return true
    },
  )
  assert.deepEqual(fake.calls.rpc[0].args, {
    p_idempotency_key: idempotencyKey,
    p_category_id: validCategoryId,
    p_prompt: 'Prompt',
  })
})