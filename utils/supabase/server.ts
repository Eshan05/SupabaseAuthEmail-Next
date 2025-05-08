import { Database } from '@/database.types'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = async (service?: boolean) => {
  const cookieStore = await cookies()
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = service
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supaKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
