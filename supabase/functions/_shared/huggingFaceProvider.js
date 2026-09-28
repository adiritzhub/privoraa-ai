import { createImageProvider } from './imageProvider.js'

const defaultTimeoutMs = 30000
const maxOutputBytes = 10 * 1024 * 1024

function imageContentType(value) {
  const contentType = String(value ?? '').split(';', 1)[0].trim().toLowerCase()
  return /^image\/(png|jpeg|webp)$/.test(contentType) ? contentType : null
}

function toBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

export function createHuggingFaceAdapter({ fetchImpl = fetch, timeoutMs = defaultTimeoutMs, apiKey = '' } = {}) {
  return {
    async generateImage({ prompt, model }) {
      if (typeof prompt !== 'string' || prompt.trim().length < 1 || typeof model !== 'string' || model.trim().length < 1) {
        return { success: false, safeErrorCode: 'provider_invalid_output' }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetchImpl(`https://router.huggingface.co/hf-inference/models/${encodeURIComponent(model)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: prompt.trim() }),
          signal: controller.signal,
        })

        if (!response.ok) return { success: false, safeErrorCode: 'provider_unavailable' }
        const contentType = imageContentType(response.headers.get('content-type'))
        if (!contentType) return { success: false, safeErrorCode: 'provider_invalid_output' }

        const output = new Uint8Array(await response.arrayBuffer())
        if (output.length < 1 || output.length > maxOutputBytes) {
          return { success: false, safeErrorCode: 'provider_invalid_output' }
        }

        const providerRequestId = response.headers.get('x-request-id')?.trim()
        if (!providerRequestId) return { success: false, safeErrorCode: 'provider_invalid_output' }

        return {
          providerRequestId,
          outputReference: `data:${contentType};base64,${toBase64(output)}`,
          safeMetadata: { contentType, byteLength: output.length },
        }
      } catch (error) {
        return { success: false, safeErrorCode: error?.name === 'AbortError' ? 'provider_timeout' : 'provider_unavailable' }
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}

export function createConfiguredHuggingFaceProvider({ env = globalThis.Deno?.env, fetchImpl, timeoutMs } = {}) {
  const environment = {
    AI_IMAGE_PROVIDER: env?.get('AI_IMAGE_PROVIDER') ?? '',
    AI_IMAGE_MODEL: env?.get('AI_IMAGE_MODEL') ?? '',
    AI_IMAGE_API_KEY: env?.get('AI_IMAGE_API_KEY') ?? '',
  }
  if (environment.AI_IMAGE_PROVIDER !== 'huggingface') {
    return createImageProvider({ env: { ...environment, AI_IMAGE_PROVIDER: '' } })
  }
  return createImageProvider({
    env: environment,
    adapters: { huggingface: createHuggingFaceAdapter({ fetchImpl, timeoutMs, apiKey: environment.AI_IMAGE_API_KEY }) },
  })
}