import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createImageProvider, validateProviderConfiguration } from './imageProvider.js'

const env = {
  AI_IMAGE_PROVIDER: 'injected-test-provider',
  AI_IMAGE_MODEL: 'test-model',
  AI_IMAGE_API_KEY: 'placeholder-only',
}

test('provider configuration fails closed when required values are missing', () => {
  assert.deepEqual(validateProviderConfiguration({}), {
    valid: false,
    code: 'provider_not_configured',
  })
})

test('provider calls are dependency-injected and normalized', async () => {
  let received
  const provider = createImageProvider({
    env,
    adapters: {
      'injected-test-provider': {
        async generateImage(input) {
          received = input
          return {
            providerRequestId: 'provider-request-1',
            outputReference: 'storage://output-1',
            safeMetadata: { width: 512 },
          }
        },
      },
    },
  })

  const result = await provider.generateImage({
    prompt: 'A classroom diagram',
    width: 512,
    height: 512,
    userId: 'user-1',
    requestId: 'request-1',
  })

  assert.deepEqual(result, {
    success: true,
    providerRequestId: 'provider-request-1',
    outputReference: 'storage://output-1',
    safeMetadata: { width: 512 },
  })
  assert.deepEqual(received, {
    prompt: 'A classroom diagram',
    width: 512,
    height: 512,
    model: 'test-model',
    userId: 'user-1',
    requestId: 'request-1',
  })
})

test('malformed provider output fails closed', async () => {
  const provider = createImageProvider({
    env,
    adapters: {
      'injected-test-provider': {
        async generateImage() {
          return { providerRequestId: 'provider-request-1', outputReference: '', safeMetadata: {} }
        },
      },
    },
  })

  assert.deepEqual(await provider.generateImage({}), {
    success: false,
    safeErrorCode: 'provider_invalid_output',
  })
})
