import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createConfiguredHuggingFaceProvider } from '../_shared/huggingFaceProvider.js'
import { createGenerationHandler } from './handler.js'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''

Deno.serve(async (request) => {
  const authorization = request.headers.get('Authorization')
  if (!authorization || !supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ success: false, errorCode: 'unauthenticated', message: 'Sign in to generate an image.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const provider = createConfiguredHuggingFaceProvider()
  return createGenerationHandler({ client, provider })(request)
})