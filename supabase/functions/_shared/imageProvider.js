const SAFE_ERROR_CODES = new Set([
  'provider_not_configured',
  'provider_misconfigured',
  'provider_unavailable',
  'provider_timeout',
  'provider_invalid_output',
])

function safeFailure(code) {
  return { success: false, safeErrorCode: SAFE_ERROR_CODES.has(code) ? code : 'provider_unavailable' }
}

function normalizeSuccess(result) {
  if (result?.success === false) {
    return safeFailure(result.safeErrorCode)
  }
  if (!result || typeof result !== 'object') return safeFailure('provider_invalid_output')
  if (typeof result.providerRequestId !== 'string' || result.providerRequestId.length < 1) {
    return safeFailure('provider_invalid_output')
  }
  if (typeof result.outputReference !== 'string' || result.outputReference.length < 1) {
    return safeFailure('provider_invalid_output')
  }
  if (!result.safeMetadata || typeof result.safeMetadata !== 'object' || Array.isArray(result.safeMetadata)) {
    return safeFailure('provider_invalid_output')
  }
  return {
    success: true,
    providerRequestId: result.providerRequestId,
    outputReference: result.outputReference,
    safeMetadata: result.safeMetadata,
  }
}

export function validateProviderConfiguration(env) {
  const provider = typeof env?.AI_IMAGE_PROVIDER === 'string' ? env.AI_IMAGE_PROVIDER.trim() : ''
  const model = typeof env?.AI_IMAGE_MODEL === 'string' ? env.AI_IMAGE_MODEL.trim() : ''
  const apiKey = typeof env?.AI_IMAGE_API_KEY === 'string' ? env.AI_IMAGE_API_KEY.trim() : ''

  if (!provider || !model || !apiKey) return { valid: false, code: 'provider_not_configured' }
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(provider) || model.length > 120 || apiKey.length < 8) {
    return { valid: false, code: 'provider_misconfigured' }
  }
  return { valid: true, provider, model }
}

export function createImageProvider({ env = {}, adapters = {} } = {}) {
  const configuration = validateProviderConfiguration(env)
  const adapter = configuration.valid ? adapters[configuration.provider] : null

  return {
    configuration,
    async generateImage(input) {
      if (!configuration.valid) return safeFailure(configuration.code)
      if (!adapter || typeof adapter.generateImage !== 'function') return safeFailure('provider_misconfigured')

      try {
        const result = await adapter.generateImage({
          prompt: input?.prompt,
          width: input?.width,
          height: input?.height,
          model: configuration.model,
          userId: input?.userId,
          requestId: input?.requestId,
        })
        return normalizeSuccess(result)
      } catch {
        return safeFailure('provider_unavailable')
      }
    },
  }
}

export const imageProviderInternals = { normalizeSuccess, safeFailure }
