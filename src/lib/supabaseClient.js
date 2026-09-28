import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from './supabaseConfig.js'

export const supabase = supabaseConfig.configured
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null