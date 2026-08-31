import { createClient } from '@supabase/supabase-js'

export function supabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  const missing: string[] = []
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL')
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY')
  return { url, key, missing }
}

export function supabaseAdmin() {
  const { url, key, missing } = supabaseServerConfig()
  if (missing.length) throw new Error(`Supabase server configuration is missing: ${missing.join(', ')}`)
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
