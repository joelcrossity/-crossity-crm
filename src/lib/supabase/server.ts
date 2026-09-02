import { createServerClient } from '@supabase/ssr'
import { configSupabase } from './config'
import { cookies } from 'next/headers'

export async function createClient() {
  // En Next 16 cookies() es asincrónico.
  const cookieStore = await cookies()

  return createServerClient(
    configSupabase().url,
    configSupabase().key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component: las refresca el proxy.
          }
        },
      },
    }
  )
}
