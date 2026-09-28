import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createConfiguredHuggingFaceProvider, createHuggingFaceAdapter } from './huggingFaceProvider.js'

function imageResponse({ requestId = 'hf-request-1', contentType = 'image/png', bytes = [137, 80, 78, 71] } = {}) {
  return new Response(Uint8Array.from(bytes), {
    status: 200,
    headers: { 'content-type': contentType, 'x-request-id': requestId },
  })
}

test('Hugging Face response normalizes to the provider contract without upstream details', async () => {
  let call
  const provider = createConfiguredHuggingFaceProvider({
    env: { get(name) {
      return {
        AI_IMAGE_PROVIDER: 'huggingface',
        AI_IMAGE_MODEL: 'org/model',
        AI_IMAGE_API_KEY: 'test-placeholder',
      }[name]
    } },
    fetchImpl: async (url, options) => {
      call = { url, options }
      return imageResponse()
    },
  })

  const result = await provider.generateImage({ prompt: 'A textbook water cycle diagram', width: 512, height: 512, userId: 'user-1', requestId: 'request-1' })

  assert.equal(result.success, true)
  assert.equal(result.providerRequestId, 'hf-request-1')
  assert.match(result.outputReference, /^data:image\/png;base64,/)
  assert.deepEqual(result.safeMetadata, { contentType: 'image/png', byteLength: 4 })
  assert.match(call.url, /router\.huggingface\.co\/hf-inference\/models\/org%2Fmodel$/)
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(JSON.parse(call.options.body), { inputs: 'A textbook water cycle diagram' })
  assert.match(call.options.headers.Authorization, /^Bearer /)
})

test('Hugging Face malformed content is rejected', async () => {
  const adapter = createHuggingFaceAdapter({
    fetchImpl: async () => new Response('not an image', { status: 200, headers: { 'content-type': 'text/plain' } }),
  })
  assert.deepEqual(await adapter.generateImage({ prompt: 'x', model: 'model' }), {
    success: false,
    safeErrorCode: 'provider_invalid_output',
  })
})

test('Hugging Face timeout becomes a safe timeout code', async () => {
  const adapter = createHuggingFaceAdapter({
    timeoutMs: 1,
    fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }),
  })
  assert.deepEqual(await adapter.generateImage({ prompt: 'x', model: 'model' }), {
    success: false,
    safeErrorCode: 'provider_timeout',
  })
})

test('Hugging Face upstream failures expose only a safe code', async () => {
  const adapter = createHuggingFaceAdapter({
    fetchImpl: async () => new Response('private upstream error', { status: 401 }),
  })
  assert.deepEqual(await adapter.generateImage({ prompt: 'x', model: 'model' }), {
    success: false,
    safeErrorCode: 'provider_unavailable',
  })
})
