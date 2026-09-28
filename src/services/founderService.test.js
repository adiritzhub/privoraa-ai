import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFounderService } from './founderService.js'

const founderId = '11111111-1111-4111-8111-111111111111'
const targetId = '22222222-2222-4222-8222-222222222222'
const categoryId = '33333333-3333-4333-8333-333333333333'

function createClient({ userId = founderId, isFounder = true, rpcError = null, data = [] } = {}) {
  const calls = { rpc: [], selects: [], dml: [] }
  const client = {
    auth: { async getUser() { return { data: { user: userId ? { id: userId } : null }, error: null } } },
    async rpc(name, args) {
      calls.rpc.push({ name, args })
      if (name === 'is_current_founder') return { data: isFounder, error: null }
      return { data: null, error: rpcError }
    },
    from(table) {
      const query = { table, columns: null, filters: [], ordering: null, rowLimit: null }
      const builder = {
        select(columns) { query.columns = columns; calls.selects.push(query); return builder },
        eq(field, value) { query.filters.push([field, value]); return builder },
        order(field, options) { query.ordering = [field, options]; return builder },
        limit(value) { query.rowLimit = value; return builder },
        update(payload) { calls.dml.push({ type: 'update', payload }); return builder },
        insert(payload) { calls.dml.push({ type: 'insert', payload }); return builder },
        delete() { calls.dml.push({ type: 'delete' }); return builder },
        async maybeSingle() { return { data: data[0] ?? null, error: null } },
        then(resolve, reject) { return Promise.resolve({ data, error: null }).then(resolve, reject) },
      }
      return builder
    },
  }
  return { client, calls }
}

test('unauthenticated and non-Founder callers cannot invoke Founder services', async () => {
  for (const options of [{ userId: null }, { isFounder: false }]) {
    const fake = createClient(options)
    await assert.rejects(createFounderService(fake.client).listUsers(), (error) => {
      assert.equal(error.code, options.userId === null ? 'unauthenticated' : 'access_denied')
      return true
    })
    assert.equal(fake.calls.selects.length, 0)
  }
})

test('user listing is read-only and only exposes intended profile columns', async () => {
  const fake = createClient({ data: [{ id: targetId, role: 'user', permission_state: 'normal' }] })
  const users = await createFounderService(fake.client).listUsers()

  assert.equal(users.length, 1)
  assert.equal(fake.calls.selects[0].table, 'profiles')
  assert.equal(fake.calls.selects[0].columns, 'id, role, permission_state, created_at, updated_at')
  assert.deepEqual(fake.calls.dml, [])
})

test('access changes use the trusted RPC and reject self-promotion/self-unsuspension locally', async () => {
  const fake = createClient()
  const service = createFounderService(fake.client)
  await assert.rejects(service.updateUserAccess({ userId: founderId, role: 'founder', permissionState: 'normal' }), { code: 'access_denied' })
  await assert.rejects(service.updateUserAccess({ userId: targetId, role: 'owner', permissionState: 'normal' }), { code: 'invalid_input' })
  assert.equal(fake.calls.rpc.filter((call) => call.name === 'set_profile_access').length, 0)

  await service.updateUserAccess({ userId: targetId, role: 'user', permissionState: 'suspended' })
  assert.deepEqual(fake.calls.rpc.at(-1), {
    name: 'set_profile_access',
    args: { p_target_user_id: targetId, p_role: 'user', p_permission_state: 'suspended' },
  })
  assert.deepEqual(fake.calls.dml, [])
})

test('generation settings use only the protected Founder RPC', async () => {
  const fake = createClient()
  const service = createFounderService(fake.client)
  await assert.rejects(service.updateGenerationSettings({ enabled: true, dailyLimit: 0 }), { code: 'invalid_input' })
  await service.updateGenerationSettings({ enabled: false, dailyLimit: 25 })

  assert.deepEqual(fake.calls.rpc.at(-1), {
    name: 'set_global_generation_settings',
    args: { p_enabled: false, p_daily_limit: 25 },
  })
  assert.deepEqual(fake.calls.dml, [])
})

test('category mutations use the protected Founder RPC and validate configuration shape', async () => {
  const fake = createClient()
  const service = createFounderService(fake.client)
  await assert.rejects(service.updateCategory({ categoryId, enabled: true, configuration: [] }), { code: 'invalid_input' })
  await service.updateCategory({ categoryId, enabled: false, configuration: { audience: 'classroom' } })

  assert.deepEqual(fake.calls.rpc.at(-1), {
    name: 'set_category_controls',
    args: { p_category_id: categoryId, p_enabled: false, p_configuration: { audience: 'classroom' } },
  })
  assert.deepEqual(fake.calls.dml, [])
})

test('activity and generation history are read-only and bounded', async () => {
  const fake = createClient()
  const service = createFounderService(fake.client)
  await service.listActivity({ limit: 20 })
  await service.listGenerationHistory({ limit: 10 })

  assert.equal(fake.calls.selects[0].table, 'activity_logs')
  assert.equal(fake.calls.selects[0].rowLimit, 20)
  assert.equal(fake.calls.selects[1].table, 'generation_requests')
  assert.equal(fake.calls.selects[1].rowLimit, 10)
  assert.deepEqual(fake.calls.dml, [])
})

test('database denial errors are mapped to safe Founder messages', async () => {
  const fake = createClient({ rpcError: { code: '42501', message: 'private database detail' } })
  await assert.rejects(createFounderService(fake.client).updateGenerationSettings({ enabled: true, dailyLimit: 10 }), (error) => {
    assert.equal(error.code, 'access_denied')
    assert.doesNotMatch(error.message, /private database detail/)
    return true
  })
})