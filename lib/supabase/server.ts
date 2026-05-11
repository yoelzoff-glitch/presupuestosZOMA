import { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client scoped to the current user's session (from cookies).
 * Use this in API routes and Server Components to respect RLS policies.
 */
export function createSupabaseServerClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
      },
    }
  )
}

/**
 * Creates a Supabase admin client with service_role privileges.
 * Use this ONLY when you need to bypass RLS (e.g., creating users, cross-tenant operations).
 * NEVER expose this to the client.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
