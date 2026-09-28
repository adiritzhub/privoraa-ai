const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const allowedDimensions = new Set([256, 512, 768, 1024])

const messages = {
  method_not_allowed: 'Only POST requests are supported.',
  invalid_request: 'The image request is invalid.',
  unauthenticated: 'Sign in to generate an image.',
  permission_denied: 'This account is not allowed to generate images.',
  policy_blocked: 'This request is blocked by policy.',
  approval_required: 'This request requires Founder approval before generation.',
  provider_not_configured: 'Image generation is temporarily unavailable.',
  provider_misconfigured: 'Image generation is temporarily unavailable.',
  provider_timeout: 'The image provider timed out. Please try again.',
  provider_unavailable: 'The image provider is temporarily unavailable.',
  provider_invalid_output: 'The image provider returned an invalid result.',
  service_unavailable: 'Image generation is temporarily unavailable.',
}

function response(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function failure(code, status = 400) {
  return response({ success: false, errorCode: code, message: messages[code] ?? messages.service_unavailable }, status)
}

export function createGenerationHandler({ client, provider }) {
  return async function handle(request) {
    if (request.method !== 'POST') return failure('method_not_allowed', 405)

    let body
    try {
      body = await request.json()
    } catch {
      return failure('invalid_request')
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || !uuidPattern.test(body.requestId ?? '')) {
      return failure('invalid_request')
    }
    const width = body.width ?? 512
    const height = body.height ?? 512
    if (!allowedDimensions.has(width) || !allowedDimensions.has(height)) return failure('invalid_request')

    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError || !authData.user) return failure('unauthenticated', 401)
    const userId = authData.user.id

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role, permission_state')
      .eq('id', userId)
      .maybeSingle()
    if (profileError || !['user', 'founder'].includes(profile?.role) || profile.permission_state !== 'normal') {
      return failure('permission_denied', 403)
    }

    const { data: settings, error: settingsError } = await client
      .from('app_settings')
      .select('global_generation_enabled')
      .eq('singleton_id', true)
      .maybeSingle()
    if (settingsError || settings?.global_generation_enabled !== true) return failure('permission_denied', 403)

    const { data: requestRow, error: requestError } = await client
      .from('generation_requests')
      .select('id, user_id, prompt, classification, request_state')
      .eq('id', body.requestId)
      .maybeSingle()
    if (requestError || !requestRow || requestRow.user_id !== userId) return failure('permission_denied', 403)
    if (requestRow.classification === 'prohibited') return failure('policy_blocked', 403)
    if (requestRow.classification === 'restricted') return failure('approval_required', 403)
    if (requestRow.classification !== 'allowed' || requestRow.request_state !== 'eligible') return failure('policy_blocked', 403)

    const result = await provider.generateImage({
      prompt: requestRow.prompt,
      width,
      height,
      userId,
      requestId: requestRow.id,
    })
    if (!result.success) return failure(result.safeErrorCode, 502)

    return response({
      success: true,
      requestId: requestRow.id,
      providerRequestId: result.providerRequestId,
      outputReference: result.outputReference,
      safeMetadata: result.safeMetadata,
    }, 200)
  }
}