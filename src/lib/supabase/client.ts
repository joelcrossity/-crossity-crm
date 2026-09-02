import { createBrowserClient } from '@supabase/ssr'
import { configSupabase } from './config'

export function createClient() {
  return createBrowserClient(
    configSupabase().url,
    configSupabase().key
  )
}
